import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateUMInput } from "@/lib/validations";

export interface UM {
  id: string;
  nome: string;
  projectId: string;
  quantidadeEsperada: number;
  perifericos: boolean;
  mouses: boolean;
  carregadores: boolean;
  fones: boolean;
  createdAt: string;
  project: { id: string; nome: string; cor: string };
  _count: { notebooks: number };
}

async function fetchUMs(): Promise<UM[]> {
  const res = await fetch("/api/ums");
  if (!res.ok) throw new Error("Falha ao carregar UMs");
  return res.json() as Promise<UM[]>;
}

export function useUMs() {
  return useQuery({ queryKey: ["ums"], queryFn: fetchUMs });
}

export function useCreateUM() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateUMInput) => {
      const res = await fetch("/api/ums", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = (await res.json()) as { message: string };
        throw new Error(err.message);
      }
      return res.json() as Promise<UM>;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ums"] }),
  });
}

export function useUpdateUM() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: CreateUMInput }) => {
      const res = await fetch(`/api/ums/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = (await res.json()) as { message: string };
        throw new Error(err.message);
      }
      return res.json() as Promise<UM>;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ums"] }),
  });
}

export function useDeleteUM() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/ums/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = (await res.json()) as { message: string };
        throw new Error(err.message);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ums"] }),
  });
}
