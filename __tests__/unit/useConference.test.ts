import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

vi.mock("@/lib/offline/sync", () => ({
  saveToOutbox: vi.fn().mockResolvedValue(undefined),
  processOutbox: vi.fn().mockResolvedValue(undefined),
  getOutboxCount: vi.fn().mockResolvedValue(0),
}));

import { metaProgress, useConference, type NotebookSlim, type UMSlim } from "@/hooks/useConference";
import { saveToOutbox } from "@/lib/offline/sync";

const mockUM: UMSlim = {
  id: "um1",
  nome: "BSBIA01",
  project: { nome: "Brasil.IA", cor: "#008F95" },
  mouses: false,
  carregadores: false,
  fones: false,
};

const notebooks: NotebookSlim[] = [
  { id: "nb1", hostname: "BSBIA01-EST01", serial: null, status: "ATIVO" },
  { id: "nb2", hostname: "BSBIA01-EST02", serial: null, status: "ATIVO" },
  { id: "nb3", hostname: "BSBIA01-EST03", serial: null, status: "MANUTENCAO" },
];

/** Starts a conference and waits for state update. */
async function startConference(result: { current: ReturnType<typeof useConference> }) {
  await act(async () => {
    result.current.startConference(mockUM, notebooks);
  });
}

/** Dispatches one SCAN_BATCH (one frame). Timestamp explícito — o reducer é puro. */
function scan(
  result: { current: ReturnType<typeof useConference> },
  hostnames: string[],
  timestamp: number,
) {
  act(() => {
    result.current.processScanBatch(hostnames, notebooks, timestamp);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  // jsdom does not implement geolocation; the hook falls back to location = null synchronously.
  Object.defineProperty(global.navigator, "geolocation", {
    value: undefined,
    writable: true,
    configurable: true,
  });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("useConference — estado inicial", () => {
  it("starts with phase idle", () => {
    const { result } = renderHook(() => useConference());
    expect(result.current.state.phase).toBe("idle");
  });

  it("starts with empty lists", () => {
    const { result } = renderHook(() => useConference());
    const { pending, scanned, maintenance } = result.current.state;
    expect(pending).toHaveLength(0);
    expect(scanned).toHaveLength(0);
    expect(maintenance).toHaveLength(0);
  });

  it("starts with no error", () => {
    const { result } = renderHook(() => useConference());
    expect(result.current.state.error).toBeNull();
  });
});

describe("useConference — startConference", () => {
  it("transitions phase to scanning", async () => {
    const { result } = renderHook(() => useConference());
    await startConference(result);
    expect(result.current.state.phase).toBe("scanning");
  });

  it("separates ATIVO notebooks into pending", async () => {
    const { result } = renderHook(() => useConference());
    await startConference(result);
    expect(result.current.state.pending).toHaveLength(2);
    expect(result.current.state.pending.every((n) => n.status === "ATIVO")).toBe(true);
  });

  it("separates MANUTENCAO notebooks into maintenance", async () => {
    const { result } = renderHook(() => useConference());
    await startConference(result);
    expect(result.current.state.maintenance).toHaveLength(1);
    expect(result.current.state.maintenance[0].id).toBe("nb3");
  });

  it("sets um in state", async () => {
    const { result } = renderHook(() => useConference());
    await startConference(result);
    expect(result.current.state.um).toEqual(mockUM);
  });

  it("captures activeTotal = number of ATIVO notebooks", async () => {
    const { result } = renderHook(() => useConference());
    await startConference(result);
    expect(result.current.state.activeTotal).toBe(2);
  });
});

describe("useConference — SCAN_BATCH: movimentação básica", () => {
  it("moves scanned notebook from pending to scanned", async () => {
    const { result } = renderHook(() => useConference());
    await startConference(result);

    scan(result, ["BSBIA01-EST01"], 1000);

    expect(result.current.state.scanned).toHaveLength(1);
    expect(result.current.state.scanned[0].hostname).toBe("BSBIA01-EST01");
    expect(result.current.state.pending).toHaveLength(1);
    expect(result.current.state.pending[0].hostname).toBe("BSBIA01-EST02");
  });

  it("scan is case-insensitive", async () => {
    const { result } = renderHook(() => useConference());
    await startConference(result);

    scan(result, ["bsbia01-est01"], 1000);

    expect(result.current.state.scanned).toHaveLength(1);
    expect(result.current.state.error).toBeNull();
  });

  it("scan of MANUTENCAO notebook returns error", async () => {
    const { result } = renderHook(() => useConference());
    await startConference(result);

    scan(result, ["BSBIA01-EST03"], 1000);

    expect(result.current.state.error).toContain("manutenção");
    expect(result.current.state.scanned).toHaveLength(0);
  });

  it("scan of unknown hostname returns error (não pertence)", async () => {
    const { result } = renderHook(() => useConference());
    await startConference(result);

    scan(result, ["NOTEBOOK-DESCONHECIDO"], 1000);

    expect(result.current.state.error).toContain("não pertence a esta UM");
    expect(result.current.state.scanned).toHaveLength(0);
  });

  it("sets lastScanned on successful scan", async () => {
    const { result } = renderHook(() => useConference());
    await startConference(result);

    scan(result, ["BSBIA01-EST01"], 1000);

    expect(result.current.state.lastScanned).toBe("BSBIA01-EST01");
  });
});

describe("useConference — dedupe dentro do reducer", () => {
  it("same hostname across 5 consecutive batches → 1 scanned", async () => {
    const { result } = renderHook(() => useConference());
    await startConference(result);

    for (let t = 0; t < 5; t++) scan(result, ["BSBIA01-EST01"], t);

    expect(result.current.state.scanned).toHaveLength(1);
  });

  it("batch [EST01, EST01, EST02] → 2 scanned", async () => {
    const { result } = renderHook(() => useConference());
    await startConference(result);

    scan(result, ["BSBIA01-EST01", "BSBIA01-EST01", "BSBIA01-EST02"], 1000);

    expect(result.current.state.scanned).toHaveLength(2);
  });

  it("batch [EST01, est01] → 1 scanned (dedupe by id, not string)", async () => {
    const { result } = renderHook(() => useConference());
    await startConference(result);

    scan(result, ["BSBIA01-EST01", "bsbia01-est01"], 1000);

    expect(result.current.state.scanned).toHaveLength(1);
  });

  it("batch with already-scanned + new → only the new one is added", async () => {
    const { result } = renderHook(() => useConference());
    await startConference(result);

    scan(result, ["BSBIA01-EST01"], 0);
    // t=2000 so the re-read of EST01 is a deliberate duplicate, not suppressed
    scan(result, ["BSBIA01-EST01", "BSBIA01-EST02"], 2000);

    expect(result.current.state.scanned).toHaveLength(2);
    expect(result.current.state.scanned.map((n) => n.id).sort()).toEqual(["nb1", "nb2"]);
  });

  it("counter never exceeds activeTotal even with repeated codes", async () => {
    const { result } = renderHook(() => useConference());
    await startConference(result);

    scan(result, ["BSBIA01-EST01", "BSBIA01-EST02", "BSBIA01-EST01"], 0);
    scan(result, ["BSBIA01-EST01", "BSBIA01-EST02"], 2000);
    scan(result, ["BSBIA01-EST02", "BSBIA01-EST01"], 4000);

    expect(result.current.state.scanned.length).toBe(result.current.state.activeTotal);
    expect(result.current.state.scanned.length).toBe(2);
  });
});

describe("useConference — prioridade de erro no lote", () => {
  it("outra UM + duplicata → error is outra UM; duplicateReadCount still increments", async () => {
    const { result } = renderHook(() => useConference());
    await startConference(result);

    scan(result, ["BSBIA01-EST01"], 0);
    // t=2000: duplicata deliberada (não suprimida) + código de outra UM no mesmo lote
    scan(result, ["FORA-DA-UM", "BSBIA01-EST01"], 2000);

    expect(result.current.state.error).toContain("não pertence a esta UM");
    expect(result.current.state.duplicateReadCount).toBe(1);
  });

  it("valid + outra UM → valid is registered AND outra-UM error is emitted", async () => {
    const { result } = renderHook(() => useConference());
    await startConference(result);

    scan(result, ["BSBIA01-EST02", "FORA-DA-UM"], 1000);

    expect(result.current.state.scanned.map((n) => n.id)).toContain("nb2");
    expect(result.current.state.error).toContain("não pertence a esta UM");
  });
});

describe("useConference — supressão de releitura por presença no frame", () => {
  it("already scanned, re-read at +100ms → no error, duplicateReadCount 0", async () => {
    const { result } = renderHook(() => useConference());
    await startConference(result);

    scan(result, ["BSBIA01-EST01"], 0);
    scan(result, ["BSBIA01-EST01"], 100);

    expect(result.current.state.error).toBeNull();
    expect(result.current.state.duplicateReadCount).toBe(0);
  });

  it("already scanned, re-read at +2000ms → error emitted, duplicateReadCount 1", async () => {
    const { result } = renderHook(() => useConference());
    await startConference(result);

    scan(result, ["BSBIA01-EST01"], 0);
    scan(result, ["BSBIA01-EST01"], 2000);

    expect(result.current.state.error).toContain("já foi escaneado");
    expect(result.current.state.duplicateReadCount).toBe(1);
  });

  it("seen t=0, absent t=300, present t=350 → suppressed (decay covers motion-blur gap)", async () => {
    const { result } = renderHook(() => useConference());
    await startConference(result);

    scan(result, ["BSBIA01-EST01"], 0);
    scan(result, [], 300); // ausente do frame
    scan(result, ["BSBIA01-EST01"], 350);

    expect(result.current.state.error).toBeNull();
    expect(result.current.state.duplicateReadCount).toBe(0);
  });

  it("recentlySeen does not retain entries older than 400ms across batches", async () => {
    const { result } = renderHook(() => useConference());
    await startConference(result);

    scan(result, ["BSBIA01-EST01"], 0);
    scan(result, ["BSBIA01-EST02"], 500); // 500 - 0 > 400 → nb1 podado

    expect(result.current.state.recentlySeen["nb1"]).toBeUndefined();
    expect(result.current.state.recentlySeen["nb2"]).toBe(500);
  });
});

describe("useConference — invariante estrutural", () => {
  it("processScanBatch keeps a stable identity across renders with different scanned", async () => {
    const { result } = renderHook(() => useConference());
    await startConference(result);

    const ref1 = result.current.processScanBatch;
    scan(result, ["BSBIA01-EST01"], 1000);
    expect(result.current.state.scanned).toHaveLength(1); // state.scanned mudou

    const ref2 = result.current.processScanBatch;
    expect(ref2).toBe(ref1);
  });
});

describe("useConference — resumo e status", () => {
  it("reflects correct counts: pending, scanned, maintenance", async () => {
    const { result } = renderHook(() => useConference());
    await startConference(result);

    // After start: 2 pending, 0 scanned, 1 maintenance
    expect(result.current.state.pending).toHaveLength(2);
    expect(result.current.state.scanned).toHaveLength(0);
    expect(result.current.state.maintenance).toHaveLength(1);

    // After 1 scan: 1 pending, 1 scanned, 1 maintenance
    scan(result, ["BSBIA01-EST01"], 1000);
    expect(result.current.state.pending).toHaveLength(1);
    expect(result.current.state.scanned).toHaveLength(1);
    expect(result.current.state.maintenance).toHaveLength(1);
  });

  it("sends CONCLUIDO_OK when all ATIVO notebooks are scanned", async () => {
    const { result } = renderHook(() => useConference());
    await startConference(result);

    const ativos = notebooks.filter((n) => n.status === "ATIVO").map((n) => n.hostname);
    scan(result, ativos, 1000);

    await act(async () => { await result.current.finalize(); });

    const [, options] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(options.body as string);
    expect(body.status).toBe("CONCLUIDO_OK");
  });

  it("sends CONCLUIDO_FALTANTES when some notebooks not scanned", async () => {
    const { result } = renderHook(() => useConference());
    await startConference(result);
    // Don't scan any notebook

    await act(async () => { await result.current.finalize(); });

    const [, options] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(options.body as string);
    expect(body.status).toBe("CONCLUIDO_FALTANTES");
  });
});

describe("useConference — finalize", () => {
  it("returns offline when conference not started", async () => {
    const { result } = renderHook(() => useConference());
    let outcome: string | undefined;
    await act(async () => { outcome = await result.current.finalize(); });
    expect(outcome).toBe("offline");
  });

  it("returns online and transitions to done on successful save", async () => {
    const { result } = renderHook(() => useConference());
    await startConference(result);

    let outcome: string | undefined;
    await act(async () => { outcome = await result.current.finalize(); });

    expect(outcome).toBe("online");
    expect(result.current.state.phase).toBe("done");
  });

  it("saves to outbox and returns offline when fetch fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const { result } = renderHook(() => useConference());
    await startConference(result);

    let outcome: string | undefined;
    await act(async () => { outcome = await result.current.finalize(); });

    expect(outcome).toBe("offline");
    expect(saveToOutbox).toHaveBeenCalled();
    expect(result.current.state.phase).toBe("done");
  });

  it("saves to outbox when API returns non-ok status", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    const { result } = renderHook(() => useConference());
    await startConference(result);

    await act(async () => { await result.current.finalize(); });

    expect(saveToOutbox).toHaveBeenCalledWith(
      expect.objectContaining({ umId: mockUM.id }),
    );
  });

  it("returns blocked and does NOT outbox on 409 (daily limit)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 409 }));
    const { result } = renderHook(() => useConference());
    await startConference(result);

    let outcome: string | undefined;
    await act(async () => { outcome = await result.current.finalize(); });

    expect(outcome).toBe("blocked");
    expect(saveToOutbox).not.toHaveBeenCalled();
  });
});

