import { beforeEach, describe, expect, it, vi } from "vitest";

const { db, auth } = vi.hoisted(() => ({
  db: {
    conference: { create: vi.fn(), count: vi.fn(), findMany: vi.fn() },
    lifecycleEvent: { createMany: vi.fn() },
    user: { findUnique: vi.fn() },
    uM: { findUnique: vi.fn(), findMany: vi.fn() },
    conferenceItem: { findMany: vi.fn() },
    notebook: { findMany: vi.fn() },
  },
  auth: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({ prisma: db }));
vi.mock("@/lib/auth", () => ({ auth }));
vi.mock("@/lib/rate-limit", () => ({
  rateLimitByIp: () => ({ allowed: true }),
  rateLimitByActor: () => ({ allowed: true }),
}));

import { checkConferenceShape, computeCoverage, saoPauloDayRange } from "@/lib/services/conference.service";
import { POST } from "@/app/api/conferences/route";
import { logger } from "@/lib/logger";
import { conferenceCounts, progressoPorCategoria, statusPorMeta } from "@/lib/meta-categoria";

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

  it("ITINERANTE: só ESCANEADO; aceita os dois status (conferido contra a meta depois)", () => {
    expect(
      checkConferenceShape(
        { status: "CONCLUIDO_OK", items: [{ notebookId: "n1", status: "FALTANTE" }], umFisicaId: "f1" },
        ITIN,
        FIXA,
      ),
    ).toMatch(/só envia/);
    expect(checkConferenceShape({ status: "CONCLUIDO_FALTANTES", items: esc, umFisicaId: "f1" }, ITIN, FIXA)).toBeNull();
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
      Promise.resolve(
        where.id === "itin" ? { ...ITIN, metas: [{ categoria: "INSTRUTOR", meta: 1 }, { categoria: "PEDAGOGA", meta: 1 }] } : FIXA,
      ),
    );
    db.notebook.findMany.mockResolvedValue([{ categoria: "INSTRUTOR" }]);
    db.conference.create.mockResolvedValue({ id: "c1", um: { tipo: "ITINERANTE" } });
    db.conference.findMany.mockResolvedValue([]);
  });

  it("grava umFisicaId e a meta da UM, e não consulta a meta diária", async () => {
    const res = await post({ ...body, status: "CONCLUIDO_FALTANTES" });
    expect(res.status).toBe(201);
    expect(db.user.findUnique).not.toHaveBeenCalled();
    const data = db.conference.create.mock.calls[0][0].data;
    expect(data.umFisicaId).toBe("fixa");
    expect(data.status).toBe("CONCLUIDO_FALTANTES");
    expect(data.metas.create).toEqual([
      { categoria: "INSTRUTOR", meta: 1 },
      { categoria: "PEDAGOGA", meta: 1 },
    ]);
  });

  it("status divergente da meta atual (meta mudou desde o scan): não rejeita, recalcula e loga", async () => {
    const warn = vi.spyOn(logger, "warn");
    const res = await post(body); // cliente diz OK, mas falta 1 pedagoga pela meta atual
    expect(res.status).toBe(201);
    expect(db.conference.create.mock.calls[0][0].data.status).toBe("CONCLUIDO_FALTANTES");
    expect(warn).toHaveBeenCalledWith(
      expect.stringMatching(/recalculado/),
      expect.objectContaining({ recebido: "CONCLUIDO_OK", gravado: "CONCLUIDO_FALTANTES" }),
    );
  });

  it("Telegram: UM física, lidos por categoria e cobertura do grupo", async () => {
    process.env.TELEGRAM_BOT_TOKEN = "t";
    process.env.TELEGRAM_CHAT_ID = "c";
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    db.conference.create.mockResolvedValue({
      id: "c1",
      umId: "itin",
      status: "CONCLUIDO_OK",
      dataInicio: new Date(NOW),
      dataFim: new Date(NOW),
      user: { nome: "Técnico" },
      um: { nome: "QDFM-PEDAGÓGICO", mouses: false, carregadores: false, fones: false, project: { nome: "QDFM", cor: "#000" } },
      umFisica: { nome: "QDFM01" },
      metas: [
        { categoria: "INSTRUTOR", meta: 2 },
        { categoria: "PEDAGOGA", meta: 1 },
      ],
      items: [
        { status: "ESCANEADO", notebook: { hostname: "QDFM-INSTR01", categoria: "INSTRUTOR" } },
        { status: "ESCANEADO", notebook: { hostname: "QDFM-PEDAG-A", categoria: "PEDAGOGA" } },
      ],
    });
    db.uM.findMany.mockResolvedValue([
      {
        id: "itin",
        nome: "QDFM-PEDAGÓGICO",
        project: { nome: "QDFM", cor: "#000" },
        notebooks: [
          { id: "i1", hostname: "QDFM-INSTR01", categoria: "INSTRUTOR" },
          { id: "p1", hostname: "QDFM-PEDAG-A", categoria: "PEDAGOGA" },
        ],
      },
    ]);
    db.conferenceItem.findMany.mockResolvedValue([
      { notebookId: "i1", conference: { umId: "itin" } },
      { notebookId: "i1", conference: { umId: "itin" } },
      { notebookId: "p1", conference: { umId: "itin" } },
    ]);
    expect((await post(body)).status).toBe(201);
    const text = JSON.parse(fetchMock.mock.calls[0][1].body).text as string;
    expect(text).toContain("UM física: QDFM01");
    expect(text).toContain("Meta: 3");
    expect(text).toContain("Dispositivos Escaneados: 2");
    expect(text).toContain("Dispositivos Faltantes: 1");
    expect(text).toContain("Instrutores 1/2 — falta 1");
    expect(text).not.toContain("Pedagoga 1/1");
    expect(text).toContain("Grupo: 1/2 com 2 leituras hoje");
    vi.unstubAllGlobals();
  });

  it("sem UM física → 400, nada gravado", async () => {
    const res = await post({ ...body, umFisicaId: undefined });
    expect(res.status).toBe(400);
    expect(db.conference.create).not.toHaveBeenCalled();
  });
});

