"use client";

import { useMemo, useState } from "react";
import {
  ClipboardCheck,
  AlertTriangle,
  Wrench,
  Users,
  CheckCircle2,
  XCircle,
  Laptop,
  MapPin,
  Eye,
  Route,
} from "lucide-react";
import { useDashboard, type ItinerantCoverage } from "@/hooks/useDashboard";
import { CATEGORIA_LABEL } from "@/lib/constants";
import { conferenceCounts, type MetaCategoria } from "@/lib/meta-categoria";
import type { Categoria } from "@/lib/validations";
import { PageHeader } from "@/components/ui/PageHeader";
import { SkeletonCard, SkeletonTable } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/DataTable";
import { ConferenceSummary } from "@/components/ConferenceSummary";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ColumnDef } from "@tanstack/react-table";
import { cn } from "@/lib/utils";

interface ConferenceItem {
  status: string;
  notebook: { hostname: string; categoria: Categoria | null };
}

interface ConferenceRow {
  id: string;
  status: "CONCLUIDO_OK" | "CONCLUIDO_FALTANTES";
  dataInicio: string;
  dataFim: string;
  localizacao: string | null;
  mousesQtd: number | null;
  carregadoresQtd: number | null;
  fonesQtd: number | null;
  user: { nome: string };
  um: {
    nome: string;
    mouses: boolean;
    carregadores: boolean;
    fones: boolean;
    project: { nome: string; cor: string };
  };
  umFisica: { nome: string } | null;
  metas: MetaCategoria[];
  items: ConferenceItem[];
}