describe("useConference — controles de fase", () => {
  it("proceedToSummary transitions to summary phase", async () => {
    const { result } = renderHook(() => useConference());
    await startConference(result);

    act(() => { result.current.proceedToSummary(); });

    expect(result.current.state.phase).toBe("summary");
  });

  it("backToScanning transitions back to scanning phase", async () => {
    const { result } = renderHook(() => useConference());
    await startConference(result);

    act(() => { result.current.proceedToSummary(); });
    act(() => { result.current.backToScanning(); });

    expect(result.current.state.phase).toBe("scanning");
  });

  it("reset returns to initial state", async () => {
    const { result } = renderHook(() => useConference());
    await startConference(result);
    scan(result, ["BSBIA01-EST01"], 1000);

    act(() => { result.current.reset(); });

    expect(result.current.state.phase).toBe("idle");
    expect(result.current.state.scanned).toHaveLength(0);
    expect(result.current.state.um).toBeNull();
  });
});

describe("useConference — UM itinerante", () => {
  const itinUM: UMSlim = {
    ...mockUM,
    id: "itin",
    nome: "QDFM-PEDAGÓGICO",
    itinerante: {
      umFisicaId: "fixa1",
      umFisicaNome: "QDFM01",
      metas: [
        { categoria: "INSTRUTOR", meta: 2 },
        { categoria: "PEDAGOGA", meta: 1 },
      ],
    },
  };
  const itinNbs: NotebookSlim[] = [
    { id: "i1", hostname: "QDFM-INSTR01", serial: null, status: "ATIVO", categoria: "INSTRUTOR" },
    { id: "i2", hostname: "QDFM-INSTR02", serial: null, status: "ATIVO", categoria: "INSTRUTOR" },
    { id: "i3", hostname: "QDFM-INSTR03", serial: null, status: "ATIVO", categoria: "INSTRUTOR" },
    { id: "p1", hostname: "QDFM-PEDAG-A", serial: null, status: "ATIVO", categoria: "PEDAGOGA" },
    { id: "p2", hostname: "QDFM-PEDAG-B", serial: null, status: "MANUTENCAO", categoria: "PEDAGOGA" },
  ];
  const scanI = (r: { current: ReturnType<typeof useConference> }, h: string[], t: number) =>
    act(() => r.current.processScanBatch(h, itinNbs, t));

  it("progresso e falta por categoria", async () => {
    const { result } = renderHook(() => useConference());
    await act(async () => result.current.startConference(itinUM, itinNbs));
    scanI(result, ["QDFM-INSTR01", "QDFM-INSTR02"], 1000);
    expect(metaProgress(result.current.state)).toEqual([
      { categoria: "INSTRUTOR", meta: 2, lidos: 2, falta: 0 },
      { categoria: "PEDAGOGA", meta: 1, lidos: 0, falta: 1 },
    ]);
    scanI(result, ["QDFM-PEDAG-A"], 2000);
    expect(metaProgress(result.current.state).every((m) => m.falta === 0)).toBe(true);
    // Ler além da meta é permitido.
    scanI(result, ["QDFM-INSTR03"], 3000);
    expect(result.current.state.scanned).toHaveLength(4);
  });

  it("meta não atingida: envia a qualquer momento como CONCLUIDO_FALTANTES, sem itens FALTANTE", async () => {
    const { result } = renderHook(() => useConference());
    await act(async () => result.current.startConference(itinUM, itinNbs));
    scanI(result, ["QDFM-INSTR01"], 1000);
    await act(async () => { await result.current.finalize(); });
    const [, options] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(options.body as string);
    expect(body.status).toBe("CONCLUIDO_FALTANTES");
    expect(body.items).toEqual([{ notebookId: "i1", status: "ESCANEADO" }]);
  });

  it("duplicada na mesma conferência e notebook de outra UM continuam bloqueados", async () => {
    const { result } = renderHook(() => useConference());
    await act(async () => result.current.startConference(itinUM, itinNbs));
    scanI(result, ["QDFM-INSTR01"], 1000);
    scanI(result, ["QDFM-INSTR01"], 5000);
    expect(result.current.state.error).toMatch(/já foi escaneado/);
    scanI(result, ["BSBIA01-EST01"], 9000);
    expect(result.current.state.error).toMatch(/não pertence/);
    expect(result.current.state.scanned).toHaveLength(1);
  });

  it("finalize envia só ESCANEADO, CONCLUIDO_OK e umFisicaId", async () => {
    const { result } = renderHook(() => useConference());
    await act(async () => result.current.startConference(itinUM, itinNbs));
    scanI(result, ["QDFM-INSTR01", "QDFM-INSTR02", "QDFM-PEDAG-A"], 1000);
    await act(async () => { await result.current.finalize(); });
    const [, options] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(options.body as string);
    expect(body.status).toBe("CONCLUIDO_OK");
    expect(body.umFisicaId).toBe("fixa1");
    expect(body.items).toEqual([
      { notebookId: "i1", status: "ESCANEADO" },
      { notebookId: "i2", status: "ESCANEADO" },
      { notebookId: "p1", status: "ESCANEADO" },
    ]);
  });

  it("offline: payload itinerante vai para a outbox com umFisicaId", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const { result } = renderHook(() => useConference());
    await act(async () => result.current.startConference(itinUM, itinNbs));
    scanI(result, ["QDFM-INSTR01", "QDFM-INSTR02", "QDFM-PEDAG-A"], 1000);
    await act(async () => { await result.current.finalize(); });
    expect(saveToOutbox).toHaveBeenCalledWith(expect.objectContaining({ umFisicaId: "fixa1", status: "CONCLUIDO_OK" }));
  });

  it("UM fixa não envia umFisicaId (fluxo intacto)", async () => {
    const { result } = renderHook(() => useConference());
    await startConference(result);
    scan(result, ["BSBIA01-EST01"], 1000);
    await act(async () => { await result.current.finalize(); });
    const [, options] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(options.body as string);
    expect(body.umFisicaId).toBeUndefined();
    expect(body.status).toBe("CONCLUIDO_FALTANTES");
    expect(metaProgress(result.current.state)).toEqual([]);
  });
});
