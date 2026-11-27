import { useQuery } from "@tanstack/react-query";
import type { Categoria } from "@/lib/validations";

interface MaintenanceNotebook {
  id: string;
  hostname: string;
  serial: string | null;
  um: { nome: string; project: { nome: string; cor: string } };
}

export interface ItinerantCoverage {
  id: string;
  nome: string;
  project: { nome: string; cor: string };
  total: number;
  cobertos: number;
  pendentes: { id: string; hostname: string; categoria: Categoria | null; leituras: number }[];
}

interface DashboardStats {
  itinerantCoverage: ItinerantCoverage[];
  conferencesToday: number;
  conferencesWithMissing: number;
  notebooksInMaintenance: number;
  notebooksTotal: number;
  activeTechnicians: number;
  maintenanceNotebooks: MaintenanceNotebook[];
  latestConferences: {
    id: string;
    status: "CONCLUIDO_OK" | "CONCLUIDO_FALTANTES";
    dataInicio: string;
    dataFim: string;
    localizacao: string | null;
    mousesQtd: number | null;
    carregadoresQtd: number | null;
    fonesQtd: number | null;
    user: { id: string; nome: string };
    um: {
      id: string;
      nome: string;
      mouses: boolean;
      carregadores: boolean;
      fones: boolean;
      project: { id: string; nome: string; cor: string };
    };
    umFisica: { nome: string } | null;
    metas: { categoria: Categoria; meta: number }[];
    items: { status: string; notebook: { hostname: string; categoria: Categoria | null } }[];
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
