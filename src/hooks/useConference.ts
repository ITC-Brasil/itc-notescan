"use client";

import { useCallback, useReducer } from "react";
import { saveToOutbox } from "@/lib/offline/sync";
import { logger } from "@/lib/logger";
import type { Categoria, CreateConferenceInput } from "@/lib/validations";
import { originalHostname } from "@/lib/notebook-hostname";

export interface NotebookSlim {
  id: string;
  hostname: string;
  serial: string | null;
  /** ARQUIVADO só chega na lista de lookup do scan (nunca em pending/maintenance). */
  status: "ATIVO" | "MANUTENCAO" | "ARQUIVADO";
  categoria?: Categoria | null;
}

/** Só em UM ITINERANTE: a UM física escolhida e as metas por categoria (> 0). */
export interface ItineranteSlim {
  umFisicaId: string;
  umFisicaNome: string;
  metas: { categoria: Categoria; meta: number }[];
}

export interface UMSlim {
  id: string;
  nome: string;
  project: { nome: string; cor: string };
  mouses: boolean;
  carregadores: boolean;
  fones: boolean;
  itinerante?: ItineranteSlim;
}

export interface MetaProgress {
  categoria: Categoria;
  meta: number;
  lidos: number;
}

/** Progresso por categoria da conferência itinerante (vazio em UM FIXA). */
export function metaProgress(state: Pick<ConferenceState, "um" | "scanned">): MetaProgress[] {
  return (state.um?.itinerante?.metas ?? [])
    .filter((m) => m.meta > 0)
    .map((m) => ({
      ...m,
      lidos: state.scanned.filter((n) => n.categoria === m.categoria).length,
    }));
}

/** Itinerante: finalização liberada quando todas as metas forem atingidas. */
export function metaAtingida(state: Pick<ConferenceState, "um" | "scanned">): boolean {
  return metaProgress(state).every((m) => m.lidos >= m.meta);
}

export type ConferencePhase = "idle" | "scanning" | "peripherals" | "summary" | "saving" | "done";

export interface Peripherals {
  mouses: number;
  carregadores: number;
  fones: number;
}

export interface ConferenceState {
  phase: ConferencePhase;
  um: UMSlim | null;
  pending: NotebookSlim[];
  scanned: NotebookSlim[];
  maintenance: NotebookSlim[];
  /** Fixed count of ATIVO notebooks, captured at START — the counter denominator. */
  activeTotal: number;
  startTime: string | null;
  location: string | null;
  peripherals: Peripherals;
  error: string | null;
  lastScanned: string | null;
  /** notebook.id → timestamp da última aparição em frame (estado efêmero). */
  recentlySeen: Record<string, number>;
  /** Releituras deliberadas (não suprimidas) — efêmero, só para telemetria no finalize. */
  duplicateReadCount: number;
}

type Action =
  | { type: "START"; um: UMSlim; notebooks: NotebookSlim[]; startTime: string }
  | { type: "SCAN_BATCH"; payload: { rawValues: string[]; notebooks: NotebookSlim[]; timestamp: number } }
  | { type: "CLEAR_ERROR" }
  | { type: "PROCEED_SUMMARY"; target: "peripherals" | "summary" }
  | { type: "PROCEED_TO_SUMMARY"; location: string | null }
  | { type: "SET_PERIPHERALS"; peripherals: Peripherals }
  | { type: "BACK_TO_SCANNING" }
  | { type: "SAVING" }
  | { type: "DONE" }
  | { type: "BLOCKED" }
  | { type: "RESET" };

// Janela em que o MESMO QR ainda em quadro (ou piscando por motion blur) gera
// múltiplos eventos por segundo. Releituras dentro dela são suprimidas.
const FRAME_PRESENCE_MS = 400;

