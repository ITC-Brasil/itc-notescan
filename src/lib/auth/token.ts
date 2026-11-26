import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/db/prisma";
import { audit } from "@/lib/services/audit.service";
import type { Actor } from "./actor";

import type { Scope } from "./scopes";
export { SCOPES, type Scope } from "./scopes";

export const TOKEN_PREFIX = "nsk_";
const TOKEN_TTL_MS = 365 * 24 * 60 * 60 * 1000;

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// 256 bits de entropia: sha256 basta (bcrypt só faz sentido para senha humana).
export function generateToken() {
  const token = TOKEN_PREFIX + randomBytes(32).toString("base64url");
  return { token, prefix: token.slice(0, 12), tokenHash: hashToken(token) };
}

// Um token ativo por agente: emitir revoga o anterior na mesma transação.
// O valor em claro só existe no retorno desta função.
export async function issueApiToken(userId: string, scopes: Scope[], actor?: Actor) {
  const { token, prefix, tokenHash } = generateToken();
  const now = new Date();
  const record = await prisma.$transaction(async (tx) => {
    await tx.apiToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: now },
    });
    const created = await tx.apiToken.create({
      data: {
        userId,
        prefix,
        tokenHash,
        scopes,
        expiresAt: new Date(now.getTime() + TOKEN_TTL_MS),
      },
      select: { id: true, prefix: true, scopes: true, expiresAt: true },
    });
    // Payload só com metadados: nunca o token nem o hash.
    if (actor)
      await audit(tx, actor, {
        entidade: "Agente",
        entidadeId: userId,
        acao: "TOKEN_EMITIDO",
        payload: {
          prefix: created.prefix,
          scopes: created.scopes,
          expiresAt: created.expiresAt.toISOString(),
        },
      });
    return created;
  });
  return { ...record, token };
}

// Revoga o token ativo do agente. false = não havia token ativo.
export async function revokeApiToken(userId: string, actor: Actor): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const active = await tx.apiToken.findFirst({
      where: { userId, revokedAt: null },
      select: { id: true, prefix: true, scopes: true, expiresAt: true },
    });
    if (!active) return false;
    await tx.apiToken.update({ where: { id: active.id }, data: { revokedAt: new Date() } });
    await audit(tx, actor, {
      entidade: "Agente",
      entidadeId: userId,
      acao: "TOKEN_REVOGADO",
      payload: {
        prefix: active.prefix,
        scopes: active.scopes,
        expiresAt: active.expiresAt.toISOString(),
      },
    });
    return true;
  });
}
