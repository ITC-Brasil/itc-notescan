import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import type { Categoria } from "@/lib/validations";

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
  um: { id: string; nome: string; mouses: boolean; carregadores: boolean; fones: boolean; tipo?: "FIXA" | "ITINERANTE"; project: { id: string; nome: string; cor: string } };
  umFisica?: { id: string; nome: string } | null;
  metas: { categoria: Categoria; meta: number }[];
  items: { status: string; notebook: { hostname: string; categoria: Categoria | null } }[];
  _count: { items: number };
}

export interface ConferencesFilters {
  limit?: number;
  offset?: number;
  userId?: string;
  umId?: string;
  status?: string;
  from?: string;
  to?: string;
}

async function fetchConferences(filters: ConferencesFilters): Promise<ConferenceRecord[]> {
  const params = new URLSearchParams();
  if (filters.limit) params.set("limit", String(filters.limit));
  if (filters.offset) params.set("offset", String(filters.offset));
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

/**
 * Paginated history via offset. Each page holds `pageSize` records; the next
 * page is requested only when the last one was full ("Carregar mais").
 */
export function useInfiniteConferences(
  filters: Omit<ConferencesFilters, "limit" | "offset"> = {},
  pageSize = 10,
) {
  return useInfiniteQuery({
    queryKey: ["conferences", "infinite", filters, pageSize],
    queryFn: ({ pageParam }) =>
      fetchConferences({ ...filters, limit: pageSize, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length < pageSize ? undefined : allPages.length * pageSize,
  });
}

/** Só conferências de UM FIXA contam para a meta diária (itinerantes não). */
export function countsForMeta(c: Pick<ConferenceRecord, "um">): boolean {
  return c.um.tipo !== "ITINERANTE";
}
