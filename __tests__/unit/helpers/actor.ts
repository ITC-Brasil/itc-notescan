import { hashToken } from "@/lib/auth/token";
import type { Scope } from "@/lib/auth/scopes";

// Registro de ApiToken como o prisma.apiToken.findUnique devolve (resolveActor real).
export const TOKEN = "nsk_test-token";
const DAY = 86_400_000;

export function tokenRecord(scopes: Scope[], over: Record<string, unknown> = {}) {
  return {
    id: "tok1",
    userId: "ag1",
    tokenHash: hashToken(TOKEN),
    scopes,
    expiresAt: new Date(Date.now() + DAY),
    revokedAt: null,
    lastUsedAt: new Date(), // evita o update de lastUsedAt
    user: { role: "AGENTE" },
    ...over,
  };
}

export const ALL_SCOPES: Scope[] = ["read:catalog", "write:catalog", "delete:catalog", "destructive"];

export const withBearer = (url: string, init: RequestInit = {}) =>
  new Request(url, { ...init, headers: { authorization: `Bearer ${TOKEN}` } });

// Variantes de token que precisam dar 401.
export const invalidTokens = {
  inexistente: null,
  revogado: () => tokenRecord(ALL_SCOPES, { revokedAt: new Date() }),
  expirado: () => tokenRecord(ALL_SCOPES, { expiresAt: new Date(Date.now() - 1) }),
};
