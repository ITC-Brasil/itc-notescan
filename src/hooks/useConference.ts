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

export interface ConferenceState {
  phase: ConferencePhase;
  um: UMSlim | null;
  pending: NotebookSlim[];
  scanned: NotebookSlim[];
  maintenance: NotebookSlim[];
  startTime: string | null;
  location: string | null;
  error: string | null;
  lastScanned: string | null;
}

type Action =
  | { type: "START"; um: UMSlim; notebooks: NotebookSlim[]; startTime: string; location: string | null }
  | { type: "SCAN_OK"; notebook: NotebookSlim }
  | { type: "SCAN_ERROR"; message: string }
  | { type: "CLEAR_ERROR" }
  | { type: "PROCEED_SUMMARY"; target: "peripherals" | "summary" }
  | { type: "PROCEED_TO_SUMMARY"; location: string | null }
  | { type: "BACK_TO_SCANNING" }
  | { type: "SAVING" }
  | { type: "DONE" }
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
        location: action.location,
        error: null,
        lastScanned: null,
      };
    }
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
  error: null,
  lastScanned: null,
};

export function useConference() {
  const [state, dispatch] = useReducer(reducer, initialState);

  const startConference = useCallback(
    (um: UMSlim, notebooks: NotebookSlim[]) => {
      const startTime = new Date().toISOString();

      const doStart = (loc: string | null) => {
        dispatch({ type: "START", um, notebooks, startTime, location: loc });
      };

      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => doStart(`${pos.coords.latitude.toFixed(6)},${pos.coords.longitude.toFixed(6)}`),
          () => doStart(null),
          { timeout: 5_000 },
        );
      } else {
        doStart(null);
      }
    },
    [],
  );

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

  const finalize = useCallback(async (): Promise<boolean> => {
    if (!state.um || !state.startTime) return false;

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
      umId: state.um.id,
      dataInicio: state.startTime,
      dataFim,
      localizacao: state.location ?? undefined,
      status: conferenceStatus,
      items,
    };

    try {
      const res = await fetch("/api/conferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      dispatch({ type: "DONE" });
      return true;
    } catch {
      await saveToOutbox(payload);
      dispatch({ type: "DONE" });
      return false;
    }
  }, [state]);

  const reset = useCallback(() => {
    dispatch({ type: "RESET" });
  }, []);

  return { state, startConference, processScan, proceedToSummary, proceedFromPeripherals, backToScanning, finalize, reset };
}
