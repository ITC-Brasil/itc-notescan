import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CreateNotebookInput,
  UpdateNotebookInput,
  CreateNotebooksBatchInput,
  ImportNotebooksInput,
  Categoria,
} from "@/lib/validations";

export interface Notebook {
  id: string;
  hostname: string;
  serial: string | null;
  patrimonio: string | null;
  status: "ATIVO" | "MANUTENCAO" | "ARQUIVADO";
  categoria: Categoria | null;
  umId: string;
  createdAt: string;
  um: {
    id: string;
    nome: string;
    project: { id: string; nome: string; cor: string };
  };
}

/** Hostname igual ao original de um notebook arquivado: a UI pergunta reativar × novo. */
export class ArchivedMatchError extends Error {
  constructor(
    message: string,
    readonly archived: { id: string; hostname: string; umNome: string },
  ) {
    super(message);
  }
}

export interface BulkCreateResult {
  total: number;
  created: number;
  reactivated: number;
  archivedConflicts: string[];
  blocked: string[];
}

async function fetchNotebooks(umId?: string, includeArchived = false): Promise<Notebook[]> {
  const params = new URLSearchParams();
  if (umId) params.set("umId", umId);
  if (includeArchived) params.set("includeArchived", "1");
  const res = await fetch(`/api/notebooks?${params}`);
  if (!res.ok) throw new Error("Falha ao carregar notebooks");
  return res.json() as Promise<Notebook[]>;
}

/** Sem `includeArchived`, a API já exclui os ARQUIVADO (uso operacional). */
export function useNotebooks(umId?: string, { includeArchived = false } = {}) {
  return useQuery({
    queryKey: ["notebooks", umId, includeArchived],
    queryFn: () => fetchNotebooks(umId, includeArchived),
  });
}

export function useCreateNotebook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateNotebookInput) => {
      const res = await fetch("/api/notebooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = (await res.json()) as {
          message: string;
          code?: string;
          archived?: ArchivedMatchError["archived"];
        };
        if (err.code === "ARCHIVED_MATCH" && err.archived)
          throw new ArchivedMatchError(err.message, err.archived);
        throw new Error(err.message);
      }
      return res.json() as Promise<Notebook>;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notebooks"] }),
  });
}

export function useUpdateNotebook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateNotebookInput }) => {
      const res = await fetch(`/api/notebooks/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = (await res.json()) as { message: string };
        throw new Error(err.message);
      }
      return res.json() as Promise<Notebook>;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notebooks"] }),
  });
}

export function useDeleteNotebook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/notebooks/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = (await res.json()) as { message: string };
        throw new Error(err.message);
      }
      return res.json() as Promise<{ action: "deleted" | "archived" }>;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notebooks"] }),
  });
}

export function useCreateNotebooksBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateNotebooksBatchInput) => {
      const res = await fetch("/api/notebooks/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = (await res.json()) as { message: string };
        throw new Error(err.message);
      }
      return res.json() as Promise<BulkCreateResult>;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notebooks"] }),
  });
}

export function useImportNotebooks() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: ImportNotebooksInput) => {
      const res = await fetch("/api/notebooks/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = (await res.json()) as { message: string };
        throw new Error(err.message);
      }
      return res.json() as Promise<BulkCreateResult>;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notebooks"] }),
  });
}

export interface NotebookHistoryItem {
  id: string;
  tipo: string;
  descricao: string;
  createdAt: string;
  user: { nome: string };
}

export function useNotebookHistory(notebookId: string | null) {
  return useQuery({
    queryKey: ["notebook-history", notebookId],
    queryFn: async () => {
      const res = await fetch(`/api/notebooks/${notebookId}/history`);
      if (!res.ok) throw new Error("Falha ao carregar histórico");
      return res.json() as Promise<NotebookHistoryItem[]>;
    },
    enabled: !!notebookId,
  });
}

export interface NotebookLocation {
  conferenceId: string;
  dataInicio: string;
  tecnico: string;
  umFisica: { id: string; nome: string } | null;
}

/** UM física de cada leitura do notebook em conferência itinerante. */
export function useNotebookLocations(notebookId: string | null) {
  return useQuery({
    queryKey: ["notebook-locations", notebookId],
    queryFn: async () => {
      const res = await fetch(`/api/notebooks/${notebookId}/locations`);
      if (!res.ok) throw new Error("Falha ao carregar localizações");
      return res.json() as Promise<NotebookLocation[]>;
    },
    enabled: !!notebookId,
  });
}

export function useBulkDeleteNotebooks() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (umId: string) => {
      const res = await fetch("/api/notebooks/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ umId }),
      });
      if (!res.ok) {
        const err = (await res.json()) as { message: string };
        throw new Error(err.message);
      }
      return res.json() as Promise<{ deleted: number; archived: number }>;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notebooks"] }),
  });
}
