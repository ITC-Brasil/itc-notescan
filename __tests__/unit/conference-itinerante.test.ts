import { beforeEach, describe, expect, it, vi } from "vitest";

const { db, auth } = vi.hoisted(() => ({
  db: {
    conference: { create: vi.fn(), count: vi.fn(), findMany: vi.fn() },
    lifecycleEvent: { createMany: vi.fn() },
    user: { findUnique: vi.fn() },
    uM: { findUnique: vi.fn() },
  },
  auth: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({ prisma: db }));
vi.mock("@/lib/auth", () => ({ auth }));
vi.mock("@/lib/rate-limit", () => ({
  rateLimitByIp: () => ({ allowed: true }),
  rateLimitByActor: () => ({ allowed: true }),
}));

import { checkConferenceShape } from "@/lib/services/conference.service";
import { POST } from "@/app/api/conferences/route";

const FIXA = { tipo: "FIXA" as const, projectId: "p1" };
const ITIN = { tipo: "ITINERANTE" as const, projectId: "p1" };
const esc = [{ notebookId: "n1", status: "ESCANEADO" as const }];

describe("checkConferenceShape", () => {
  it("FIXA: status coerente com os itens", () => {
    expect(checkConferenceShape({ status: "CONCLUIDO_OK", items: esc }, FIXA, null)).toBeNull();
    expect(
      checkConferenceShape(
        { status: "CONCLUIDO_OK", items: [...esc, { notebookId: "n2", status: "FALTANTE" }] },
        FIXA,
        null,
      ),
    ).toMatch(/inconsistente/);
    expect(checkConferenceShape({ status: "CONCLUIDO_FALTANTES", items: esc }, FIXA, null)).toMatch(/inconsistente/);
  });

  it("FIXA: umFisicaId rejeitado", () => {
    expect(checkConferenceShape({ status: "CONCLUIDO_OK", items: esc, umFisicaId: "f1" }, FIXA, FIXA)).toMatch(
      /não aceita/,
    );
  });

  it("ITINERANTE: exige UM física FIXA do mesmo projeto", () => {
    expect(checkConferenceShape({ status: "CONCLUIDO_OK", items: esc }, ITIN, null)).toMatch(/exige/);
    expect(checkConferenceShape({ status: "CONCLUIDO_OK", items: esc, umFisicaId: "f1" }, ITIN, null)).toMatch(
      /não encontrada/,
    );
    expect(checkConferenceShape({ status: "CONCLUIDO_OK", items: esc, umFisicaId: "f1" }, ITIN, ITIN)).toMatch(
      /fixa/,
    );
    expect(
      checkConferenceShape({ status: "CONCLUIDO_OK", items: esc, umFisicaId: "f1" }, ITIN, { ...FIXA, projectId: "p2" }),
    ).toMatch(/mesmo projeto/);
    expect(checkConferenceShape({ status: "CONCLUIDO_OK", items: esc, umFisicaId: "f1" }, ITIN, FIXA)).toBeNull();
  });

  it("ITINERANTE: só ESCANEADO e CONCLUIDO_OK", () => {
    expect(
      checkConferenceShape(
        { status: "CONCLUIDO_OK", items: [{ notebookId: "n1", status: "FALTANTE" }], umFisicaId: "f1" },
        ITIN,
        FIXA,
      ),
    ).toMatch(/só envia/);
    expect(
      checkConferenceShape({ status: "CONCLUIDO_FALTANTES", items: esc, umFisicaId: "f1" }, ITIN, FIXA),
    ).toMatch(/sempre/);
  });
});

describe("POST /api/conferences — itinerante", () => {
  const NOW = new Date().toISOString();
  const body = { umId: "itin", umFisicaId: "fixa", dataInicio: NOW, dataFim: NOW, status: "CONCLUIDO_OK", items: esc };
  const post = (b: unknown) => POST(new Request("http://x/api/conferences", { method: "POST", body: JSON.stringify(b) }));

  beforeEach(() => {
    vi.resetAllMocks();
    delete process.env.TELEGRAM_BOT_TOKEN;
    auth.mockResolvedValue({ user: { id: "tec1", role: "USER" } });
    db.uM.findUnique.mockImplementation(({ where }: { where: { id: string } }) =>
      Promise.resolve(where.id === "itin" ? ITIN : FIXA),
    );
    db.conference.create.mockResolvedValue({ id: "c1", um: { tipo: "ITINERANTE" } });
    db.conference.findMany.mockResolvedValue([]);
  });

  it("grava umFisicaId e não consulta a meta diária", async () => {
    const res = await post(body);
    expect(res.status).toBe(201);
    expect(db.user.findUnique).not.toHaveBeenCalled();
    expect(db.conference.create.mock.calls[0][0].data.umFisicaId).toBe("fixa");
  });

  it("sem UM física → 400, nada gravado", async () => {
    const res = await post({ ...body, umFisicaId: undefined });
    expect(res.status).toBe(400);
    expect(db.conference.create).not.toHaveBeenCalled();
  });
});
