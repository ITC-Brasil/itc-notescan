import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { db, auth } = vi.hoisted(() => ({
  db: {
    conference: { create: vi.fn(), count: vi.fn(), findMany: vi.fn() },
    lifecycleEvent: { createMany: vi.fn() },
    user: { findUnique: vi.fn() },
  },
  auth: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({ prisma: db }));
vi.mock("@/lib/auth", () => ({ auth }));
vi.mock("@/lib/rate-limit", () => ({
  rateLimitByIp: () => ({ allowed: true }),
  rateLimitByActor: () => ({ allowed: true }),
}));

import { logger } from "@/lib/logger";
import { GET, POST } from "@/app/api/conferences/route";

const NOW = new Date("2026-11-25T13:00:00Z");

const body = {
  umId: "um1",
  dataInicio: NOW.toISOString(),
  dataFim: NOW.toISOString(),
  status: "CONCLUIDO_FALTANTES",
  items: [
    { notebookId: "n1", status: "ESCANEADO" },
    { notebookId: "n2", status: "FALTANTE" },
    { notebookId: "n3", status: "MANUTENCAO" },
    { notebookId: "n1", status: "ESCANEADO" }, // duplicado: deduplicado na rota
  ],
};

const created = {
  id: "conf1",
  status: "CONCLUIDO_FALTANTES",
  dataInicio: NOW,
  dataFim: NOW,
  localizacao: "-15.7,-47.8",
  mousesQtd: 3,
  carregadoresQtd: null,
  fonesQtd: 1,
  user: { nome: "Técnico" },
  um: { nome: "UM 1", mouses: true, carregadores: true, fones: true, project: { nome: "BSBIA", cor: "#000" } },
  items: [
    { status: "ESCANEADO", notebook: { hostname: "BSBIA01-EST01" } },
    { status: "FALTANTE", notebook: { hostname: "BSBIA01-EST02~arq-20261125" } },
    { status: "MANUTENCAO", notebook: { hostname: "BSBIA01-EST03~arq-20261125-2" } },
  ],
};

const post = (headers: Record<string, string> = { "x-sync-replay": "1" }, b: unknown = body) =>
  POST(new Request("http://x/api/conferences", { method: "POST", headers, body: JSON.stringify(b) }));

let warn: ReturnType<typeof vi.spyOn>;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.resetAllMocks();
  process.env.TELEGRAM_BOT_TOKEN = "t";
  process.env.TELEGRAM_CHAT_ID = "c";
  auth.mockResolvedValue({ user: { id: "tec1", role: "USER" } });
  db.conference.create.mockResolvedValue(created);
  warn = vi.spyOn(logger, "warn").mockImplementation(() => {});
  fetchMock = vi.fn().mockResolvedValue({ ok: true });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  warn.mockRestore();
});

const sentText = () => JSON.parse(fetchMock.mock.calls[0][1].body).text as string;

describe("notifyTelegram", () => {
  it("mensagem com periféricos, mapa e listas de faltantes/manutenção pelo hostname original", async () => {
    expect((await post()).status).toBe(201);
    const text = sentText();
    expect(text).toContain("Mouses: 3");
    expect(text).toContain("Carregadores: 0");
    expect(text).toContain("Ver no Mapa");
    expect(text).toContain("*Lista de Faltantes:*\n\\- BSBIA01\\-EST02");
    expect(text).toContain("*Lista em Manutenção:*\n\\- BSBIA01\\-EST03");
    expect(text).not.toContain("arq");
    expect(text).toContain("INCOMPLETO");
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("duplicados"), expect.anything());
  });

  it("conferência OK sem periféricos nem localização", async () => {
    db.conference.create.mockResolvedValue({
      ...created,
      status: "CONCLUIDO_OK",
      localizacao: null,
      um: { ...created.um, mouses: false, carregadores: false, fones: false },
      items: [created.items[0]],
    });
    await post();
    const text = sentText();
    expect(text).toContain("Não informado");
    expect(text).toContain("COMPLETO 🟢");
    expect(text).not.toContain("Periféricos");
    expect(text).not.toContain("Lista");
  });

  it("config ausente → warn só com presença { bot, chatId }, sem fetch", async () => {
    delete process.env.TELEGRAM_CHAT_ID;
    await post();
    expect(warn).toHaveBeenCalledWith("Telegram não configurado", { bot: true, chatId: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("resposta !ok → warn com status e body; conferência segue 201", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 400, text: async () => "Bad Request: can't parse" });
    expect((await post()).status).toBe(201);
    expect(warn).toHaveBeenCalledWith("Telegram notification rejected", {
      status: 400,
      body: "Bad Request: can't parse",
    });
  });

  it("fetch lança → warn com o erro; conferência segue 201", async () => {
    fetchMock.mockRejectedValue(new Error("ECONNRESET"));
    expect((await post()).status).toBe(201);
    expect(warn).toHaveBeenCalledWith("Telegram notification failed", { error: "Error: ECONNRESET" });
  });
});

