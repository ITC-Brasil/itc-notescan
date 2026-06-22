"use client";

import { useState } from "react";
import {
  BarChart3,
  Download,
  Filter,
  X,
  ChevronsUpDown,
  Check,
  CalendarIcon,
} from "lucide-react";
import { useConferences, type ConferencesFilters } from "@/hooks/useConferences";
import { useUsers } from "@/hooks/useUsers";
import { useUMs } from "@/hooks/useUMs";
import { useProjects } from "@/hooks/useProjects";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/DataTable";
import type { ConferenceRecord } from "@/hooks/useConferences";
import type { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";

const columns: ColumnDef<ConferenceRecord>[] = [
  {
    accessorKey: "dataInicio",
    header: "Data",
    cell: ({ row }) => {
      const d = new Date(row.original.dataInicio);
      return (
        <span className="text-sm tabular-nums">
          {d.toLocaleDateString("pt-BR")}{" "}
          {d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
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

interface ComboboxFilterProps {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  options: { value: string; label: string; sublabel?: string; color?: string }[];
}

function ComboboxFilter({ value, onChange, placeholder, options }: ComboboxFilterProps) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="flex-1 min-w-0 h-8 text-sm justify-between font-normal"
        >
          <span className="flex items-center gap-2 truncate min-w-0">
            {selected?.color && (
              <span
                className="h-2 w-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: selected.color }}
              />
            )}
            <span className="truncate">
              {selected ? selected.label : placeholder}
            </span>
          </span>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50 ml-1" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-60" align="start">
        <Command>
          <CommandInput placeholder={`Buscar ${placeholder.toLowerCase()}...`} className="h-8" />
          <CommandList>
            <CommandEmpty>Nenhum resultado.</CommandEmpty>
            <CommandGroup>
              {value && (
                <CommandItem
                  value="__clear__"
                  onSelect={() => { onChange(""); setOpen(false); }}
                  className="text-muted-foreground text-xs"
                >
                  <X className="h-3 w-3 mr-2" />
                  Limpar seleção
                </CommandItem>
              )}
              {options.map((opt) => (
                <CommandItem
                  key={opt.value}
                  value={opt.label + (opt.sublabel ?? "")}
                  onSelect={() => { onChange(opt.value); setOpen(false); }}
                >
                  <Check
                    className={cn("mr-2 h-4 w-4", value === opt.value ? "opacity-100" : "opacity-0")}
                  />
                  {opt.color && (
                    <span
                      className="h-2 w-2 rounded-full mr-2 flex-shrink-0"
                      style={{ backgroundColor: opt.color }}
                    />
                  )}
                  {opt.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function DateRangeFilter({
  value,
  onChange,
}: {
  value: DateRange | undefined;
  onChange: (r: DateRange | undefined) => void;
}) {
  const [open, setOpen] = useState(false);

  const label = value?.from
    ? value.to
      ? `${value.from.toLocaleDateString("pt-BR")} – ${value.to.toLocaleDateString("pt-BR")}`
      : value.from.toLocaleDateString("pt-BR")
    : "Período";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="flex-1 min-w-0 h-8 text-sm justify-between font-normal"
        >
          <span className="flex items-center gap-2 truncate">
            <CalendarIcon className="h-3.5 w-3.5 flex-shrink-0 opacity-60" />
            <span className="truncate">{label}</span>
          </span>
          {value?.from && (
            <X
              className="h-3.5 w-3.5 shrink-0 ml-1 opacity-50 hover:opacity-100"
              onClick={(e) => { e.stopPropagation(); onChange(undefined); setOpen(false); }}
            />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          selected={value}
          onSelect={onChange}
          numberOfMonths={2}
        />
      </PopoverContent>
    </Popover>
  );
}

export default function RelatoriosPage() {
  const { data: users } = useUsers();
  const { data: ums } = useUMs();
  const { data: projects } = useProjects();

  const [filters, setFilters] = useState<ConferencesFilters>({ limit: 100 });
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [projectId, setProjectId] = useState("");

  const { data: conferences, isLoading } = useConferences(filters);

  const setFilter = (key: keyof ConferencesFilters, value: string | undefined) => {
    setFilters((prev) => ({ ...prev, [key]: value || undefined }));
  };

  const handleDateRange = (range: DateRange | undefined) => {
    setDateRange(range);
    if (range?.from) {
      const from = range.from;
      from.setHours(0, 0, 0, 0);
      setFilters((prev) => ({ ...prev, from: from.toISOString() }));
    } else {
      setFilters((prev) => ({ ...prev, from: undefined }));
    }
    if (range?.to) {
      const to = new Date(range.to);
      to.setHours(23, 59, 59, 999);
      setFilters((prev) => ({ ...prev, to: to.toISOString() }));
    } else {
      setFilters((prev) => ({ ...prev, to: undefined }));
    }
  };

  const clearFilters = () => {
    setFilters({ limit: 100 });
    setDateRange(undefined);
    setProjectId("");
  };

  const filteredUMs = projectId
    ? (ums ?? []).filter((um) => um.project.id === projectId)
    : (ums ?? []);

  const hasActiveFilters =
    filters.userId || filters.umId || filters.status || filters.from || filters.to || projectId;

  const userOptions = (users ?? []).map((u) => ({ value: u.id, label: u.nome }));
  const projectOptions = (projects ?? []).map((p) => ({
    value: p.id,
    label: p.nome,
    color: p.cor,
  }));
  const umOptions = filteredUMs.map((um) => ({
    value: um.id,
    label: um.nome,
    color: um.project.cor,
  }));
  const statusOptions = [
    { value: "CONCLUIDO_OK", label: "Concluído" },
    { value: "CONCLUIDO_FALTANTES", label: "Faltantes" },
  ];

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
        <div className="flex flex-wrap gap-2">
          <ComboboxFilter
            value={filters.userId ?? ""}
            onChange={(v) => setFilter("userId", v)}
            placeholder="Técnico"
            options={userOptions}
          />
          <ComboboxFilter
            value={projectId}
            onChange={(v) => {
              setProjectId(v);
              if (filters.umId) setFilter("umId", undefined);
            }}
            placeholder="Projeto"
            options={projectOptions}
          />
          <ComboboxFilter
            value={filters.umId ?? ""}
            onChange={(v) => setFilter("umId", v)}
            placeholder="UM"
            options={umOptions}
          />
          <ComboboxFilter
            value={filters.status ?? ""}
            onChange={(v) => setFilter("status", v)}
            placeholder="Status"
            options={statusOptions}
          />
          <DateRangeFilter value={dateRange} onChange={handleDateRange} />
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
          <DataTable columns={columns} data={conferences} pageSize={20} />
        </div>
      )}
    </div>
  );
}