function reducer(state: ConferenceState, action: Action): ConferenceState {
  switch (action.type) {
    case "START": {
      const maintenance = action.notebooks.filter((n) => n.status === "MANUTENCAO");
      const pending = action.notebooks.filter((n) => n.status === "ATIVO");
      return {
        phase: "scanning",
        um: action.um,
        pending,
        scanned: [],
        maintenance,
        activeTotal: pending.length,
        startTime: action.startTime,
        location: null,
        peripherals: { mouses: 0, carregadores: 0, fones: 0 },
        error: null,
        lastScanned: null,
        recentlySeen: {},
        duplicateReadCount: 0,
      };
    }
    case "SET_PERIPHERALS":
      return { ...state, peripherals: action.peripherals };
    // Toda a classificação de scan vive AQUI — nunca num callback lendo o state
    // via closure. O reducer é a única fonte de verdade e sempre enxerga o estado
    // acumulado, mesmo com um lote inteiro processado no mesmo tick do React.
    case "SCAN_BATCH": {
      const { rawValues, notebooks, timestamp } = action.payload;

      const scannedIds = new Set(state.scanned.map((n) => n.id));
      const maintenanceIds = new Set(state.maintenance.map((n) => n.id));
      const seenInBatch = new Set<string>();
      const resolvedIds: string[] = [];
      const movedIds = new Set<string>();
      const appended: NotebookSlim[] = [];

      // Candidatos a erro — no fim escolhe-se UM por prioridade:
      // outra UM (não pertence) > manutenção > duplicata não suprimida.
      // (não há "desconhecido" separado: a página só carrega os notebooks DESTA
      //  UM, então um código de fora simplesmente não resolve.)
      let errArquivado: string | null = null;
      let errForaDaUM: string | null = null;
      let errManutencao: string | null = null;
      let errDuplicata: string | null = null;

      let duplicateReadCount = state.duplicateReadCount;
      let lastMoved: string | null = null;

      for (const raw of rawValues) {
        const hostname = raw.trim();
        if (!hostname) continue;

        const key = hostname.toLowerCase();
        const notebook = notebooks.find(
          (n) => n.status !== "ARQUIVADO" && n.hostname.toLowerCase() === key,
        );

        if (!notebook) {
          // Etiqueta de um notebook arquivado (hostname original sem o sufixo).
          if (notebooks.some((n) => n.status === "ARQUIVADO" && originalHostname(n.hostname).toLowerCase() === key)) {
            errArquivado = errArquivado ?? `"${hostname}": notebook arquivado — procure o administrador`;
            continue;
          }
          errForaDaUM = errForaDaUM ?? `"${hostname}" não pertence a esta UM`;
          continue;
        }

        // Dedupe do lote por notebook.id — NUNCA pela string crua, senão
        // "bsbia04-est50" e "BSBIA04-EST50" passariam como dois códigos.
        if (seenInBatch.has(notebook.id)) continue;
        seenInBatch.add(notebook.id);
        resolvedIds.push(notebook.id);

        if (maintenanceIds.has(notebook.id)) {
          errManutencao = errManutencao ?? `"${hostname}" está em manutenção`;
          continue;
        }

        if (scannedIds.has(notebook.id)) {
          // Já escaneado. Suprimir se o mesmo QR ainda está em quadro.
          const prev = state.recentlySeen[notebook.id];
          const stillInFrame = prev !== undefined && timestamp - prev <= FRAME_PRESENCE_MS;
          if (!stillInFrame) {
            errDuplicata = errDuplicata ?? `"${hostname}" já foi escaneado`;
            duplicateReadCount += 1;
          }
          continue;
        }

        // Leitura nova — mover de pendentes para escaneados.
        appended.push(notebook);
        movedIds.add(notebook.id);
        lastMoved = notebook.hostname;
      }

      // recentlySeen: podar entradas com mais de 400ms, depois carimbar o
      // timestamp atual para TODOS os notebooks resolvidos do lote.
      const recentlySeen: Record<string, number> = {};
      for (const [id, ts] of Object.entries(state.recentlySeen)) {
        if (timestamp - ts <= FRAME_PRESENCE_MS) recentlySeen[id] = ts;
      }
      for (const id of resolvedIds) recentlySeen[id] = timestamp;

      const selectedError = errArquivado ?? errForaDaUM ?? errManutencao ?? errDuplicata ?? null;

      return {
        ...state,
        pending: movedIds.size > 0 ? state.pending.filter((n) => !movedIds.has(n.id)) : state.pending,
        scanned: appended.length > 0 ? [...state.scanned, ...appended] : state.scanned,
        // Erro novo vence; senão, um scan válido limpa o erro anterior; senão
        // (lote vazio / só supressões) preserva o erro atual sem piscar.
        error: selectedError ?? (movedIds.size > 0 ? null : state.error),
        lastScanned: lastMoved ?? state.lastScanned,
        recentlySeen,
        duplicateReadCount,
      };
    }
    case "CLEAR_ERROR":
      return { ...state, error: null };
    case "PROCEED_SUMMARY":
      return { ...state, phase: action.target, error: null };
    case "PROCEED_TO_SUMMARY":
      return { ...state, phase: "summary", location: action.location, error: null };
    case "BACK_TO_SCANNING":
      return { ...state, phase: "scanning", error: null };
    case "SAVING":
      return { ...state, phase: "saving" };
    case "DONE":
      return { ...state, phase: "done" };
    case "BLOCKED":
      return { ...state, phase: "summary", error: "Meta diária atingida" };
    case "RESET":
      return initialState;
    default:
      return state;
  }
}

