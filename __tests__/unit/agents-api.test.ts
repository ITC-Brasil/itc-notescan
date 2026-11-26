import { beforeEach, describe, expect, it, vi } from "vitest";

const { db, auth } = vi.hoisted(() => ({
  db: {
    user: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    apiToken: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      create: vi.fn(),
    },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn(),
  },
  auth: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({ prisma: db }));
vi.mock("@/lib/auth", () => ({ auth }));

import { Prisma } from "@/generated/prisma/client";
import { GET, POST } from "@/app/api/agents/route";
import { DELETE, PATCH } from "@/app/api/agents/[id]/route";
import { DELETE as REVOKE, POST as ISSUE } from "@/app/api/agents/[id]/token/route";
import { hashToken } from "@/lib/auth/token";
import { tokenSituacao } from "@/lib/services/agent.service";
import { ALL_SCOPES, tokenRecord, withBearer } from "./helpers/actor";

const URL_ = "http://x/api/agents";
const req = (method: string, body?: unknown) =>
  new Request(URL_, { method, body: body === undefined ? undefined : JSON.stringify(body) });
const params = { params: Promise.resolve({ id: "ag1" }) };
const audited = () => db.auditLog.create.mock.calls.map((c) => c[0].data);

beforeEach(() => {
  vi.clearAllMocks();
  auth.mockResolvedValue({ user: { id: "m1", role: "MASTER" } });
  db.$transaction.mockImplementation((fn: (tx: typeof db) => unknown) => fn(db));
  db.user.findMany.mockResolvedValue([]);
  db.user.findFirst.mockResolvedValue({ id: "ag1" });
  db.user.create.mockImplementation(({ data }) => Promise.resolve({ id: "ag1", ...data }));
  db.user.update.mockImplementation(({ data }) => Promise.resolve({ id: "ag1", ...data }));
  db.apiToken.create.mockImplementation(({ data }) => Promise.resolve({ id: "t9", ...data }));
});

describe("autorização de /api/agents", () => {
  const calls = [
    ["GET", () => GET(req("GET"))],
    ["POST", () => POST(req("POST", { nome: "Bot" }))],
    ["PATCH", () => PATCH(req("PATCH", { nome: "Bot" }), params)],
    ["DELETE", () => DELETE(req("DELETE"), params)],
    ["ISSUE", () => ISSUE(req("POST", { scopes: ["read:catalog"] }), params)],
    ["REVOKE", () => REVOKE(req("DELETE"), params)],
  ] as const;

  it.each(calls)("%s: sem sessão → 401", async (_, call) => {
    auth.mockResolvedValue(null);
    expect((await call()).status).toBe(401);
  });

  it.each(calls)("%s: ADMIN → 403", async (_, call) => {
    auth.mockResolvedValue({ user: { id: "a1", role: "ADMIN" } });
    expect((await call()).status).toBe(403);
  });

  it("token de agente → 403 mesmo com todos os escopos", async () => {
    db.apiToken.findUnique.mockResolvedValue(tokenRecord(ALL_SCOPES));
    expect((await GET(withBearer(URL_))).status).toBe(403);
    const issue = withBearer(URL_, { method: "POST", body: JSON.stringify({ scopes: ALL_SCOPES }) });
    expect((await ISSUE(issue, params)).status).toBe(403);
    expect(db.apiToken.create).not.toHaveBeenCalled();
  });

  it("id que não é AGENTE → 404", async () => {
    db.user.findFirst.mockResolvedValue(null);
    expect((await PATCH(req("PATCH", { nome: "Xy" }), params)).status).toBe(404);
    expect((await ISSUE(req("POST", { scopes: ["read:catalog"] }), params)).status).toBe(404);
    expect(db.user.findFirst.mock.calls[0][0].where).toEqual({ id: "ag1", role: "AGENTE" });
  });
});

describe("GET /api/agents", () => {
  it("situação do token mais recente, sem tokenHash", async () => {
    const future = new Date(Date.now() + 1000);
    db.user.findMany.mockResolvedValue([
      { id: "a", nome: "A", apiTokens: [] },
      { id: "b", nome: "B", apiTokens: [{ prefix: "nsk_b", revokedAt: null, expiresAt: future }] },
    ]);
    const body = await (await GET(req("GET"))).json();
    expect(body.map((a: { situacao: string }) => a.situacao)).toEqual(["nenhum", "ativo"]);
    const select = db.user.findMany.mock.calls[0][0].select.apiTokens.select;
    expect(select).not.toHaveProperty("tokenHash");
    expect(db.user.findMany.mock.calls[0][0].where).toEqual({ role: "AGENTE" });
  });

  it("tokenSituacao", () => {
    const now = Date.now();
    expect(tokenSituacao(undefined)).toBe("nenhum");
    expect(tokenSituacao({ revokedAt: new Date(), expiresAt: new Date(now + 1) })).toBe("revogado");
    expect(tokenSituacao({ revokedAt: null, expiresAt: new Date(now) }, now)).toBe("expirado");
    expect(tokenSituacao({ revokedAt: null, expiresAt: new Date(now + 1) }, now)).toBe("ativo");
  });
});

describe("POST /api/agents", () => {
  it("cria sem senha, e-mail gerado e AuditLog na transação", async () => {
    db.user.findMany.mockResolvedValue([{ email: "agente-bot@notescan.invalid" }]);
    const res = await POST(req("POST", { nome: "Bot", descricao: "MCP" }));
    expect(res.status).toBe(201);
    expect(db.user.create.mock.calls[0][0].data).toMatchObject({
      role: "AGENTE",
      passwordHash: null,
      email: "agente-bot-2@notescan.invalid",
    });
    expect(audited()).toEqual([
      expect.objectContaining({ entidade: "Agente", acao: "CRIADO", actorId: "m1", tokenId: null }),
    ]);
  });

  it.each([{ password: "12345678" }, { metaDiaria: 3 }, { email: "x@y.com" }, { role: "AGENTE" }])(
    "rejeita campo extra %o (400)",
    async (extra) => {
      expect((await POST(req("POST", { nome: "Bot", ...extra }))).status).toBe(400);
      expect(db.user.create).not.toHaveBeenCalled();
    },
  );

  it("corrida de e-mail (P2002) → 409", async () => {
    db.user.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("x", { code: "P2002", clientVersion: "t" }),
    );
    expect((await POST(req("POST", { nome: "Bot" }))).status).toBe(409);
  });
});

