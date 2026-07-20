"use client";

import { useCallback, useReducer } from "react";
import { saveToOutbox } from "@/lib/offline/sync";
import type { CreateConferenceInput } from "@/lib/validations";

export interface NotebookSlim {
  id: string;
  hostname: string;
  serial: string | null;
  status: "ATIVO" | "MANUTENCAO";
}

export interface UMSlim {
  id: string;
  nome: string;
  project: { nome: string; cor: string };
  mouses: boolean;
  carregadores: boolean;
  fones: boolean;
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
  startTime: string | null;
  location: string | null;
  peripherals: Peripherals;
  error: string | null;
  lastScanned: string | null;
}

type Action =
  | { type: "START"; um: UMSlim; notebooks: NotebookSlim[]; startTime: string }
  | { type: "SCAN_OK"; notebook: NotebookSlim }
  | { type: "SCAN_ERROR"; message: string }
  | { type: "CLEAR_ERROR" }
  | { type: "PROCEED_SUMMARY"; target: "peripherals" | "summary" }
  | { type: "PROCEED_TO_SUMMARY"; location: string | null }
  | { type: "SET_PERIPHERALS"; peripherals: Peripherals }
  | { type: "BACK_TO_SCANNING" }
  | { type: "SAVING" }
  | { type: "DONE" }
  | { type: "BLOCKED" }
  | { type: "RESET" };

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
        startTime: action.startTime,
        location: null,
        peripherals: { mouses: 0, carregadores: 0, fones: 0 },
        error: null,
        lastScanned: null,
      };
    }
    case "SET_PERIPHERALS":
      return { ...state, peripherals: action.peripherals };
    case "SCAN_OK": {
      return {
        ...state,
        pending: state.pending.filter((n) => n.id !== action.notebook.id),
        scanned: [...state.scanned, action.notebook],
        error: null,
        lastScanned: action.notebook.hostname,
      };
    }
    case "SCAN_ERROR":
      return { ...state, error: action.message, lastScanned: null };
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
  startTime: null,
  location: null,
  peripherals: { mouses: 0, carregadores: 0, fones: 0 },
  error: null,
  lastScanned: null,
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

  const processScan = useCallback(
    (rawValue: string, allUMNotebooks: NotebookSlim[]) => {
      const hostname = rawValue.trim();

      const notebook = allUMNotebooks.find(
        (n) => n.hostname.toLowerCase() === hostname.toLowerCase(),
      );

      if (!notebook) {
        dispatch({ type: "SCAN_ERROR", message: `"${hostname}" não pertence a esta UM` });
        return;
      }

      if (state.maintenance.some((n) => n.id === notebook.id)) {
        dispatch({ type: "SCAN_ERROR", message: `"${hostname}" está em manutenção` });
        return;
      }

      if (state.scanned.some((n) => n.id === notebook.id)) {
        dispatch({ type: "SCAN_ERROR", message: `"${hostname}" já foi escaneado` });
        return;
      }

      dispatch({ type: "SCAN_OK", notebook });
    },
    [state.maintenance, state.scanned],
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

    dispatch({ type: "SAVING" });

    const dataFim = new Date().toISOString();
    const conferenceStatus =
      state.pending.length === 0 ? "CONCLUIDO_OK" : "CONCLUIDO_FALTANTES";

    const items: CreateConferenceInput["items"] = [
      ...state.scanned.map((n) => ({ notebookId: n.id, status: "ESCANEADO" as const })),
      ...state.pending.map((n) => ({ notebookId: n.id, status: "FALTANTE" as const })),
      ...state.maintenance.map((n) => ({ notebookId: n.id, status: "MANUTENCAO" as const })),
    ];

    const payload: CreateConferenceInput = {
      umId: um.id,
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

  return { state, startConference, processScan, setPeripherals, proceedToSummary, proceedFromPeripherals, backToScanning, finalize, reset };
}
