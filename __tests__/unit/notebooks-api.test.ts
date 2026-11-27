import { beforeEach, describe, expect, it, vi } from "vitest";

const { db, auth } = vi.hoisted(() => ({
  db: {
    notebook: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    lifecycleEvent: { create: vi.fn() },
    uM: { findUnique: vi.fn(() => Promise.resolve({ tipo: "FIXA" })) },
    $transaction: vi.fn(),
  },
  auth: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({ prisma: db }));
vi.mock("@/lib/auth", () => ({ auth }));

import { Prisma } from "@/generated/prisma/client";
import { logger } from "@/lib/logger";
import { conflictResponse, NotebookConflictError } from "@/lib/services/notebook.service";
import { GET, POST } from "@/app/api/notebooks/route";

const prismaError = (code: string) =>
  new Prisma.PrismaClientKnownRequestError("x", { code, clientVersion: "test" });

const post = (body: unknown) =>
  POST(new Request("http://x/api/notebooks", { method: "POST", body: JSON.stringify(body) }));

const valid = { hostname: "BSBIA01-EST01", umId: "um1", status: "ATIVO" };

beforeEach(() => {
  vi.resetAllMocks();
  db.$transaction.mockImplementation((fn: (tx: typeof db) => unknown) => fn(db));
  auth.mockResolvedValue({ user: { id: "admin1", role: "ADMIN" } });
  db.notebook.findMany.mockResolvedValue([]);
  db.notebook.findUnique.mockResolvedValue(null);
});

describe("conflictResponse", () => {
  it("P2002 → 409 de hostname duplicado", async () => {
    const res = conflictResponse(prismaError("P2002"))!;
    expect(res.status).toBe(409);
    expect((await res.json()).message).toMatch(/hostname/);
  });

  it("P2003 → 409 de histórico ganho durante a operação", async () => {
    const res = conflictResponse(prismaError("P2003"))!;
    expect(res.status).toBe(409);
    expect((await res.json()).message).toMatch(/histórico/);
  });

  it("conflito de domínio → 409 com code e dados", async () => {
    const res = conflictResponse(new NotebookConflictError("m", "C", { extra: 1 }))!;
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ message: "m", code: "C", extra: 1 });
  });

  it("erro desconhecido ou outro código Prisma → null (a rota responde 500)", () => {
    expect(conflictResponse(new Error("boom"))).toBeNull();
    expect(conflictResponse(prismaError("P2025"))).toBeNull();
  });
});

describe("GET /api/notebooks", () => {
  it("sem sessão → 401", async () => {
    auth.mockResolvedValue(null);
    expect((await GET(new Request("http://x/api/notebooks"))).status).toBe(401);
  });

  it("sem flag exclui ARQUIVADO; com includeArchived=1 e umId inclui", async () => {
    await GET(new Request("http://x/api/notebooks"));
    expect(db.notebook.findMany.mock.calls[0][0].where).toEqual({ status: { not: "ARQUIVADO" } });

    await GET(new Request("http://x/api/notebooks?umId=um1&includeArchived=1"));
    expect(db.notebook.findMany.mock.calls[1][0].where).toEqual({ umId: "um1" });
  });
});

describe("POST /api/notebooks", () => {
  it("sem sessão → 401", async () => {
    auth.mockResolvedValue(null);
    expect((await post(valid)).status).toBe(401);
  });

  it("técnico (USER) → 403", async () => {
    auth.mockResolvedValue({ user: { id: "u", role: "USER" } });
    expect((await post(valid)).status).toBe(403);
  });

  it("body inválido e sufixo ~arq- reservado → 400", async () => {
    expect((await post({ umId: "um1" })).status).toBe(400);
    expect((await post({ ...valid, hostname: "X~arq-20261125" })).status).toBe(400);
  });

  it("cria → 201", async () => {
    db.notebook.create.mockResolvedValue({ id: "n1" });
    const res = await post(valid);
    expect(res.status).toBe(201);
    expect(db.notebook.create).toHaveBeenCalled();
  });

  it("hostname ativo existente → 409", async () => {
    db.notebook.findUnique.mockResolvedValue({ id: "n0" });
    const res = await post(valid);
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("ACTIVE_EXISTS");
  });

  describe("hostname de arquivado", () => {
    beforeEach(() => {
      db.notebook.findMany.mockResolvedValue([
        { id: "arq1", hostname: "BSBIA01-EST01~arq-20261125", um: { nome: "UM 1" } },
      ]);
    });

    it("sem decisão → 409 ARCHIVED_MATCH", async () => {
      const res = await post(valid);
      expect(res.status).toBe(409);
      expect(await res.json()).toMatchObject({
        code: "ARCHIVED_MATCH",
        archived: { id: "arq1", hostname: "BSBIA01-EST01", umNome: "UM 1" },
      });
    });

    it('onArchived "reactivate" → 201 reativando o mesmo registro', async () => {
      db.notebook.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
      db.notebook.update.mockResolvedValue({ id: "arq1" });
      const res = await post({ ...valid, onArchived: "reactivate" });
      expect(res.status).toBe(201);
      expect(db.notebook.update.mock.calls[0][0].where).toEqual({ id: "arq1" });
      expect(db.lifecycleEvent.create).toHaveBeenCalled();
    });

    it('onArchived "new" → 201 criando outro registro', async () => {
      db.notebook.create.mockResolvedValue({ id: "n2" });
      const res = await post({ ...valid, onArchived: "new" });
      expect(res.status).toBe(201);
      expect(db.notebook.update).not.toHaveBeenCalled();
    });
  });

  it("corrida com P2002 no create → 409", async () => {
    db.notebook.create.mockRejectedValue(prismaError("P2002"));
    expect((await post(valid)).status).toBe(409);
  });

  it("erro inesperado → 500 e captureException", async () => {
    const capture = vi.spyOn(logger, "captureException").mockImplementation(() => {});
    db.notebook.create.mockRejectedValue(new Error("db down"));
    expect((await post(valid)).status).toBe(500);
    expect(capture).toHaveBeenCalled();
  });
});
