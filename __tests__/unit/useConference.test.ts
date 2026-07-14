import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

vi.mock("@/lib/offline/sync", () => ({
  saveToOutbox: vi.fn().mockResolvedValue(undefined),
  processOutbox: vi.fn().mockResolvedValue(undefined),
  getOutboxCount: vi.fn().mockResolvedValue(0),
}));

import { useConference, type NotebookSlim, type UMSlim } from "@/hooks/useConference";
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
});

describe("useConference — processScan", () => {
  it("moves scanned notebook from pending to scanned", async () => {
    const { result } = renderHook(() => useConference());
    await startConference(result);

    act(() => { result.current.processScan("BSBIA01-EST01", notebooks); });

    expect(result.current.state.scanned).toHaveLength(1);
    expect(result.current.state.scanned[0].hostname).toBe("BSBIA01-EST01");
    expect(result.current.state.pending).toHaveLength(1);
    expect(result.current.state.pending[0].hostname).toBe("BSBIA01-EST02");
  });

  it("scan is case-insensitive", async () => {
    const { result } = renderHook(() => useConference());
    await startConference(result);

    act(() => { result.current.processScan("bsbia01-est01", notebooks); });

    expect(result.current.state.scanned).toHaveLength(1);
    expect(result.current.state.error).toBeNull();
  });

  it("duplicate scan returns error and does not move notebook", async () => {
    const { result } = renderHook(() => useConference());
    await startConference(result);

    act(() => { result.current.processScan("BSBIA01-EST01", notebooks); });
    act(() => { result.current.processScan("BSBIA01-EST01", notebooks); });

    expect(result.current.state.scanned).toHaveLength(1);
    expect(result.current.state.error).toContain("já foi escaneado");
  });

  it("scan of MANUTENCAO notebook returns error", async () => {
    const { result } = renderHook(() => useConference());
    await startConference(result);

    act(() => { result.current.processScan("BSBIA01-EST03", notebooks); });

    expect(result.current.state.error).toContain("manutenção");
    expect(result.current.state.scanned).toHaveLength(0);
  });

  it("scan of unknown hostname returns error", async () => {
    const { result } = renderHook(() => useConference());
    await startConference(result);

    act(() => { result.current.processScan("NOTEBOOK-DESCONHECIDO", notebooks); });

    expect(result.current.state.error).toContain("não pertence a esta UM");
    expect(result.current.state.scanned).toHaveLength(0);
  });

  it("sets lastScanned on successful scan", async () => {
    const { result } = renderHook(() => useConference());
    await startConference(result);

    act(() => { result.current.processScan("BSBIA01-EST01", notebooks); });

    expect(result.current.state.lastScanned).toBe("BSBIA01-EST01");
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
    act(() => { result.current.processScan("BSBIA01-EST01", notebooks); });
    expect(result.current.state.pending).toHaveLength(1);
    expect(result.current.state.scanned).toHaveLength(1);
    expect(result.current.state.maintenance).toHaveLength(1);
  });

  it("sends CONCLUIDO_OK when all ATIVO notebooks are scanned", async () => {
    const { result } = renderHook(() => useConference());
    await startConference(result);

    const ativoNotebooks = notebooks.filter((n) => n.status === "ATIVO");
    for (const nb of ativoNotebooks) {
      act(() => { result.current.processScan(nb.hostname, notebooks); });
    }

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
  it("returns false when conference not started", async () => {
    const { result } = renderHook(() => useConference());
    let success: boolean | undefined;
    await act(async () => { success = await result.current.finalize(); });
    expect(success).toBe(false);
  });

  it("returns true and transitions to done on successful save", async () => {
    const { result } = renderHook(() => useConference());
    await startConference(result);

    let success: boolean | undefined;
    await act(async () => { success = await result.current.finalize(); });

    expect(success).toBe(true);
    expect(result.current.state.phase).toBe("done");
  });

  it("saves to outbox and returns false when fetch fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const { result } = renderHook(() => useConference());
    await startConference(result);

    let success: boolean | undefined;
    await act(async () => { success = await result.current.finalize(); });

    expect(success).toBe(false);
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
    act(() => { result.current.processScan("BSBIA01-EST01", notebooks); });

    act(() => { result.current.reset(); });

    expect(result.current.state.phase).toBe("idle");
    expect(result.current.state.scanned).toHaveLength(0);
    expect(result.current.state.um).toBeNull();
  });
});
