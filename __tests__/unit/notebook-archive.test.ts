import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

// ── Prisma fake: o mesmo objeto serve de client e de tx ──────────────────────
const { db, txOpts, auth } = vi.hoisted(() => {
  const db = {
    notebook: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      deleteMany: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
      createMany: vi.fn(),
      count: vi.fn(),
    },
    lifecycleEvent: { create: vi.fn(), createMany: vi.fn() },
    conference: { create: vi.fn(), count: vi.fn(), findMany: vi.fn() },
    user: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  };
  return { db, txOpts: [] as unknown[], auth: vi.fn() };
});

vi.mock("@/lib/db/prisma", () => ({ prisma: db }));
vi.mock("@/lib/auth", () => ({ auth }));
vi.mock("@/lib/rate-limit", () => ({ rateLimitByIp: () => ({ allowed: true }) }));
vi.mock("@/lib/offline/sync", () => ({ saveToOutbox: vi.fn() }));

import {
  archiveDateStamp,
  isReservedHostname,
  nextArchivedHostname,
  originalHostname,
} from "@/lib/notebook-hostname";
import {
  conflictResponse,
  createNotebook,
  createNotebooksBulk,
  NotebookConflictError,
  removeNotebooks,
} from "@/lib/services/notebook.service";
import { getDashboardStats } from "@/lib/services/conference.service";
import {
  createNotebookSchema,
  createNotebooksBatchSchema,
  importNotebooksSchema,
  updateNotebookSchema,
} from "@/lib/validations";
import { GET as getNotebooks, POST as postNotebook } from "@/app/api/notebooks/route";
import { POST as postConference } from "@/app/api/conferences/route";
import { useConference, type NotebookSlim } from "@/hooks/useConference";

// 26/11 01:00 UTC = 25/11 22:00 em São Paulo
const NOW = new Date("2026-11-26T01:00:00Z");

beforeEach(() => {
  vi.resetAllMocks();
  txOpts.length = 0;
  db.$transaction.mockImplementation((fn: (tx: typeof db) => unknown, opts?: unknown) => {
    txOpts.push(opts);
    return fn(db);
  });
  db.notebook.createMany.mockResolvedValue({ count: 0 });
  auth.mockResolvedValue({ user: { id: "admin1", role: "ADMIN" } });
});

describe("hostname de arquivado", () => {
  it("data do sufixo em America/Sao_Paulo", () => {
    expect(archiveDateStamp(NOW)).toBe("20261125");
  });

  it("sufixo com colisão vira -2, -3", () => {
    const taken = new Set(["H~arq-20261125", "H~arq-20261125-2"]);
    expect(nextArchivedHostname("H", "20261125", new Set())).toBe("H~arq-20261125");
    expect(nextArchivedHostname("H", "20261125", taken)).toBe("H~arq-20261125-3");
  });

  it("originalHostname remove o sufixo e preserva hostnames normais", () => {
    expect(originalHostname("BSBIA01-EST01~arq-20261125-2")).toBe("BSBIA01-EST01");
    expect(originalHostname("BSBIA01-EST01")).toBe("BSBIA01-EST01");
  });

  it("padrão reservado", () => {
    expect(isReservedHostname("X~arq-20261125")).toBe(true);
    expect(isReservedHostname("X~arq-20261125-3")).toBe(true);
    expect(isReservedHostname("X~arq-2026")).toBe(false);
  });
});

describe("sufixo reservado é recusado no cadastro", () => {
  const h = "BSBIA01-EST01~arq-20261125";
  it.each([
    ["create", () => createNotebookSchema.safeParse({ hostname: h, umId: "u" })],
    ["update", () => updateNotebookSchema.safeParse({ hostname: h, umId: "u", status: "ATIVO" })],
    ["import", () => importNotebooksSchema.safeParse({ umId: "u", rows: [{ hostname: h }] })],
    ["batch", () => createNotebooksBatchSchema.safeParse({ prefix: "X~arq-2026112", start: 1, end: 2, umId: "u" })],
  ])("%s", (_name, parse) => {
    expect(parse().success).toBe(false);
  });

  it("POST /api/notebooks responde 400", async () => {
    const res = await postNotebook(
      new Request("http://x/api/notebooks", { method: "POST", body: JSON.stringify({ hostname: h, umId: "u" }) }),
    );
    expect(res.status).toBe(400);
    expect(db.notebook.create).not.toHaveBeenCalled();
  });
});

