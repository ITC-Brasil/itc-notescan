import { beforeEach, describe, expect, it, vi } from "vitest";

// Matriz de acesso m8-01, lote 3b: escrita no catálogo com write:catalog e AuditLog
// em projetos e UMs (humanos e agentes).
const { db, auth, svc } = vi.hoisted(() => {
  const db = {
    apiToken: { findUnique: vi.fn(), update: vi.fn() },
    notebook: { findUnique: vi.fn(), update: vi.fn(), groupBy: vi.fn() },
    lifecycleEvent: { create: vi.fn() },
    project: { create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    uM: { create: vi.fn(), update: vi.fn(), delete: vi.fn(), count: vi.fn() },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn(),
  };
  return {
    db,
    auth: vi.fn(),
    svc: {
      createNotebook: vi.fn(),
      createNotebooksBulk: vi.fn(),
      removeNotebooks: vi.fn(),
      conflictResponse: vi.fn(() => null),
    },
  };
});
vi.mock("@/lib/db/prisma", () => ({ prisma: db }));
vi.mock("@/lib/auth", () => ({ auth }));
vi.mock("@/lib/services/notebook.service", () => svc);

import { POST as notebookCreate } from "@/app/api/notebooks/route";
import { POST as bulkDelete } from "@/app/api/notebooks/bulk-delete/route";
import { POST as notebookBatch } from "@/app/api/notebooks/batch/route";
import { POST as notebookImport } from "@/app/api/notebooks/import/route";
import { DELETE as notebookDelete, PUT as notebookUpdate } from "@/app/api/notebooks/[id]/route";
import { POST as projectCreate } from "@/app/api/projects/route";
import { DELETE as projectDelete, PUT as projectUpdate } from "@/app/api/projects/[id]/route";
import { POST as umCreate } from "@/app/api/ums/route";
import { DELETE as umDelete, PUT as umUpdate } from "@/app/api/ums/[id]/route";
import { ALL_SCOPES, invalidTokens, tokenRecord, TOKEN } from "./helpers/actor";

const params = { params: Promise.resolve({ id: "x1" }) };
const URL_ = "http://x/api/x";
const nb = { hostname: "BSBIA01-EST01", umId: "um1", status: "ATIVO" };
const project = { nome: "Brasil.IA", cor: "#00AACC" };
const um = { nome: "UM 1", projectId: "p1", quantidadeEsperada: 106 };

const routes = [
  ["POST /api/notebooks", nb, (r: Request) => notebookCreate(r)],
  ["POST /api/notebooks/batch", { prefix: "BSBIA01-EST", start: 1, end: 3, umId: "um1" }, (r: Request) => notebookBatch(r)],
  ["POST /api/notebooks/import", { umId: "um1", rows: [{ hostname: "BSBIA01-EST01" }] }, (r: Request) => notebookImport(r)],
  ["PUT /api/notebooks/[id]", nb, (r: Request) => notebookUpdate(r, params)],
  ["POST /api/projects", project, (r: Request) => projectCreate(r)],
  ["PUT /api/projects/[id]", project, (r: Request) => projectUpdate(r, params)],
  ["POST /api/ums", um, (r: Request) => umCreate(r)],
  ["PUT /api/ums/[id]", um, (r: Request) => umUpdate(r, params)],
] as const;

const req = (body: unknown, bearer = false) =>
  new Request(URL_, {
    method: "POST",
    body: JSON.stringify(body),
    headers: bearer ? { authorization: `Bearer ${TOKEN}` } : {},
  });

beforeEach(() => {
  vi.clearAllMocks();
  auth.mockResolvedValue(null);
  db.apiToken.findUnique.mockResolvedValue(null);
  db.$transaction.mockImplementation((arg: unknown) =>
    typeof arg === "function" ? arg(db) : Promise.all(arg as Promise<unknown>[]),
  );
  db.notebook.findUnique.mockResolvedValue({ status: "ATIVO" });
  db.notebook.update.mockResolvedValue({ id: "x1" });
  for (const m of [db.project, db.uM]) {
    m.create.mockImplementation(({ data }) => Promise.resolve({ id: "new1", ...data }));
    m.update.mockImplementation(({ data }) => Promise.resolve({ id: "x1", ...data }));
  }
  svc.createNotebook.mockResolvedValue({ id: "n1" });
  svc.removeNotebooks.mockResolvedValue({ archived: 1, deleted: 0 });
  db.project.delete.mockResolvedValue({ id: "x1", nome: "P", cor: "#000000" });
  db.uM.delete.mockResolvedValue({ id: "x1", nome: "UM", projectId: "p1" });
  db.uM.count.mockResolvedValue(0);
  db.notebook.groupBy.mockResolvedValue([]);
  svc.createNotebooksBulk.mockResolvedValue({ created: 1 });
});

describe.each(routes)("%s (3b: write:catalog)", (_, body, call) => {
  it("token com write:catalog → 2xx", async () => {
    db.apiToken.findUnique.mockResolvedValue(tokenRecord(["write:catalog"]));
    const res = await call(req(body, true));
    expect(res.status).toBeLessThan(300);
    expect(auth).not.toHaveBeenCalled();
  });

  it("token sem write:catalog → 403", async () => {
    db.apiToken.findUnique.mockResolvedValue(
      tokenRecord(["read:catalog", "delete:catalog", "destructive"]),
    );
    expect((await call(req(body, true))).status).toBe(403);
  });

  it.each(Object.entries(invalidTokens))("token %s → 401", async (_k, rec) => {
    db.apiToken.findUnique.mockResolvedValue(rec === null ? null : rec());
    auth.mockResolvedValue({ user: { id: "m1", role: "MASTER" } });
    expect((await call(req(body, true))).status).toBe(401);
  });

  it("sessão humana inalterada: USER 403, ADMIN 2xx, sem sessão 401", async () => {
    auth.mockResolvedValue({ user: { id: "u1", role: "USER" } });
    expect((await call(req(body))).status).toBe(403);
    auth.mockResolvedValue({ user: { id: "a1", role: "ADMIN" } });
    expect((await call(req(body))).status).toBeLessThan(300);
    auth.mockResolvedValue(null);
    expect((await call(req(body))).status).toBe(401);
  });
});

describe("AuditLog em projetos e UMs", () => {
  const audited = () => db.auditLog.create.mock.calls.map((c) => c[0].data);

  it.each([
    ["Project", "CRIADO", "new1", () => projectCreate(req(project, true))],
    ["Project", "EDITADO", "x1", () => projectUpdate(req(project, true), params)],
    ["UM", "CRIADO", "new1", () => umCreate(req(um, true))],
    ["UM", "EDITADO", "x1", () => umUpdate(req(um, true), params)],
  ])("agente: %s %s grava actor e tokenId", async (entidade, acao, entidadeId, call) => {
    db.apiToken.findUnique.mockResolvedValue(tokenRecord(ALL_SCOPES));
    await call();
    expect(audited()).toEqual([
      expect.objectContaining({ entidade, acao, entidadeId, actorId: "ag1", tokenId: "tok1" }),
    ]);
  });

  it("humano também é auditado (tokenId null), com o payload validado", async () => {
    auth.mockResolvedValue({ user: { id: "m1", role: "MASTER" } });
    await projectCreate(req({ ...project, extra: "ignorado" }));
    expect(audited()).toEqual([
      expect.objectContaining({ actorId: "m1", tokenId: null, payload: project }),
    ]);
  });

  it("falha no AuditLog derruba a escrita (mesma transação)", async () => {
    auth.mockResolvedValue({ user: { id: "m1", role: "MASTER" } });
    db.auditLog.create.mockRejectedValueOnce(new Error("audit down"));
    expect((await umCreate(req(um))).status).toBe(500);
  });

  it("notebooks não usam AuditLog (LifecycleEvent cobre)", async () => {
    db.apiToken.findUnique.mockResolvedValue(tokenRecord(ALL_SCOPES));
    await notebookCreate(req(nb, true));
    expect(svc.createNotebook).toHaveBeenCalledWith(expect.anything(), "ag1", undefined);
    expect(db.auditLog.create).not.toHaveBeenCalled();
  });
});

describe("rate limit de escrita por tipo de ator", () => {
  it("token: 31ª escrita no minuto → 429", async () => {
    db.apiToken.findUnique.mockResolvedValue(tokenRecord(["write:catalog"], { userId: "rl-agent" }));
    for (let i = 0; i < 30; i++) expect((await projectCreate(req(project, true))).status).toBe(201);
    const res = await projectCreate(req(project, true));
    expect(res.status).toBe(429);
    expect((await res.json()).message).toBe("Muitas requisições, aguarde alguns segundos");
  });

  it("sessão humana: 120 escritas passam, a 121ª → 429", async () => {
    auth.mockResolvedValue({ user: { id: "rl-admin", role: "ADMIN" } });
    for (let i = 0; i < 120; i++) expect((await projectCreate(req(project))).status).toBe(201);
    expect((await projectCreate(req(project))).status).toBe(429);
  });
});

describe("regras de negócio das escritas (sessão ADMIN)", () => {
  beforeEach(() => auth.mockResolvedValue({ user: { id: "a1", role: "ADMIN" } }));

  it("body inválido → 400 em todas as rotas", async () => {
    for (const [, , call] of routes) expect((await call(req({}))).status).toBe(400);
  });

  it("lote com fim < início → 400", async () => {
    const res = await notebookBatch(req({ prefix: "P", start: 5, end: 2, umId: "um1" }));
    expect(res.status).toBe(400);
  });

  it("lote gera hostnames com zero à esquerda só de 1 a 9", async () => {
    await notebookBatch(req({ prefix: "P-", start: 9, end: 10, umId: "um1" }));
    expect(svc.createNotebooksBulk.mock.calls[0][0]).toEqual([{ hostname: "P-09" }, { hostname: "P-10" }]);
  });

  it("conflito do serviço vira a resposta dele; erro inesperado → 500", async () => {
    svc.conflictResponse.mockReturnValueOnce(Response.json({}, { status: 409 }) as never);
    svc.createNotebooksBulk.mockRejectedValueOnce(new Error("dup"));
    expect((await notebookImport(req({ umId: "um1", rows: [{ hostname: "A-01" }] }))).status).toBe(409);
    svc.createNotebook.mockRejectedValueOnce(new Error("db"));
    expect((await notebookCreate(req(nb))).status).toBe(500);
  });

  it("PUT notebook: 404, arquivado 409, troca de status gera LifecycleEvent", async () => {
    db.notebook.findUnique.mockResolvedValueOnce(null);
    expect((await notebookUpdate(req(nb), params)).status).toBe(404);
    db.notebook.findUnique.mockResolvedValueOnce({ status: "ARQUIVADO" });
    expect((await notebookUpdate(req(nb), params)).status).toBe(409);
    await notebookUpdate(req({ ...nb, status: "MANUTENCAO" }), params);
    expect(db.lifecycleEvent.create.mock.calls[0][0].data).toMatchObject({ userId: "a1", tipo: "Manutenção" });
  });

  it("PUT de projeto/UM com erro no banco → 500", async () => {
    db.project.update.mockRejectedValueOnce(new Error("db"));
    expect((await projectUpdate(req(project), params)).status).toBe(500);
    db.uM.update.mockRejectedValueOnce(new Error("db"));
    expect((await umUpdate(req(um), params)).status).toBe(500);
  });
});

// Exclusões: o comportamento humano é o mesmo de antes do 3c/3d.
describe("exclusões — sessão humana", () => {
  const del = () => new Request(URL_, { method: "DELETE" });

  it("sem sessão 401; USER 403", async () => {
    for (const call of [() => notebookDelete(del(), params), () => projectDelete(del(), params), () => umDelete(del(), params)]) {
      auth.mockResolvedValueOnce(null);
      expect((await call()).status).toBe(401);
      auth.mockResolvedValueOnce({ user: { id: "u1", role: "USER" } });
      expect((await call()).status).toBe(403);
    }
  });

  describe("ADMIN", () => {
    beforeEach(() => auth.mockResolvedValue({ user: { id: "a1", role: "ADMIN" } }));

    it("notebook: 404, já arquivado 409, arquiva ou exclui", async () => {
      db.notebook.findUnique.mockResolvedValueOnce(null);
      expect((await notebookDelete(del(), params)).status).toBe(404);
      db.notebook.findUnique.mockResolvedValueOnce({ status: "ARQUIVADO" });
      expect((await notebookDelete(del(), params)).status).toBe(409);
      svc.removeNotebooks.mockResolvedValueOnce({ archived: 1 });
      expect(await (await notebookDelete(del(), params)).json()).toEqual({ action: "archived" });
      svc.removeNotebooks.mockResolvedValueOnce({ archived: 0 });
      expect(await (await notebookDelete(del(), params)).json()).toEqual({ action: "deleted" });
      svc.removeNotebooks.mockRejectedValueOnce(new Error("db"));
      expect((await notebookDelete(del(), params)).status).toBe(500);
    });

    it("projeto: com UMs 409; sem UMs 204; erro 500", async () => {
      db.uM.count.mockResolvedValueOnce(2);
      expect((await projectDelete(del(), params)).status).toBe(409);
      db.uM.count.mockResolvedValue(0);
      expect((await projectDelete(del(), params)).status).toBe(204);
      db.project.delete.mockRejectedValueOnce(new Error("db"));
      expect((await projectDelete(del(), params)).status).toBe(500);
    });

    it("UM: com notebooks 409 (mensagem própria para só arquivados); vazia 204; erro 500", async () => {
      db.notebook.groupBy.mockResolvedValueOnce([{ status: "ATIVO" }]);
      expect((await (await umDelete(del(), params)).json()).message).toMatch(/notebooks associados/);
      db.notebook.groupBy.mockResolvedValueOnce([{ status: "ARQUIVADO" }]);
      expect((await (await umDelete(del(), params)).json()).message).toMatch(/arquivados/);
      db.notebook.groupBy.mockResolvedValue([]);
      expect((await umDelete(del(), params)).status).toBe(204);
      db.uM.delete.mockRejectedValueOnce(new Error("db"));
      expect((await umDelete(del(), params)).status).toBe(500);
    });
  });
});

describe("3c/3d — exclusões por token", () => {
  const del = (bearer = true) =>
    new Request(URL_, { method: "DELETE", headers: bearer ? { authorization: `Bearer ${TOKEN}` } : {} });
  const bulk = (bearer = true) =>
    new Request(URL_, {
      method: "POST",
      body: JSON.stringify({ umId: "um1" }),
      headers: bearer ? { authorization: `Bearer ${TOKEN}` } : {},
    });
  const withScopes = (scopes: Parameters<typeof tokenRecord>[0]) =>
    db.apiToken.findUnique.mockResolvedValue(tokenRecord(scopes));

  it("3c: arquivar notebook exige delete:catalog", async () => {
    withScopes(["read:catalog", "write:catalog", "destructive"]);
    expect((await notebookDelete(del(), params)).status).toBe(403);
    withScopes(["delete:catalog"]);
    expect((await notebookDelete(del(), params)).status).toBe(200);
    expect(svc.removeNotebooks).toHaveBeenCalledWith({ id: "x1" }, "ag1");
  });

  const destructive = [
    ["POST /api/notebooks/bulk-delete", (b?: boolean) => bulkDelete(bulk(b))],
    ["DELETE /api/projects/[id]", (b?: boolean) => projectDelete(del(b), params)],
    ["DELETE /api/ums/[id]", (b?: boolean) => umDelete(del(b), params)],
  ] as const;

  describe.each(destructive)("3d: %s", (_, call) => {
    it.each([
      [["delete:catalog"]],
      [["destructive"]],
      [["read:catalog", "write:catalog"]],
    ] as const)("só %j → 403", async (scopes) => {
      withScopes([...scopes]);
      expect((await call()).status).toBe(403);
      expect(svc.removeNotebooks).not.toHaveBeenCalled();
      expect(db.project.delete).not.toHaveBeenCalled();
      expect(db.uM.delete).not.toHaveBeenCalled();
    });

    it("delete:catalog + destructive → 2xx", async () => {
      withScopes(["delete:catalog", "destructive"]);
      expect((await call()).status).toBeLessThan(300);
    });

    it.each(Object.entries(invalidTokens))("token %s → 401", async (_k, rec) => {
      db.apiToken.findUnique.mockResolvedValue(rec === null ? null : rec());
      auth.mockResolvedValue({ user: { id: "m1", role: "MASTER" } });
      expect((await call()).status).toBe(401);
    });

    it("sessão humana inalterada: USER 403, ADMIN 2xx", async () => {
      auth.mockResolvedValue({ user: { id: "u1", role: "USER" } });
      expect((await call(false)).status).toBe(403);
      auth.mockResolvedValue({ user: { id: "a1", role: "ADMIN" } });
      expect((await call(false)).status).toBeLessThan(300);
    });
  });

  it("exclusão de projeto e de UM grava AuditLog EXCLUIDO com tokenId", async () => {
    withScopes(["delete:catalog", "destructive"]);
    await projectDelete(del(), params);
    await umDelete(del(), params);
    expect(db.auditLog.create.mock.calls.map((c) => c[0].data)).toEqual([
      expect.objectContaining({ entidade: "Project", acao: "EXCLUIDO", entidadeId: "x1", tokenId: "tok1", payload: { nome: "P", cor: "#000000" } }),
      expect.objectContaining({ entidade: "UM", acao: "EXCLUIDO", entidadeId: "x1", tokenId: "tok1", payload: { nome: "UM", projectId: "p1" } }),
    ]);
  });

  it("humano também é auditado na exclusão", async () => {
    auth.mockResolvedValue({ user: { id: "m1", role: "MASTER" } });
    await umDelete(del(false), params);
    expect(db.auditLog.create.mock.calls[0][0].data).toMatchObject({ actorId: "m1", tokenId: null, acao: "EXCLUIDO" });
  });

  it("bulk-delete: body inválido 400; conflito do serviço; erro 500", async () => {
    auth.mockResolvedValue({ user: { id: "a1", role: "ADMIN" } });
    const bad = new Request(URL_, { method: "POST", body: "{}" });
    expect((await bulkDelete(bad)).status).toBe(400);
    svc.removeNotebooks.mockRejectedValueOnce(new Error("x"));
    svc.conflictResponse.mockReturnValueOnce(Response.json({}, { status: 409 }) as never);
    expect((await bulkDelete(bulk(false))).status).toBe(409);
    svc.removeNotebooks.mockRejectedValueOnce(new Error("db"));
    expect((await bulkDelete(bulk(false))).status).toBe(500);
  });
});