describe("PATCH / DELETE /api/agents/[id]", () => {
  it("edita nome e descrição com AuditLog", async () => {
    const res = await PATCH(req("PATCH", { descricao: "novo" }), params);
    expect(res.status).toBe(200);
    expect(db.user.update.mock.calls[0][0].data).toEqual({ descricao: "novo" });
    expect(audited()[0]).toMatchObject({ acao: "EDITADO", payload: { descricao: "novo" } });
  });

  it("não troca role nem senha (400)", async () => {
    expect((await PATCH(req("PATCH", { role: "USER" }), params)).status).toBe(400);
    expect((await PATCH(req("PATCH", { password: "12345678" }), params)).status).toBe(400);
  });

  it.each([
    [1, 0],
    [0, 1],
  ])("tokens=%i auditLogs=%i → 409", async (apiTokens, auditLogs) => {
    db.user.findUnique.mockResolvedValue({ _count: { apiTokens, auditLogs } });
    const res = await DELETE(req("DELETE"), params);
    expect(res.status).toBe(409);
    expect((await res.json()).message).toMatch(/revogue o token/);
    expect(db.user.delete).not.toHaveBeenCalled();
  });

  it("sem histórico é excluído", async () => {
    db.user.findUnique.mockResolvedValue({ _count: { apiTokens: 0, auditLogs: 0 } });
    expect((await DELETE(req("DELETE"), params)).status).toBe(204);
    expect(audited()[0]).toMatchObject({ acao: "EXCLUIDO", entidadeId: "ag1" });
  });
});

describe("token do agente", () => {
  it("emite: valor em claro só na resposta, no-store, AuditLog sem token nem hash", async () => {
    const res = await ISSUE(req("POST", { scopes: ["read:catalog", "read:catalog"] }), params);
    expect(res.status).toBe(201);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const body = await res.json();
    expect(body.token).toMatch(/^nsk_/);
    expect(body.scopes).toEqual(["read:catalog"]);
    expect(Object.keys(body).sort()).toEqual(["expiresAt", "prefix", "scopes", "token"]);

    const [entry] = audited();
    expect(entry.acao).toBe("TOKEN_EMITIDO");
    expect(Object.keys(entry.payload).sort()).toEqual(["expiresAt", "prefix", "scopes"]);
    const json = JSON.stringify(entry);
    expect(json).not.toContain(body.token);
    expect(json).not.toContain(hashToken(body.token));
    // reemissão revoga o anterior na mesma transação
    expect(db.apiToken.updateMany).toHaveBeenCalledWith({
      where: { userId: "ag1", revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it.each([{ scopes: [] }, { scopes: ["admin"] }, {}])("escopos inválidos %o → 400", async (b) => {
    expect((await ISSUE(req("POST", b), params)).status).toBe(400);
  });

  it("revoga: AuditLog sem hash; sem token ativo → 404", async () => {
    db.apiToken.findFirst.mockResolvedValueOnce({
      id: "t1",
      prefix: "nsk_abcdefgh",
      scopes: ["read:catalog"],
      expiresAt: new Date(),
    });
    expect((await REVOKE(req("DELETE"), params)).status).toBe(204);
    expect(db.apiToken.update.mock.calls[0][0]).toEqual({
      where: { id: "t1" },
      data: { revokedAt: expect.any(Date) },
    });
    const [entry] = audited();
    expect(entry.acao).toBe("TOKEN_REVOGADO");
    expect(Object.keys(entry.payload).sort()).toEqual(["expiresAt", "prefix", "scopes"]);
    expect(db.apiToken.findFirst.mock.calls[0][0].select).not.toHaveProperty("tokenHash");

    db.apiToken.findFirst.mockResolvedValueOnce(null);
    expect((await REVOKE(req("DELETE"), params)).status).toBe(404);
  });
});