const initialState: ConferenceState = {
  phase: "idle",
  um: null,
  pending: [],
  scanned: [],
  maintenance: [],
  activeTotal: 0,
  startTime: null,
  location: null,
  peripherals: { mouses: 0, carregadores: 0, fones: 0 },
  error: null,
  lastScanned: null,
  recentlySeen: {},
  duplicateReadCount: 0,
};

export function useConference() {
  const [state, dispatch] = useReducer(reducer, initialState);

  const startConference = useCallback(
    (um: UMSlim, notebooks: NotebookSlim[]) => {
      const startTime = new Date().toISOString();
      dispatch({ type: "START", um, notebooks, startTime });
    },
    [],
  );

  const setPeripherals = useCallback((peripherals: Peripherals) => {
    dispatch({ type: "SET_PERIPHERALS", peripherals });
  }, []);

  // Um frame do scanner = UM dispatch. NÃO lê o state (deps vazias, dispatch é
  // estável) — a dedupe acontece dentro do reducer, imune a race de closure.
  const processScanBatch = useCallback(
    (rawValues: string[], allUMNotebooks: NotebookSlim[], timestamp: number) => {
      dispatch({ type: "SCAN_BATCH", payload: { rawValues, notebooks: allUMNotebooks, timestamp } });
    },
    [],
  );

  const proceedToSummary = useCallback((target: "peripherals" | "summary" = "summary") => {
    dispatch({ type: "PROCEED_SUMMARY", target });
  }, []);

  const proceedFromPeripherals = useCallback((location: string | null) => {
    dispatch({ type: "PROCEED_TO_SUMMARY", location });
  }, []);

  const backToScanning = useCallback(() => {
    dispatch({ type: "BACK_TO_SCANNING" });
  }, []);

  const finalize = useCallback(async (): Promise<"online" | "offline" | "blocked"> => {
    if (!state.um || !state.startTime) return "offline";
    const um = state.um;

    // Releituras deliberadas suprimidas/registradas — só telemetria, nunca UI
    // nem payload. Ajuda a flagar QR danificado / técnico com dificuldade.
    if (state.duplicateReadCount > 0) {
      logger.warn("Releituras duplicadas na conferência", {
        umId: um.id,
        duplicateReadCount: state.duplicateReadCount,
      });
    }

    dispatch({ type: "SAVING" });

    const dataFim = new Date().toISOString();
    const itinerante = um.itinerante;
    // Itinerante: os não lidos por este técnico não são faltantes dele — a
    // cobertura é do grupo (dashboard). Só ESCANEADO, sempre CONCLUIDO_OK.
    const conferenceStatus =
      itinerante || state.pending.length === 0 ? "CONCLUIDO_OK" : "CONCLUIDO_FALTANTES";

    const scannedItems = state.scanned.map((n) => ({ notebookId: n.id, status: "ESCANEADO" as const }));
    const items: CreateConferenceInput["items"] = itinerante
      ? scannedItems
      : [
          ...scannedItems,
          ...state.pending.map((n) => ({ notebookId: n.id, status: "FALTANTE" as const })),
          ...state.maintenance.map((n) => ({ notebookId: n.id, status: "MANUTENCAO" as const })),
        ];

    const payload: CreateConferenceInput = {
      umId: um.id,
      ...(itinerante && { umFisicaId: itinerante.umFisicaId }),
      dataInicio: state.startTime,
      dataFim,
      localizacao: state.location ?? undefined,
      status: conferenceStatus,
      ...(um.mouses && { mousesQtd: state.peripherals.mouses }),
      ...(um.carregadores && { carregadoresQtd: state.peripherals.carregadores }),
      ...(um.fones && { fonesQtd: state.peripherals.fones }),
      items,
    };

    try {
      const res = await fetch("/api/conferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        dispatch({ type: "DONE" });
        return "online";
      }

      // 409 = daily limit reached. Hard block: do NOT queue — queuing would
      // resync with the exempt header and bypass the limit. Revert to summary
      // so the caller can inform the user.
      if (res.status === 409) {
        dispatch({ type: "BLOCKED" });
        return "blocked";
      }

      throw new Error(`HTTP ${res.status}`);
    } catch {
      await saveToOutbox(payload);
      dispatch({ type: "DONE" });
      return "offline";
    }
  }, [state]);

  const reset = useCallback(() => {
    dispatch({ type: "RESET" });
  }, []);

  return { state, startConference, processScanBatch, setPeripherals, proceedToSummary, proceedFromPeripherals, backToScanning, finalize, reset };
}
