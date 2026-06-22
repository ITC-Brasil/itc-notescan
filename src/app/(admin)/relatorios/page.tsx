"use client";

import { useState } from "react";
import { BarChart3, Download, Filter, X } from "lucide-react";
import { useConferences, type ConferencesFilters } from "@/hooks/useConferences";
import { useUsers } from "@/hooks/useUsers";
import { useUMs } from "@/hooks/useUMs";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/DataTable";
import type { ConferenceRecord } from "@/hooks/useConferences";

const columns: ColumnDef<ConferenceRecord>[] = [
  {
    accessorKey: "dataInicio",
    header: "Data",
    cell: ({ row }) => {
      const d = new Date(row.original.dataInicio);
      return (
        <span className="text-sm tabular-nums">
          {d.toLocaleDateString("pt-BR")} {d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
        </span>
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
          className="h-2 w-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: row.original.um.project.cor }}
        />
        <span className="text-sm">
          {row.original.um.project.nome} / {row.original.um.nome}
        </span>
      </div>
    ),
  },
  {
    accessorKey: "_count.items",
    header: "Notebooks",
    cell: ({ row }) => (
      <span className="text-sm tabular-nums">{row.original._count.items}</span>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <Badge
        variant={row.original.status === "CONCLUIDO_OK" ? "secondary" : "destructive"}
        className="text-xs"
      >
        {row.original.status === "CONCLUIDO_OK" ? "Concluído" : "Faltantes"}
      </Badge>
    ),
  },
  {
    accessorKey: "localizacao",
    header: "Localização",
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">
        {row.original.localizacao ?? "—"}
      </span>
    ),
  },
];

function exportCSV(conferences: ConferenceRecord[]) {
  const header = "Data,Hora,Técnico,Projeto,UM,Notebooks,Status,Localização";
  const rows = conferences.map((c) => {
    const d = new Date(c.dataInicio);
    const data = d.toLocaleDateString("pt-BR");
    const hora = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    const status = c.status === "CONCLUIDO_OK" ? "Concluído" : "Faltantes";
    const localizacao = c.localizacao ?? "";
    return [data, hora, c.user.nome, c.um.project.nome, c.um.nome, c._count.items, status, localizacao]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(",");
  });
  const csv = [header, ...rows].join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `conferencias_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function RelatoriosPage() {
  const { data: users } = useUsers();
  const { data: ums } = useUMs();

  const [filters, setFilters] = useState<ConferencesFilters>({ limit: 100 });
  const [fromInput, setFromInput] = useState("");
  const [toInput, setToInput] = useState("");

  const { data: conferences, isLoading } = useConferences(filters);

  const setFilter = (key: keyof ConferencesFilters, value: string | undefined) => {
    setFilters((prev) => ({ ...prev, [key]: value || undefined }));
  };

  const clearFilters = () => {
    setFilters({ limit: 100 });
    setFromInput("");
    setToInput("");
  };

  const hasActiveFilters =
    filters.userId || filters.umId || filters.status || filters.from || filters.to;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Relatórios"
        description="Histórico completo de conferências"
        icon={BarChart3}
        action={
          <Button
            size="sm"
            variant="outline"
            onClick={() => conferences && exportCSV(conferences)}
            disabled={!conferences?.length}
          >
            <Download className="h-4 w-4 mr-1.5" />
            Exportar CSV
          </Button>
        }
      />

      <div className="rounded-lg border border-border p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Filtros</span>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs text-muted-foreground ml-auto"
              onClick={clearFilters}
            >
              <X className="h-3 w-3 mr-1" />
              Limpar
            </Button>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <Select
            value={filters.userId ?? ""}
            onValueChange={(v) => setFilter("userId", v)}
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue placeholder="Técnico" />
            </SelectTrigger>
            <SelectContent>
              {users?.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.umId ?? ""}
            onValueChange={(v) => setFilter("umId", v)}
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue placeholder="UM" />
            </SelectTrigger>
            <SelectContent>
              {ums?.map((um) => (
                <SelectItem key={um.id} value={um.id}>
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: um.project.cor }}
                    />
                    {um.nome}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.status ?? ""}
            onValueChange={(v) => setFilter("status", v)}
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="CONCLUIDO_OK">Concluído</SelectItem>
              <SelectItem value="CONCLUIDO_FALTANTES">Faltantes</SelectItem>
            </SelectContent>
          </Select>

          <Input
            type="date"
            className="h-8 text-sm"
            value={fromInput}
            onChange={(e) => {
              setFromInput(e.target.value);
              setFilter("from", e.target.value ? new Date(e.target.value).toISOString() : undefined);
            }}
            placeholder="De"
          />

          <Input
            type="date"
            className="h-8 text-sm"
            value={toInput}
            onChange={(e) => {
              setToInput(e.target.value);
              if (e.target.value) {
                const to = new Date(e.target.value);
                to.setHours(23, 59, 59, 999);
                setFilter("to", to.toISOString());
              } else {
                setFilter("to", undefined);
              }
            }}
            placeholder="Até"
          />
        </div>
      </div>

      {isLoading ? (
        <SkeletonTable rows={8} />
      ) : !conferences?.length ? (
        <EmptyState
          icon={BarChart3}
          title="Nenhuma conferência encontrada"
          description={
            hasActiveFilters
              ? "Nenhuma conferência corresponde aos filtros selecionados."
              : "As conferências aparecerão aqui após serem realizadas."
          }
          action={
            hasActiveFilters ? (
              <Button size="sm" variant="outline" onClick={clearFilters}>
                <X className="h-4 w-4 mr-1.5" />
                Limpar filtros
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            {conferences.length} conferência{conferences.length !== 1 ? "s" : ""} encontrada
            {conferences.length !== 1 ? "s" : ""}
          </p>
          <DataTable columns={columns} data={conferences} />
        </div>
      )}
    </div>
  );
}