describe("saoPauloDayRange", () => {
  it("23h30 em SP (02h30 UTC do dia seguinte) ainda é o dia anterior", () => {
    const { gte, lt } = saoPauloDayRange(new Date("2026-11-27T02:30:00Z"));
    expect(gte.toISOString()).toBe("2026-11-26T03:00:00.000Z");
    expect(lt.toISOString()).toBe("2026-11-27T03:00:00.000Z");
  });
});

describe("computeCoverage", () => {
  const nbs = [
    { id: "a", hostname: "A", categoria: "INSTRUTOR" as const },
    { id: "b", hostname: "B", categoria: "INSTRUTOR" as const },
    { id: "c", hostname: "C", categoria: "PEDAGOGA" as const },
  ];

  it("coberto = 2+ leituras no dia; pendentes trazem a contagem", () => {
    const r = computeCoverage(nbs, ["a", "a", "b", "a"]);
    expect(r.total).toBe(3);
    expect(r.cobertos).toBe(1);
    expect(r.pendentes.map((p) => [p.id, p.leituras])).toEqual([
      ["b", 1],
      ["c", 0],
    ]);
  });

  it("leitura de notebook fora da lista (ex.: em manutenção) não conta", () => {
    expect(computeCoverage(nbs, ["x", "x"]).cobertos).toBe(0);
  });

  it("sem notebooks: 0/0", () => {
    expect(computeCoverage([], [])).toEqual({ total: 0, cobertos: 0, pendentes: [] });
  });
});

describe("meta por categoria", () => {
  const metas = [
    { categoria: "INSTRUTOR" as const, meta: 5 },
    { categoria: "PEDAGOGA" as const, meta: 1 },
    { categoria: "COORDENADORA" as const, meta: 0 },
  ];

  it("falta = diferença por categoria; meta 0 é ignorada; leitura além da meta não vira negativo", () => {
    const p = progressoPorCategoria(metas, ["INSTRUTOR", "INSTRUTOR", "INSTRUTOR", "INSTRUTOR", "PEDAGOGA", "PEDAGOGA"]);
    expect(p).toEqual([
      { categoria: "INSTRUTOR", meta: 5, lidos: 4, falta: 1 },
      { categoria: "PEDAGOGA", meta: 1, lidos: 2, falta: 0 },
    ]);
    expect(statusPorMeta(p)).toBe("CONCLUIDO_FALTANTES");
    expect(statusPorMeta(p.map((x) => ({ ...x, falta: 0 })))).toBe("CONCLUIDO_OK");
  });

  it("conferenceCounts: itinerante lista uma linha por categoria incompleta", () => {
    const hosts = (cat: "INSTRUTOR" | "PEDAGOGA", n: number) =>
      Array.from({ length: n }, (_, i) => ({ status: "ESCANEADO", notebook: { hostname: `${cat}${i}`, categoria: cat } }));
    const c = conferenceCounts({ metas, items: [...hosts("INSTRUTOR", 4), ...hosts("PEDAGOGA", 1)] });
    expect(c).toMatchObject({ escaneados: 5, faltantes: 1, ativos: 6 });
    expect(c.faltantesList).toEqual([{ id: "INSTRUTOR", hostname: "Instrutores 4/5", detail: "falta 1" }]);
  });

  it("conferenceCounts: fixa continua contando itens FALTANTE", () => {
    const c = conferenceCounts({
      metas: [],
      items: [
        { status: "ESCANEADO", notebook: { hostname: "A" } },
        { status: "FALTANTE", notebook: { hostname: "B" } },
        { status: "MANUTENCAO", notebook: { hostname: "C" } },
      ],
    });
    expect(c).toMatchObject({ escaneados: 1, faltantes: 1, manutencao: 1, ativos: 2 });
    expect(c.faltantesList).toEqual([{ id: "0", hostname: "B" }]);
  });
});
