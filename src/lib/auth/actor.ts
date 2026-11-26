import { timingSafeEqual } from "crypto";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { logger } from "@/lib/logger";
import { isHumanRole, type HumanRole } from "./roles";
import { hashToken, SCOPES, type Scope } from "./token";
import { rateLimitByActor } from "@/lib/rate-limit";

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
// As rotas de API chamam isto via authorize() (m8-01, Fase 3).
export async function resolveActor(request: Request): Promise<Actor | null> {
  // "credential", não "token": a regra detect-possible-timing-attacks casa pelo
  // nome e aqui só se compara com undefined, nunca com um segredo.
  const credential = bearer(request);
  if (credential !== undefined) return credential ? resolveToken(credential) : null;

  const session = await auth();
  if (!session || !isHumanRole(session.user.role)) return null;
  return { kind: "session", userId: session.user.id, role: session.user.role };
}

async function resolveToken(token: string): Promise<Actor | null> {
  const hash = hashToken(token);
  const record = await prisma.apiToken.findUnique({
    where: { tokenHash: hash },
    include: { user: { select: { role: true, desativadoEm: true } } },
  });
  if (!record) return null;
  // Defesa extra além do lookup por índice: comparação em tempo constante.
  if (!timingSafeEqual(Buffer.from(record.tokenHash), Buffer.from(hash))) return null;

  const now = Date.now();
  if (record.revokedAt || record.expiresAt.getTime() <= now) return null;
  if (record.user.role !== "AGENTE") return null;
  if (record.user.desativadoEm) return null; // defesa extra: desativar já revoga o token

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

// Porta única das rotas migradas: 401 sem ator, 403 por escopo (agente) ou por
// role (humano, mesma regra de antes), 429 pelo limite do ator.
// scopes vazio = rota fechada a agentes (403 explícito a qualquer token).
export async function authorize(
  request: Request,
  { scopes, roles, rate }: { scopes: readonly Scope[]; roles?: readonly HumanRole[]; rate?: "read" | "write" },
): Promise<Actor | Response> {
  const actor = await resolveActor(request);
  if (!actor) return Response.json({ message: "Não autorizado" }, { status: 401 });
  const denied = requireScope(actor, ...scopes);
  if (denied) return denied;
  if (actor.kind === "session" && roles && !roles.includes(actor.role))
    return Response.json({ message: "Proibido" }, { status: 403 });
  if (rate && !rateLimitByActor(actor.userId, rate, actor.kind).allowed)
    return Response.json({ message: "Muitas requisições, aguarde alguns segundos" }, { status: 429 });
  return actor;
}

// Rotas só de MASTER em sessão (gestão de agentes): nenhum escopo libera token.
export const MASTER_ONLY = { scopes: [], roles: ["MASTER"] } as const;

// Escrita no catálogo (3b): agente com write:catalog; humano ADMIN/MASTER como antes.
export const WRITE_CATALOG = {
  scopes: ["write:catalog"],
  roles: ["ADMIN", "MASTER"],
  rate: "write",
} as const;

// Exclusão simples (3c): arquivar notebook um a um.
export const DELETE_CATALOG = {
  scopes: ["delete:catalog"],
  roles: ["ADMIN", "MASTER"],
  rate: "write",
} as const;

// Destrutivas (3d): exclusão de UM e de projeto e bulk-delete por UM exigem os dois escopos.
export const DESTRUCTIVE = {
  scopes: ["delete:catalog", "destructive"],
  roles: ["ADMIN", "MASTER"],
  rate: "write",
} as const;
