import { timingSafeEqual } from "crypto";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { logger } from "@/lib/logger";
import { isHumanRole, type HumanRole } from "./roles";
import { hashToken, SCOPES, type Scope } from "./token";

// m8-01: ator da request. Humano vem do cookie (autorização pela role);
// agente vem do Bearer (autorização SÓ pelos escopos do token).
export type Actor =
  | { kind: "session"; userId: string; role: HumanRole }
  | { kind: "token"; userId: string; role: "AGENTE"; tokenId: string; scopes: Scope[] };

const LAST_USED_THROTTLE_MS = 60_000;

function bearer(request: Request): string | null | undefined {
  const header = request.headers.get("authorization");
  if (!header || !/^bearer\s/i.test(header)) return undefined; // sem Bearer → cookie
  return header.slice(7).trim() || null; // Bearer vazio = inválido
}

// Bearer tem precedência: presente e inválido → null (401), nunca cai no cookie.
// Fase 2: nenhuma rota usa ainda; a Fase 3 troca auth() por isto rota a rota.
export async function resolveActor(request: Request): Promise<Actor | null> {
  const token = bearer(request);
  if (token !== undefined) return token ? resolveToken(token) : null;

  const session = await auth();
  if (!session || !isHumanRole(session.user.role)) return null;
  return { kind: "session", userId: session.user.id, role: session.user.role };
}

async function resolveToken(token: string): Promise<Actor | null> {
  const hash = hashToken(token);
  const record = await prisma.apiToken.findUnique({
    where: { tokenHash: hash },
    include: { user: { select: { role: true } } },
  });
  if (!record) return null;
  // Defesa extra além do lookup por índice: comparação em tempo constante.
  if (!timingSafeEqual(Buffer.from(record.tokenHash), Buffer.from(hash))) return null;

  const now = Date.now();
  if (record.revokedAt || record.expiresAt.getTime() <= now) return null;
  if (record.user.role !== "AGENTE") return null;

  if (!record.lastUsedAt || now - record.lastUsedAt.getTime() > LAST_USED_THROTTLE_MS) {
    prisma.apiToken
      .update({ where: { id: record.id }, data: { lastUsedAt: new Date(now) } })
      .catch((error: unknown) => logger.captureException(error));
  }

  return {
    kind: "token",
    userId: record.userId,
    role: "AGENTE",
    tokenId: record.id,
    scopes: record.scopes.filter((s): s is Scope => (SCOPES as readonly string[]).includes(s)),
  };
}

// Exige TODOS os escopos (ex.: bulk-delete = "delete:catalog" + "destructive").
// Sessão humana passa: a autorização humana continua pelas checagens de role.
export function requireScope(actor: Actor, ...scopes: Scope[]): Response | null {
  if (actor.kind === "session") return null;
  // Sem escopo pedido = rota não liberada a agentes: nega por padrão.
  if (scopes.length > 0 && scopes.every((s) => actor.scopes.includes(s))) return null;
  return Response.json({ message: "Proibido" }, { status: 403 });
}
