import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/db/prisma";

// m8-01: escopos independentes — nenhum implica outro.
export const SCOPES = ["read:catalog", "write:catalog", "delete:catalog", "destructive"] as const;
export type Scope = (typeof SCOPES)[number];

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
export async function issueApiToken(userId: string, scopes: Scope[]) {
  const { token, prefix, tokenHash } = generateToken();
  const now = new Date();
  const record = await prisma.$transaction(async (tx) => {
    await tx.apiToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: now },
    });
    return tx.apiToken.create({
      data: {
        userId,
        prefix,
        tokenHash,
        scopes,
        expiresAt: new Date(now.getTime() + TOKEN_TTL_MS),
      },
      select: { id: true, prefix: true, scopes: true, expiresAt: true },
    });
  });
  return { ...record, token };
}