/** Cobertura do dia das UMs itinerantes: lidos 2x (abertura + fechamento) / total. */
function ItinerantesDoDia({ coverage }: { coverage: ItinerantCoverage[] }) {
  if (!coverage.length) return null;
  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-foreground">Itinerantes do dia</h2>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {coverage.map((um) => {
          const ok = um.total > 0 && um.cobertos === um.total;
          return (
            <div key={um.id} className="rounded-lg border border-border bg-card p-4 space-y-3">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: um.project.cor }} />
                <span className="text-sm font-medium text-foreground truncate">{um.nome}</span>
                <span
                  className={cn(
                    "ml-auto text-sm font-bold tabular-nums",
                    ok ? "text-itc-sucesso" : "text-itc-atencao",
                  )}
                >
                  {um.cobertos}/{um.total}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">Cobertos = lidos em 2 conferências hoje</p>
              {um.pendentes.length > 0 ? (
                <div className="max-h-40 overflow-y-auto rounded-md border border-border divide-y divide-border">
                  {um.pendentes.map((n) => (
                    <div key={n.id} className="flex items-center gap-2 px-3 py-1.5 text-xs">
                      <span className="tabular-nums font-medium text-foreground">{n.hostname}</span>
                      {n.categoria && <span className="text-muted-foreground">{CATEGORIA_LABEL[n.categoria]}</span>}
                      <span className="ml-auto tabular-nums text-muted-foreground">{n.leituras}/2</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-itc-sucesso flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Todos cobertos hoje
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const timeFmt = { hour: "2-digit", minute: "2-digit" } as const;

function conferenceColumns(onVer: (c: ConferenceRow) => void): ColumnDef<ConferenceRow>[] {
  return [
    {
      id: "data",
      header: "Data",
      cell: ({ row }) => {
        const ini = new Date(row.original.dataInicio);
        const fim = new Date(row.original.dataFim);
        return (
          <div>
            <p className="text-sm font-semibold text-foreground tabular-nums">
              {ini.toLocaleDateString("pt-BR")}
            </p>
            <p className="text-xs text-muted-foreground tabular-nums">
              {ini.toLocaleTimeString("pt-BR", timeFmt)} às {fim.toLocaleTimeString("pt-BR", timeFmt)}
            </p>
          </div>
        );
      },
    },
    {
      accessorKey: "user.nome",
      header: "Técnico",
      cell: ({ row }) => <span className="text-sm">{row.original.user.nome}</span>,
    },
    {
      id: "projeto",
      header: "Projeto / UM",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <span
            className="h-2 w-2 rounded-full shrink-0"
            style={{ backgroundColor: row.original.um.project.cor }}
          />
          <span className="text-sm text-muted-foreground">{row.original.um.project.nome}</span>
          <span className="text-sm">/ {row.original.um.nome}</span>
          {row.original.umFisica && (
            <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
              <Route className="h-3 w-3" /> {row.original.umFisica.nome}
            </span>
          )}
        </div>
      ),
    },
    {
      id: "contagem",
      header: "Contagem",
      cell: ({ row }) => {
        const { escaneados: lidos, ativos } = conferenceCounts(row.original);
        return (
          <span className="text-sm tabular-nums">
            <span className="font-semibold text-foreground">{lidos}</span>
            <span className="text-muted-foreground">/{ativos}</span>
          </span>
        );
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) =>
        row.original.status === "CONCLUIDO_OK" ? (
          <Badge className="bg-itc-sucesso/15 text-itc-sucesso border-itc-sucesso/30 hover:bg-itc-sucesso/15">
            <CheckCircle2 className="h-3 w-3" />
            COMPLETO
          </Badge>
        ) : (
          <Badge className="bg-destructive/10 text-destructive border-destructive/30 hover:bg-destructive/10">
            <XCircle className="h-3 w-3" />
            INCOMPLETO
          </Badge>
        ),
    },
    {
      id: "localidade",
      header: "Localidade",
      cell: ({ row }) =>
        row.original.localizacao ? (
          <Button asChild variant="outline" size="sm">
            <a
              href={`https://www.google.com/maps?q=${encodeURIComponent(row.original.localizacao)}`}
              target="_blank"
              rel="noreferrer"
            >
              <MapPin className="h-3.5 w-3.5" />
              Abrir mapa
            </a>
          </Button>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        ),
    },
    {
      id: "resumo",
      header: "Resumo",
      cell: ({ row }) => (
        <Button variant="outline" size="sm" onClick={() => onVer(row.original)}>
          <Eye className="h-3.5 w-3.5" />
          Ver
        </Button>
      ),
    },
  ];
}

interface StatCardProps {
  title: string;
  value: number;
  icon: React.ElementType;
  variant?: "default" | "warning" | "error";
  onClick?: () => void;
}

function StatCard({ title, value, icon: Icon, variant = "default", onClick }: StatCardProps) {
  const content = (
    <>
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{title}</p>
        <div
          className={cn(
            "rounded-md p-1.5",
            variant === "warning" && "bg-itc-atencao/10",
            variant === "error" && "bg-itc-erro/10",
            variant === "default" && "bg-itc-ciano-7/10",
          )}
        >
          <Icon
            className={cn(
              "h-4 w-4",
              variant === "warning" && "text-itc-atencao",
              variant === "error" && "text-itc-erro",
              variant === "default" && "text-itc-ciano-7",
            )}
          />
        </div>
      </div>
      <p className="text-2xl font-semibold text-foreground tabular-nums">{value}</p>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="w-full h-full rounded-lg border border-border bg-card shadow-1 p-4 space-y-3 text-left cursor-pointer hover:bg-muted/30 transition-colors"
      >
        {content}
      </button>
    );
  }

  return (
    <div className="h-full rounded-lg border border-border bg-card shadow-1 p-4 space-y-3">
      {content}
    </div>
  );
}

export default function DashboardPage() {
  const { data, isLoading, isError } = useDashboard();
  const [maintenanceOpen, setMaintenanceOpen] = useState(false);
  const [selected, setSelected] = useState<ConferenceRow | null>(null);
  const columns = useMemo(() => conferenceColumns(setSelected), []);
  const selectedCounts = selected ? conferenceCounts(selected) : null;

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
            <div className="col-span-2 sm:col-span-1">
              <StatCard
                title="Conferências hoje"
                value={data!.conferencesToday}
                icon={ClipboardCheck}
              />
            </div>
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

          <ItinerantesDoDia coverage={data!.itinerantCoverage} />

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
                data={data!.latestConferences as unknown as ConferenceRow[]}
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
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: nb.um.project.cor }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm tabular-nums font-medium text-foreground">{nb.hostname}</p>
                    <p className="text-xs text-muted-foreground">
                      {nb.um.project.nome} / {nb.um.nome}
                      {nb.serial && ` · ${nb.serial}`}
                    </p>
                  </div>
                  <Badge className="text-xs bg-itc-atencao/15 text-itc-atencao border-itc-atencao/30 hover:bg-itc-atencao/15">
                    Manutenção
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Resumo — botão "Ver" da tabela */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Resumo</DialogTitle>
            {selected && (
              <p className="text-xs text-muted-foreground">
                {selected.um.nome} · {new Date(selected.dataInicio).toLocaleDateString("pt-BR")} ·{" "}
                {new Date(selected.dataInicio).toLocaleTimeString("pt-BR", timeFmt)} às{" "}
                {new Date(selected.dataFim).toLocaleTimeString("pt-BR", timeFmt)}
              </p>
            )}
          </DialogHeader>
          {selected && selectedCounts && (
            <ConferenceSummary
              tecnico={selected.user.nome}
              localizacao={selected.localizacao}
              escaneados={selectedCounts.escaneados}
              faltantes={selectedCounts.faltantes}
              manutencao={selectedCounts.manutencao}
              peripherals={
                selected.um.mouses || selected.um.carregadores || selected.um.fones
                  ? {
                      ...(selected.um.mouses && { mouses: selected.mousesQtd }),
                      ...(selected.um.carregadores && { carregadores: selected.carregadoresQtd }),
                      ...(selected.um.fones && { fones: selected.fonesQtd }),
                    }
                  : undefined
              }
              faltantesList={selectedCounts.faltantesList}
              manutencaoList={selectedCounts.manutencaoList}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