describe("excluir × arquivar", () => {
  it("exclui sem histórico e arquiva com histórico, com sufixo, eventos e timeout explícito", async () => {
    db.notebook.findMany
      .mockResolvedValueOnce([
        { id: "a", hostname: "H1", _count: { conferenceItems: 0, lifecycleEvents: 0 } },
        { id: "b", hostname: "H2", _count: { conferenceItems: 3, lifecycleEvents: 0 } },
        { id: "c", hostname: "H3", _count: { conferenceItems: 0, lifecycleEvents: 1 } },
      ])
      .mockResolvedValueOnce([{ hostname: "H2~arq-20261125" }]); // colisão do dia

    const r = await removeNotebooks({ umId: "u1" }, "admin1", NOW);

    expect(r).toEqual({ deleted: 1, archived: 2 });
    expect(db.notebook.findMany.mock.calls[0][0].where).toEqual({
      AND: [{ umId: "u1" }, { status: { not: "ARQUIVADO" } }],
    });
    expect(db.notebook.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ["a"] } } });
    expect(db.notebook.update).toHaveBeenCalledWith({
      where: { id: "b" },
      data: { status: "ARQUIVADO", hostname: "H2~arq-20261125-2" },
    });
    expect(db.notebook.update).toHaveBeenCalledWith({
      where: { id: "c" },
      data: { status: "ARQUIVADO", hostname: "H3~arq-20261125" },
    });
    const events = db.lifecycleEvent.createMany.mock.calls[0][0].data;
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({ notebookId: "b", tipo: "ARQUIVADO", userId: "admin1" });
    expect(events[0].descricao).toContain("H2");
    expect(txOpts[0]).toMatchObject({ timeout: 30_000 });
  });

  it("nunca apaga LifecycleEvent nem ConferenceItem", async () => {
    db.notebook.findMany
      .mockResolvedValueOnce([{ id: "b", hostname: "H2", _count: { conferenceItems: 1, lifecycleEvents: 1 } }])
      .mockResolvedValueOnce([]);
    await removeNotebooks({ id: "b" }, "admin1", NOW);
    expect(db.notebook.deleteMany).not.toHaveBeenCalled();
  });
});

describe("cadastro com hostname de arquivado", () => {
  const archivedRow = { id: "old", hostname: "H1~arq-20261101", um: { nome: "UM1" } };
  const data = { hostname: "H1", umId: "u2", status: "ATIVO" as const };

  it("sem decisão → ARCHIVED_MATCH (409) com o hostname original", async () => {
    db.notebook.findUnique.mockResolvedValue(null);
    db.notebook.findMany.mockResolvedValue([archivedRow]);
    const err = await createNotebook(data, "admin1").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(NotebookConflictError);
    const res = conflictResponse(err)!;
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({
      code: "ARCHIVED_MATCH",
      archived: { id: "old", hostname: "H1", umNome: "UM1" },
    });
  });

  it("reativar restaura hostname, ATIVO, UM escolhida e registra REATIVADO", async () => {
    db.notebook.findUnique.mockResolvedValue(null);
    db.notebook.findMany.mockResolvedValue([archivedRow]);
    db.notebook.update.mockResolvedValue({ id: "old" });
    await createNotebook(data, "admin1", "reactivate");
    expect(db.notebook.update.mock.calls[0][0]).toMatchObject({
      where: { id: "old" },
      data: { hostname: "H1", status: "ATIVO", umId: "u2" },
    });
    expect(db.lifecycleEvent.create.mock.calls[0][0].data).toMatchObject({ notebookId: "old", tipo: "REATIVADO" });
    expect(db.notebook.create).not.toHaveBeenCalled();
  });

  it("cadastrar como novo cria registro e não toca no arquivado", async () => {
    db.notebook.findUnique.mockResolvedValue(null);
    db.notebook.findMany.mockResolvedValue([archivedRow]);
    await createNotebook(data, "admin1", "new");
    expect(db.notebook.create).toHaveBeenCalled();
    expect(db.notebook.update).not.toHaveBeenCalled();
  });

  it("reativação com notebook ativo de mesmo hostname → 409 claro, nunca 500", async () => {
    db.notebook.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "ativo" });
    db.notebook.findMany.mockResolvedValue([archivedRow]);
    const err = await createNotebook(data, "admin1", "reactivate").catch((e: unknown) => e);
    const res = conflictResponse(err)!;
    expect(res.status).toBe(409);
    expect((await res.json()).message).toBe("Já existe notebook ativo com este hostname");
    expect(db.notebook.update).not.toHaveBeenCalled();
  });

  it("lote: skip relata conflitos; reactivate reativa e reporta bloqueados", async () => {
    db.notebook.findMany.mockResolvedValue([
      { id: "o1", hostname: "H1~arq-20261101", um: { nome: "UM1" } },
      { id: "o2", hostname: "H2~arq-20261101", um: { nome: "UM1" } },
    ]);
    db.notebook.createMany.mockResolvedValue({ count: 1 });
    const rows = [{ hostname: "H1" }, { hostname: "H2" }, { hostname: "H3" }];

    const skip = await createNotebooksBulk(rows, "u2", "ATIVO", "admin1");
    expect(skip).toMatchObject({ created: 1, reactivated: 0, archivedConflicts: ["H1", "H2"] });
    expect(db.notebook.createMany.mock.calls[0][0].data.map((d: { hostname: string }) => d.hostname)).toEqual(["H3"]);

    db.notebook.findUnique.mockImplementation(({ where }: { where: { hostname: string } }) =>
      where.hostname === "H2" ? { id: "ativo" } : null,
    );
    const re = await createNotebooksBulk(rows, "u2", "ATIVO", "admin1", "reactivate");
    expect(re).toMatchObject({ reactivated: 1, blocked: ["H2"], archivedConflicts: [] });
  });
});

