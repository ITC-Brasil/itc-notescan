import { beforeEach, describe, expect, it, vi } from "vitest";

const { db, auth } = vi.hoisted(() => ({
  db: {
    user: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    apiToken: { findUnique: vi.fn(), update: vi.fn() },
  },
  auth: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({ prisma: db }));
vi.mock("@/lib/auth", () => ({ auth }));
vi.mock("bcrypt", () => ({ default: { hash: vi.fn().mockResolvedValue("h") } }));

import { GET, POST } from "@/app/api/users/route";
import { PUT, DELETE } from "@/app/api/users/[id]/route";
import { PUT as CHANGE_PASSWORD } from "@/app/api/users/change-password/route";
import { agentEmail, agentSlug } from "@/lib/services/user.service";
import { ALL_SCOPES, tokenRecord, withBearer } from "./helpers/actor";

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

describe("POST /api/users", () => {
  it("AGENTE saiu daqui: role AGENTE → 400", async () => {
    expect((await POST(req("POST", { role: "AGENTE", nome: "Bot" }))).status).toBe(400);
    expect(db.user.create).not.toHaveBeenCalled();
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

describe("GET /api/users", () => {
  it("não lista agentes", async () => {
    await GET(req("GET"));
    expect(db.user.findMany.mock.calls[0][0].where).toEqual({ role: { not: "AGENTE" } });
  });
});

describe("DELETE /api/users/[id]", () => {
  it("agente é gerido em /api/agents → 404", async () => {
    db.user.findUnique.mockResolvedValue({ role: "AGENTE" });
    expect((await DELETE(req("DELETE"), params)).status).toBe(404);
    expect(db.user.delete).not.toHaveBeenCalled();
  });

  it("humano é excluído", async () => {
    db.user.findUnique.mockResolvedValue({ role: "USER" });
    expect((await DELETE(req("DELETE"), params)).status).toBe(204);
  });
});

describe("token de agente em /api/users → 403 mesmo com todos os escopos", () => {
  beforeEach(() => db.apiToken.findUnique.mockResolvedValue(tokenRecord(ALL_SCOPES)));
  const url = "http://x/api/users";
  it.each([
    ["GET", () => GET(withBearer(url))],
    ["POST", () => POST(withBearer(url, { method: "POST", body: "{}" }))],
    ["PUT", () => PUT(withBearer(url, { method: "PUT", body: "{}" }), params)],
    ["DELETE", () => DELETE(withBearer(url, { method: "DELETE" }), params)],
    ["change-password", () => CHANGE_PASSWORD(withBearer(url, { method: "PUT", body: "{}" }))],
  ])("%s", async (_, call) => {
    expect((await call()).status).toBe(403);
    expect(auth).not.toHaveBeenCalled();
  });
});
