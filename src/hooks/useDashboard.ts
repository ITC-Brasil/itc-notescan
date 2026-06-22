import { useQuery } from "@tanstack/react-query";

interface DashboardStats {
  conferencesToday: number;
  conferencesWithMissing: number;
  notebooksInMaintenance: number;
  activeTechnicians: number;
  latestConferences: {
    id: string;
    status: "CONCLUIDO_OK" | "CONCLUIDO_FALTANTES";
    dataInicio: string;
    dataFim: string;
    localizacao: string | null;
    user: { id: string; nome: string };
    um: {
      id: string;
      nome: string;
      project: { id: string; nome: string; cor: string };
    };
    _count: { items: number };
  }[];
}

async function fetchDashboardStats(): Promise<DashboardStats> {
  const res = await fetch("/api/conferences/dashboard");
  if (!res.ok) throw new Error("Falha ao carregar estatísticas");
  return res.json() as Promise<DashboardStats>;
}

export function useDashboard() {
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: fetchDashboardStats,
    refetchInterval: 30_000,
  });
}