describe("arquivados fora das consultas operacionais", () => {
  it("GET /api/notebooks exclui ARQUIVADO por padrão (lista esperada e lookup do scanner)", async () => {
    db.notebook.findMany.mockResolvedValue([]);
    await getNotebooks(new Request("http://x/api/notebooks?umId=u1"));
    expect(db.notebook.findMany.mock.calls[0][0].where).toEqual({ umId: "u1", status: { not: "ARQUIVADO" } });

    await getNotebooks(new Request("http://x/api/notebooks?includeArchived=1"));
    expect(db.notebook.findMany.mock.calls[1][0].where).toEqual({});
  });

  it("dashboard não conta arquivados", async () => {
    db.conference.count.mockResolvedValue(0);
    db.conference.findMany.mockResolvedValue([]);
    db.notebook.count.mockResolvedValue(0);
    db.notebook.findMany.mockResolvedValue([]);
    await getDashboardStats();
    expect(db.notebook.count).toHaveBeenCalledWith({ where: { status: { not: "ARQUIVADO" } } });
  });

  it("scanner: etiqueta de arquivado mostra mensagem própria e nunca entra em pendentes", async () => {
    const nbs: NotebookSlim[] = [
      { id: "n1", hostname: "BSBIA01-EST01", serial: null, status: "ATIVO" },
      { id: "n9", hostname: "BSBIA01-EST09~arq-20261125", serial: null, status: "ARQUIVADO" },
    ];
    const um = { id: "um1", nome: "UM", project: { nome: "P", cor: "#000" }, mouses: false, carregadores: false, fones: false };
    const { result } = renderHook(() => useConference());
    await act(async () => result.current.startConference(um, nbs));
    expect(result.current.state.pending.map((n) => n.id)).toEqual(["n1"]);
    act(() => result.current.processScanBatch(["BSBIA01-EST09"], nbs, 1000));
    expect(result.current.state.error).toContain("notebook arquivado — procure o administrador");
    expect(result.current.state.scanned).toHaveLength(0);
  });
});

describe("replay offline com notebook arquivado depois", () => {
  it("X-Sync-Replay grava a conferência (201) e o Telegram mostra o hostname original", async () => {
    process.env.TELEGRAM_BOT_TOKEN = "t";
    process.env.TELEGRAM_CHAT_ID = "c";
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    auth.mockResolvedValue({ user: { id: "tec1", role: "USER" } });
    db.conference.create.mockResolvedValue({
      id: "conf1",
      status: "CONCLUIDO_FALTANTES",
      dataInicio: NOW,
      dataFim: NOW,
      user: { nome: "Técnico" },
      um: { nome: "UM", mouses: false, carregadores: false, fones: false, project: { nome: "P", cor: "#000" } },
      items: [{ status: "FALTANTE", notebook: { hostname: "BSBIA01-EST09~arq-20261125" } }],
    });

    const res = await postConference(
      new Request("http://x/api/conferences", {
        method: "POST",
        headers: { "x-sync-replay": "1" },
        body: JSON.stringify({
          umId: "um1",
          dataInicio: NOW.toISOString(),
          dataFim: NOW.toISOString(),
          status: "CONCLUIDO_FALTANTES",
          items: [{ notebookId: "n9", status: "FALTANTE" }],
        }),
      }),
    );

    expect(res.status).toBe(201);
    expect(db.lifecycleEvent.createMany).toHaveBeenCalled();
    const text = JSON.parse(fetchMock.mock.calls[0][1].body).text as string;
    expect(text).toContain("BSBIA01\\-EST09");
    expect(text).not.toContain("arq");
    expect(text).toContain("Dispositivos Ativos: 1");
    vi.unstubAllGlobals();
  });

  it("Telegram sem configuração só avisa presença, nunca valores", async () => {
    delete process.env.TELEGRAM_BOT_TOKEN;
    process.env.TELEGRAM_CHAT_ID = "segredo";
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    auth.mockResolvedValue({ user: { id: "tec1", role: "USER" } });
    db.conference.create.mockResolvedValue({
      id: "c", status: "CONCLUIDO_OK", dataInicio: NOW, dataFim: NOW, user: { nome: "T" },
      um: { nome: "UM", mouses: false, carregadores: false, fones: false, project: { nome: "P", cor: "#000" } },
      items: [],
    });
    await postConference(
      new Request("http://x/api/conferences", {
        method: "POST",
        headers: { "x-sync-replay": "1" },
        body: JSON.stringify({
          umId: "um1", dataInicio: NOW.toISOString(), dataFim: NOW.toISOString(),
          status: "CONCLUIDO_OK", items: [{ notebookId: "n1", status: "ESCANEADO" }],
        }),
      }),
    );
    const call = warn.mock.calls.find((c) => (c[1] as { message?: string })?.message === "Telegram não configurado");
    expect(call?.[1]).toMatchObject({ bot: false, chatId: true });
    expect(JSON.stringify(warn.mock.calls)).not.toContain("segredo");
  });
});