describe("POST /api/conferences", () => {
  it("sem sessão → 401; role não humana → 401; body inválido → 400", async () => {
    auth.mockResolvedValueOnce(null);
    expect((await post()).status).toBe(401);
    auth.mockResolvedValueOnce({ user: { id: "x", role: "BOT" } });
    expect((await post()).status).toBe(401);
    expect((await post(undefined, { umId: "um1" })).status).toBe(400);
  });

  it("meta diária atingida → 409 META_REACHED (envio interativo)", async () => {
    db.user.findUnique.mockResolvedValue({ metaDiaria: 2 });
    db.conference.count.mockResolvedValue(2);
    const res = await post({});
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("META_REACHED");
    expect(db.conference.create).not.toHaveBeenCalled();
  });

  it("abaixo da meta, ou sem meta, grava (201)", async () => {
    db.user.findUnique.mockResolvedValueOnce({ metaDiaria: 2 }).mockResolvedValueOnce(null);
    db.conference.count.mockResolvedValue(1);
    expect((await post({})).status).toBe(201);
    expect((await post({})).status).toBe(201);
  });

  it("X-Sync-Replay é isento da meta", async () => {
    expect((await post()).status).toBe(201);
    expect(db.user.findUnique).not.toHaveBeenCalled();
  });

  it("erro no banco → 500", async () => {
    vi.spyOn(logger, "captureException").mockImplementation(() => {});
    db.conference.create.mockRejectedValue(new Error("db down"));
    expect((await post()).status).toBe(500);
  });
});

describe("GET /api/conferences", () => {
  it("401 sem sessão e para role não humana", async () => {
    auth.mockResolvedValueOnce(null);
    expect((await GET(new Request("http://x/api/conferences"))).status).toBe(401);
    auth.mockResolvedValueOnce({ user: { id: "x", role: "BOT" } });
    expect((await GET(new Request("http://x/api/conferences"))).status).toBe(401);
  });

  it("USER só vê as próprias; ADMIN aplica filtros", async () => {
    db.conference.findMany.mockResolvedValue([]);
    await GET(new Request("http://x/api/conferences?userId=outro"));
    expect(db.conference.findMany.mock.calls[0][0].where.userId).toBe("tec1");

    auth.mockResolvedValue({ user: { id: "a", role: "ADMIN" } });
    await GET(
      new Request("http://x/api/conferences?umId=um1&status=CONCLUIDO_OK&from=2026-11-01&to=2026-11-30&limit=500"),
    );
    const args = db.conference.findMany.mock.calls[1][0];
    expect(args.take).toBe(100);
    expect(args.where).toMatchObject({ umId: "um1", status: "CONCLUIDO_OK" });
    expect(args.where.dataInicio.gte).toBeInstanceOf(Date);

    await GET(new Request("http://x/api/conferences?to=2026-11-30"));
    expect(db.conference.findMany.mock.calls[2][0].where.dataInicio.gte).toBeUndefined();
  });
});
