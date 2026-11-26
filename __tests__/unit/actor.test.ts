import { beforeEach, describe, expect, it, vi } from "vitest";

const { db, auth } = vi.hoisted(() => ({
  db: { apiToken: { findUnique: vi.fn(), update: vi.fn() } },
  auth: vi.fn(),
}));
vi.mock("@/lib/db/prisma", () => ({ prisma: db }));
vi.mock("@/lib/auth", () => ({ auth }));

import { requireScope, resolveActor, type Actor } from "@/lib/auth/actor";
import { hashToken } from "@/lib/auth/token";

const TOKEN = "nsk_valid-token";
const DAY = 86_400_000;
const req = (authorization?: string) =>
  new Request("http://x/api/ums", { headers: authorization ? { authorization } : {} });

const record = (over: Record<string, unknown> = {}) => ({
  id: "t1",
  userId: "ag1",
  tokenHash: hashToken(TOKEN),
  scopes: ["read:catalog", "write:catalog", "lixo"],
  expiresAt: new Date(Date.now() + DAY),
  revokedAt: null,
  lastUsedAt: null,
  user: { role: "AGENTE" },
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  db.apiToken.findUnique.mockResolvedValue(null);
  db.apiToken.update.mockResolvedValue({});
  auth.mockResolvedValue(null);
});

describe("resolveActor — Bearer", () => {
  it("token válido → ator token com escopos conhecidos, busca pelo hash", async () => {
    db.apiToken.findUnique.mockResolvedValue(record());
    const actor = await resolveActor(req(`Bearer ${TOKEN}`));
    expect(actor).toEqual({
      kind: "token",
      userId: "ag1",
      role: "AGENTE",
      tokenId: "t1",
      scopes: ["read:catalog", "write:catalog"],
    });
    expect(db.apiToken.findUnique.mock.calls[0][0].where).toEqual({ tokenHash: hashToken(TOKEN) });
    expect(db.apiToken.findUnique.mock.calls[0][0].include.user.select).toEqual({ role: true, desativadoEm: true });
    expect(db.apiToken.update).toHaveBeenCalled();
  });

  it("lastUsedAt recente não gera escrita", async () => {
    db.apiToken.findUnique.mockResolvedValue(record({ lastUsedAt: new Date() }));
    await resolveActor(req(`Bearer ${TOKEN}`));
    expect(db.apiToken.update).not.toHaveBeenCalled();
  });

  it.each([
    ["inexistente", null],
    ["expirado", record({ expiresAt: new Date(Date.now() - 1) })],
    ["revogado", record({ revokedAt: new Date() })],
    ["de role humana", record({ user: { role: "ADMIN" } })],
    ["de agente desativado (não revogado)", record({ user: { role: "AGENTE", desativadoEm: new Date() } })],
  ])("token %s → null", async (_, value) => {
    db.apiToken.findUnique.mockResolvedValue(value);
    await expect(resolveActor(req(`Bearer ${TOKEN}`))).resolves.toBeNull();
  });

  it("Bearer vazio → null sem consultar o banco", async () => {
    await expect(resolveActor(req("Bearer   "))).resolves.toBeNull();
    expect(db.apiToken.findUnique).not.toHaveBeenCalled();
  });
});

describe("resolveActor — precedência", () => {
  const session = { user: { id: "h1", role: "ADMIN" } };

  it("Bearer válido + cookie → vence o Bearer", async () => {
    auth.mockResolvedValue(session);
    db.apiToken.findUnique.mockResolvedValue(record());
    expect((await resolveActor(req(`Bearer ${TOKEN}`)))?.kind).toBe("token");
    expect(auth).not.toHaveBeenCalled();
  });

  it("Bearer inválido + cookie válido → null, sem fallback", async () => {
    auth.mockResolvedValue(session);
    await expect(resolveActor(req("Bearer nsk_errado"))).resolves.toBeNull();
    expect(auth).not.toHaveBeenCalled();
  });

  it("só cookie → ator de sessão", async () => {
    auth.mockResolvedValue(session);
    await expect(resolveActor(req())).resolves.toEqual({
      kind: "session",
      userId: "h1",
      role: "ADMIN",
    });
  });

  it("outro esquema (Basic) é ignorado e usa o cookie", async () => {
    auth.mockResolvedValue(session);
    expect((await resolveActor(req("Basic abc")))?.kind).toBe("session");
  });

  it("sem nada ou sessão não humana → null", async () => {
    await expect(resolveActor(req())).resolves.toBeNull();
    auth.mockResolvedValue({ user: { id: "x", role: "AGENTE" } });
    await expect(resolveActor(req())).resolves.toBeNull();
  });
});

describe("requireScope", () => {
  const agent: Actor = {
    kind: "token",
    userId: "ag1",
    role: "AGENTE",
    tokenId: "t1",
    scopes: ["read:catalog", "delete:catalog"],
  };

  it("escopo presente → null", () => {
    expect(requireScope(agent, "read:catalog")).toBeNull();
  });

  it("escopo insuficiente → 403", () => {
    expect(requireScope(agent, "write:catalog")?.status).toBe(403);
  });

  it("destrutiva exige delete:catalog E destructive", () => {
    expect(requireScope(agent, "delete:catalog", "destructive")?.status).toBe(403);
    expect(
      requireScope({ ...agent, scopes: ["delete:catalog", "destructive"] }, "delete:catalog", "destructive"),
    ).toBeNull();
  });

  it("nenhum escopo pedido → agente negado", () => {
    expect(requireScope(agent)?.status).toBe(403);
  });

  it("sessão humana passa (autorização pela role)", () => {
    expect(requireScope({ kind: "session", userId: "h1", role: "USER" }, "destructive")).toBeNull();
  });
});
