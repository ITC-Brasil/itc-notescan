"use client";

import { useState } from "react";
import {
  ClipboardCheck,
  AlertTriangle,
  Wrench,
  Users,
  CheckCircle2,
  XCircle,
  Laptop,
} from "lucide-react";
import { useDashboard } from "@/hooks/useDashboard";
import { PageHeader } from "@/components/ui/PageHeader";
import { SkeletonCard, SkeletonTable } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/DataTable";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  onClick?: () => void;
}

function StatCard({ title, value, icon: Icon, variant = "default", onClick }: StatCardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card p-4 space-y-3",
        onClick && "cursor-pointer hover:bg-muted/30 transition-colors",
      )}
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{title}</p>
        <div
          className={cn(
            "rounded-md p-1.5",
            variant === "warning" && "bg-[--itc-atencao]/10",
            variant === "error" && "bg-[--itc-erro]/10",
            variant === "default" && "bg-[--itc-ciano-7]/10",
          )}
        >
          <Icon className="h-4 w-4 text-[--itc-ciano-7]" />
        </div>
      </div>
      <p className="text-2xl font-semibold text-foreground">{value}</p>
    </div>
  );
}

export default function DashboardPage() {
  const { data, isLoading, isError } = useDashboard();
  const [maintenanceOpen, setMaintenanceOpen] = useState(false);

  return (
    <div className="space-y-6 page-transition">
      <PageHeader
        title="Dashboard"
        description="Visão geral das conferências de hoje"
        icon={ClipboardCheck}
      />

      {isLoading ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
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
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
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
              title="Notebooks cadastrados"
              value={data!.notebooksTotal}
              icon={Laptop}
            />
            <StatCard
              title="Em manutenção"
              value={data!.notebooksInMaintenance}
              icon={Wrench}
              variant="warning"
              onClick={() => setMaintenanceOpen(true)}
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

      <Dialog open={maintenanceOpen} onOpenChange={setMaintenanceOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Notebooks em Manutenção</DialogTitle>
          </DialogHeader>
          {!data?.maintenanceNotebooks.length ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Nenhum notebook em manutenção no momento.
            </p>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden max-h-96 overflow-y-auto">
              {data.maintenanceNotebooks.map((nb, i) => (
                <div
                  key={nb.id}
                  className={cn(
                    "flex items-center gap-3 px-4 py-2.5",
                    i < data.maintenanceNotebooks.length - 1 && "border-b border-border",
                  )}
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: nb.um.project.cor }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-mono font-medium text-foreground">{nb.hostname}</p>
                    <p className="text-xs text-muted-foreground">
                      {nb.um.project.nome} / {nb.um.nome}
                      {nb.serial && ` · ${nb.serial}`}
                    </p>
                  </div>
                  <Badge className="text-xs bg-[--itc-atencao]/15 text-[--itc-atencao] border-[--itc-atencao]/30 hover:bg-[--itc-atencao]/15">
                    Manutenção
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
