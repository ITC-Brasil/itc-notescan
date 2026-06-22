import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CreateNotebookInput,
  UpdateNotebookInput,
  CreateNotebooksBatchInput,
  ImportNotebooksInput,
} from "@/lib/validations";

export interface Notebook {
  id: string;
  hostname: string;
  serial: string | null;
  patrimonio: string | null;
  status: "ATIVO" | "MANUTENCAO";
  umId: string;
  createdAt: string;
  um: {
    id: string;
    nome: string;
    project: { id: string; nome: string; cor: string };
  };
}

async function fetchNotebooks(umId?: string): Promise<Notebook[]> {
  const url = umId ? `/api/notebooks?umId=${umId}` : "/api/notebooks";
  const res = await fetch(url);
  if (!res.ok) throw new Error("Falha ao carregar notebooks");
  return res.json() as Promise<Notebook[]>;
}

export function useNotebooks(umId?: string) {
  return useQuery({
    queryKey: ["notebooks", umId],
    queryFn: () => fetchNotebooks(umId),
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
        const err = (await res.json()) as { message: string };
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
      return res.json() as Promise<{ created: number; total: number }>;
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
      return res.json() as Promise<{ created: number; total: number }>;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notebooks"] }),
  });
}
