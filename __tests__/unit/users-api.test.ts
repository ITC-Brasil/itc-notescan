import { beforeEach, describe, expect, it, vi } from "vitest";

const { db, auth } = vi.hoisted(() => ({
  db: {
    user: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
  },
  auth: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({ prisma: db }));
vi.mock("@/lib/auth", () => ({ auth }));
vi.mock("bcrypt", () => ({ default: { hash: vi.fn().mockResolvedValue("h") } }));

import { Prisma } from "@/generated/prisma/client";
import { POST } from "@/app/api/users/route";
import { PUT, DELETE } from "@/app/api/users/[id]/route";
import { agentEmail, agentSlug } from "@/lib/services/user.service";

const req = (method: string, body?: unknown) =>
  new Request("http://x/api/users", { method, body: body === undefined ? undefined : JSON.stringify(body) });
const params = { params: Promise.resolve({ id: "u2" }) };
const human = { nome: "Fulano", email: "f@itc.com", role: "USER", metaDiaria: 2 };

beforeEach(() => {
  vi.clearAllMocks();
  auth.mockResolvedValue({ user: { id: "m1", role: "MASTER" } });
  db.user.findMany.mockResolvedValue([]);
  db.user.findUnique.mockResolvedValue(null);
  db.user.create.mockImplementation(({ data }) => Promise.resolve({ id: "a1", ...data }));
});

describe("agentEmail", () => {
  it("gera slug sem acento em .invalid", () => {
    expect(agentSlug("Agente Catálogo!")).toBe("agente-catalogo");
    expect(agentSlug("!!!")).toBe("agente");
    expect(agentEmail("Bot", [])).toBe("agente-bot@notescan.invalid");
  });

  it("colisão → sufixo numérico", () => {
    expect(
      agentEmail("Bot", ["agente-bot@notescan.invalid", "agente-bot-2@notescan.invalid"]),
    ).toBe("agente-bot-3@notescan.invalid");
  });
});

describe("POST /api/users (AGENTE)", () => {
  it("só MASTER cria", async () => {
    auth.mockResolvedValue({ user: { id: "a", role: "ADMIN" } });
    expect((await POST(req("POST", { role: "AGENTE", nome: "Bot" }))).status).toBe(403);
  });

  it("cria sem senha e com e-mail gerado", async () => {
    db.user.findMany.mockResolvedValue([{ email: "agente-bot@notescan.invalid" }]);
    const res = await POST(req("POST", { role: "AGENTE", nome: "Bot", descricao: "MCP" }));
    expect(res.status).toBe(201);
    expect(db.user.create.mock.calls[0][0].data).toMatchObject({
      role: "AGENTE",
      passwordHash: null,
      descricao: "MCP",
      email: "agente-bot-2@notescan.invalid",
    });
  });

  it.each([{ password: "12345678" }, { metaDiaria: 3 }, { email: "x@y.com" }])(
    "rejeita campo humano %o (400)",
    async (extra) => {
      const res = await POST(req("POST", { role: "AGENTE", nome: "Bot", ...extra }));
      expect(res.status).toBe(400);
      expect(db.user.create).not.toHaveBeenCalled();
    },
  );

  it("corrida de e-mail (P2002) → 409", async () => {
    db.user.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("x", { code: "P2002", clientVersion: "t" }),
    );
    expect((await POST(req("POST", { role: "AGENTE", nome: "Bot" }))).status).toBe(409);
  });

  it("humano continua exigindo senha", async () => {
    expect((await POST(req("POST", human))).status).toBe(400);
    expect((await POST(req("POST", { ...human, password: "12345678" }))).status).toBe(201);
  });
});

describe("PUT /api/users/[id] — AGENTE imutável", () => {
  it("AGENTE → humano: 409", async () => {
    db.user.findUnique.mockResolvedValue({ role: "AGENTE" });
    expect((await PUT(req("PUT", human), params)).status).toBe(409);
    expect(db.user.update).not.toHaveBeenCalled();
  });

  it("humano → AGENTE: 409", async () => {
    db.user.findUnique.mockResolvedValue({ role: "USER" });
    expect((await PUT(req("PUT", { ...human, role: "AGENTE" }), params)).status).toBe(409);
  });

  it("usuário inexistente: 404", async () => {
    expect((await PUT(req("PUT", human), params)).status).toBe(404);
  });

  it("humano → humano segue normal", async () => {
    db.user.findUnique.mockResolvedValue({ role: "USER" });
    db.user.update.mockResolvedValue({ id: "u2" });
    expect((await PUT(req("PUT", { ...human, role: "ADMIN" }), params)).status).toBe(200);
  });
});

describe("DELETE /api/users/[id] — agente com histórico", () => {
  const target = (role: string, apiTokens: number, auditLogs: number) =>
    db.user.findUnique.mockResolvedValue({ role, _count: { apiTokens, auditLogs } });

  it.each([
    [1, 0],
    [0, 1],
  ])("tokens=%i auditLogs=%i → 409", async (t, a) => {
    target("AGENTE", t, a);
    const res = await DELETE(req("DELETE"), params);
    expect(res.status).toBe(409);
    expect((await res.json()).message).toMatch(/revogue o token/);
    expect(db.user.delete).not.toHaveBeenCalled();
  });

  it("agente sem histórico é excluído", async () => {
    target("AGENTE", 0, 0);
    expect((await DELETE(req("DELETE"), params)).status).toBe(204);
  });
});
