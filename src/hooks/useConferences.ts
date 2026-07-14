import { useQuery } from "@tanstack/react-query";

export interface ConferenceRecord {
  id: string;
  status: "CONCLUIDO_OK" | "CONCLUIDO_FALTANTES";
  dataInicio: string;
  dataFim: string;
  localizacao: string | null;
  mousesQtd: number | null;
  carregadoresQtd: number | null;
  fonesQtd: number | null;
  user: { id: string; nome: string };
  um: { id: string; nome: string; mouses: boolean; carregadores: boolean; fones: boolean; project: { id: string; nome: string; cor: string } };
  items: { status: string; notebook: { hostname: string } }[];
  _count: { items: number };
}

export interface ConferencesFilters {
  limit?: number;
  userId?: string;
  umId?: string;
  status?: string;
  from?: string;
  to?: string;
}

async function fetchConferences(filters: ConferencesFilters): Promise<ConferenceRecord[]> {
  const params = new URLSearchParams();
  if (filters.limit) params.set("limit", String(filters.limit));
  if (filters.userId) params.set("userId", filters.userId);
  if (filters.umId) params.set("umId", filters.umId);
  if (filters.status) params.set("status", filters.status);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);

  const res = await fetch(`/api/conferences?${params.toString()}`);
  if (!res.ok) throw new Error("Falha ao carregar conferências");
  return res.json() as Promise<ConferenceRecord[]>;
}

export function useConferences(filters: ConferencesFilters = {}) {
  return useQuery({
    queryKey: ["conferences", filters],
    queryFn: () => fetchConferences(filters),
  });
}
