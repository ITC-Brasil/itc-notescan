"use client";

import {
  ClipboardCheck,
  AlertTriangle,
  Wrench,
  Users,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { useDashboard } from "@/hooks/useDashboard";
import { PageHeader } from "@/components/ui/PageHeader";
import { SkeletonCard, SkeletonTable } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/DataTable";
import type { ColumnDef } from "@tanstack/react-table";
import { cn } from "@/lib/utils";

interface ConferenceRow {
  id: string;
  status: "CONCLUIDO_OK" | "CONCLUIDO_FALTANTES";
  dataInicio: string;
  user: { nome: string };
  um: { nome: string; project: { nome: string; cor: string } };
  _count: { items: number };
}

const columns: ColumnDef<ConferenceRow>[] = [
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) =>
      row.original.status === "CONCLUIDO_OK" ? (
        <div className="flex items-center gap-1.5 text-[--itc-sucesso]">
          <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
          <span className="text-xs font-medium">OK</span>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 text-[--itc-erro]">
          <XCircle className="h-4 w-4 flex-shrink-0" />
          <span className="text-xs font-medium">Faltantes</span>
        </div>
      ),
  },
  {
    accessorKey: "user.nome",
    header: "Técnico",
    cell: ({ row }) => (
      <span className="text-sm">{row.original.user.nome}</span>
    ),
  },
  {
    id: "projeto",
    header: "Projeto / UM",
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <span
          className="h-2 w-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: row.original.um.project.cor }}
        />
        <span className="text-sm text-muted-foreground">
          {row.original.um.project.nome}
        </span>
        <span className="text-sm">/ {row.original.um.nome}</span>
      </div>
    ),
  },
  {
    accessorKey: "_count.items",
    header: "Itens",
    cell: ({ row }) => (
      <Badge variant="secondary">{row.original._count.items}</Badge>
    ),
  },
  {
    accessorKey: "dataInicio",
    header: "Data",
    cell: ({ row }) =>
      new Date(row.original.dataInicio).toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }),
  },
];

interface StatCardProps {
  title: string;
  value: number;
  icon: React.ElementType;
  variant?: "default" | "warning" | "error";
}

function StatCard({ title, value, icon: Icon, variant = "default" }: StatCardProps) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{title}</p>
        <div
          className={cn(
            "rounded-md p-1.5",
            variant === "warning" && "bg-[--itc-atencao]/10",
            variant === "error" && "bg-[--itc-erro]/10",
            variant === "default" && "bg-primary/10",
          )}
        >
          <Icon
            className={cn(
              "h-4 w-4",
              variant === "warning" && "text-[--itc-atencao]",
              variant === "error" && "text-[--itc-erro]",
              variant === "default" && "text-primary",
            )}
          />
        </div>
      </div>
      <p className="text-2xl font-semibold text-foreground">{value}</p>
    </div>
  );
}

export default function DashboardPage() {
  const { data, isLoading, isError } = useDashboard();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Visão geral das conferências de hoje"
        icon={ClipboardCheck}
      />

      {isLoading ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
          <SkeletonTable rows={5} />
        </>
      ) : isError ? (
        <EmptyState
          icon={AlertTriangle}
          title="Erro ao carregar"
          description="Não foi possível buscar as estatísticas. Tente recarregar a página."
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              title="Conferências hoje"
              value={data!.conferencesToday}
              icon={ClipboardCheck}
            />
            <StatCard
              title="Técnicos ativos"
              value={data!.activeTechnicians}
              icon={Users}
            />
            <StatCard
              title="Em manutenção"
              value={data!.notebooksInMaintenance}
              icon={Wrench}
              variant="warning"
            />
            <StatCard
              title="Com faltantes"
              value={data!.conferencesWithMissing}
              icon={AlertTriangle}
              variant="error"
            />
          </div>

          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-foreground">
              Últimas conferências
            </h2>
            {data!.latestConferences.length === 0 ? (
              <EmptyState
                icon={ClipboardCheck}
                title="Nenhuma conferência ainda"
                description="As conferências realizadas pelos técnicos aparecerão aqui."
              />
            ) : (
              <DataTable
                columns={columns}
                data={data!.latestConferences as ConferenceRow[]}
                pageSize={10}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}
