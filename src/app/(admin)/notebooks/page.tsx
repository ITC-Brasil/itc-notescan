"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Laptop,
  Plus,
  Pencil,
  Trash2,
  Upload,
  Layers,
  Wrench,
  CheckCircle2,
  XCircle,
  History,
  ChevronDown,
  ChevronRight,
  Download,
  Check,
  ChevronsUpDown,
  AlertCircle,
  Info,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  useNotebooks,
  ArchivedMatchError,
  type BulkCreateResult,
  useCreateNotebook,
  useUpdateNotebook,
  useDeleteNotebook,
  useCreateNotebooksBatch,
  useImportNotebooks,
  useNotebookHistory,
  useBulkDeleteNotebooks,
  type Notebook,
} from "@/hooks/useNotebooks";
import { useUMs } from "@/hooks/useUMs";
import {
  CATEGORIAS,
  type Categoria,
  createNotebookSchema,
  createNotebooksBatchSchema,
  updateNotebookSchema,
  type CreateNotebooksBatchInput,
  type CreateNotebookInput,
  type UpdateNotebookInput,
} from "@/lib/validations";
import { PageHeader } from "@/components/ui/PageHeader";
import { Checkbox } from "@/components/ui/checkbox";
import { originalHostname } from "@/lib/notebook-hostname";
import { CATEGORIA_LABEL } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmationDialog } from "@/components/ui/ConfirmationDialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type NotebookFormValues = {
  hostname: string;
  serial?: string;
  patrimonio?: string;
  status: "ATIVO" | "MANUTENCAO";
  umId: string;
  categoria?: Categoria | null;
};

/** Seletor de categoria — só aparece quando a UM escolhida é ITINERANTE. */
function CategoriaField({
  umId,
  value,
  onChange,
}: {
  umId: string;
  value: Categoria | null | undefined;
  onChange: (v: Categoria | null) => void;
}) {
  const { data: ums } = useUMs();
  const itinerante = ums?.find((u) => u.id === umId)?.tipo === "ITINERANTE";
  // UM fixa não tem categoria: limpa o valor ao trocar para uma UM fixa.
  useEffect(() => {
    if (ums && !itinerante && value) onChange(null);
  }, [ums, itinerante, value, onChange]);
  if (!itinerante) return null;
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium text-foreground">Categoria</p>
      <Select value={value ?? ""} onValueChange={(v) => onChange(v as Categoria)}>
        <SelectTrigger>
          <SelectValue placeholder="Obrigatória em UM itinerante" />
        </SelectTrigger>
        <SelectContent>
          {CATEGORIAS.map((c) => (
            <SelectItem key={c} value={c}>{CATEGORIA_LABEL[c]}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function UMCombobox({
  value,
  onChange,
  placeholder = "Selecione a UM",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const { data: ums } = useUMs();
  const [open, setOpen] = useState(false);
  const selected = ums?.find((u) => u.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          {selected ? (
            <span className="flex items-center gap-2 text-left min-w-0">
              <span
                className="h-2 w-2 rounded-full shrink-0"
                style={{ backgroundColor: selected.project.cor }}
              />
              <span className="truncate">{selected.nome}</span>
            </span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-full min-w-[280px]" align="start">
        <Command>
          <CommandInput placeholder="Buscar UM..." className="h-9" />
          <CommandList>
            <CommandEmpty>Nenhuma UM encontrada.</CommandEmpty>
            <CommandGroup>
              {ums?.map((um) => (
                <CommandItem
                  key={um.id}
                  value={`${um.project.nome} ${um.nome}`}
                  onSelect={() => { onChange(um.id); setOpen(false); }}
                  className="flex items-start gap-3 py-2"
                >
                  <Check
                    className={cn("mt-0.5 h-4 w-4 shrink-0", value === um.id ? "opacity-100" : "opacity-0")}
                  />
                  <span
                    className="h-2 w-2 rounded-full shrink-0 mt-1.5"
                    style={{ backgroundColor: um.project.cor }}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium leading-tight">{um.nome}</p>
                    <p className="text-xs text-muted-foreground leading-tight">{um.project.nome}</p>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/** Texto do resultado de lote/import (criados, reativados, bloqueados). */
function bulkSummary(r: BulkCreateResult, verbo: string): string {
  const parts = [`${r.created} de ${r.total} ${verbo}`];
  if (r.reactivated) parts.push(`${r.reactivated} reativado${r.reactivated !== 1 ? "s" : ""}`);
  if (r.blocked.length) parts.push(`${r.blocked.length} não reativado${r.blocked.length !== 1 ? "s" : ""} (já existe ativo)`);
  return parts.join(" · ") + ".";
}

/** Conflitos com arquivados em lote/import: uma decisão em massa, sem diálogo por item. */
function ArchivedConflictsPanel({
  hostnames,
  pending,
  onChoose,
}: {
  hostnames: string[];
  pending: boolean;
  onChoose: (choice: "reactivate" | "new" | "skip") => void;
}) {
  return (
    <div className="rounded-lg border border-itc-atencao/30 bg-itc-atencao/10 p-3 space-y-2">
      <p className="text-sm font-medium text-foreground">
        {hostnames.length} hostname{hostnames.length !== 1 ? "s pertencem" : " pertence"} a notebooks arquivados
      </p>
      <p className="text-xs text-muted-foreground max-h-20 overflow-y-auto tabular-nums">{hostnames.join(", ")}</p>
      <p className="text-xs text-muted-foreground">
        Reativar = mesma máquina (histórico preservado). Cadastrar como novos = outras máquinas.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" disabled={pending} onClick={() => onChoose("reactivate")}>Reativar todos</Button>
        <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => onChoose("new")}>Cadastrar todos como novos</Button>
        <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => onChoose("skip")}>Pular</Button>
      </div>
    </div>
  );
}

function NotebookFormDialog({
  open,
  onOpenChange,
  notebook,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  notebook?: Notebook;
}) {
  const createMutation = useCreateNotebook();
  const updateMutation = useUpdateNotebook();
  const isEditing = !!notebook;
  const [archivedMatch, setArchivedMatch] = useState<{
    data: NotebookFormValues;
    archived: ArchivedMatchError["archived"];
  } | null>(null);

  const schema = isEditing ? updateNotebookSchema : createNotebookSchema;

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      hostname: notebook?.hostname ?? "",
      serial: notebook?.serial ?? "",
      patrimonio: notebook?.patrimonio ?? "",
      status: notebook?.status ?? "ATIVO",
      umId: notebook?.umId ?? "",
      categoria: notebook?.categoria ?? null,
    } as NotebookFormValues,
  });
  const { data: ums } = useUMs();
  // eslint-disable-next-line react-hooks/incompatible-library
  const watchedUmId = form.watch("umId") as string;
  const watchedCategoria = form.watch("categoria") as Categoria | null | undefined;
  const setCategoria = useCallback(
    (v: Categoria | null) => form.setValue("categoria", v),
    [form],
  );
  // quantidadeEsperada é manual na UM: mover notebook não ajusta as contagens.
  const movedFrom =
    isEditing && watchedUmId && watchedUmId !== notebook.umId
      ? ums?.find((u) => u.id === notebook.umId)?.nome
      : undefined;

  const onSubmit = async (data: NotebookFormValues, onArchived?: "reactivate" | "new") => {
    try {
      if (isEditing) {
        await updateMutation.mutateAsync({
          id: notebook.id,
          data: data as UpdateNotebookInput,
        });
        toast.success("Notebook atualizado.");
      } else {
        await createMutation.mutateAsync({ ...(data as CreateNotebookInput), onArchived });
        toast.success(onArchived === "reactivate" ? "Notebook reativado com o histórico preservado." : "Notebook criado.");
      }
      setArchivedMatch(null);
      onOpenChange(false);
      form.reset();
    } catch (err) {
      if (err instanceof ArchivedMatchError) {
        setArchivedMatch({ data, archived: err.archived });
        return;
      }
      setArchivedMatch(null);
      toast.error(err instanceof Error ? err.message : "Erro ao salvar notebook.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Notebook" : "Novo Notebook"}</DialogTitle>
        </DialogHeader>
        {archivedMatch ? (
          <div className="space-y-4">
            <p className="text-sm text-foreground">
              <span className="font-medium tabular-nums">{archivedMatch.archived.hostname}</span> pertence a um
              notebook arquivado (UM {archivedMatch.archived.umNome}).
            </p>
            <p className="text-xs text-muted-foreground">
              Reativar: é a mesma máquina — restaura o hostname na UM escolhida e preserva o histórico.
              Cadastrar como novo: é outra máquina — o arquivado continua arquivado.
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="ghost" onClick={() => setArchivedMatch(null)}>Cancelar</Button>
              <Button
                variant="outline"
                disabled={createMutation.isPending}
                onClick={() => onSubmit(archivedMatch.data, "new")}
              >
                Cadastrar como novo
              </Button>
              <Button disabled={createMutation.isPending} onClick={() => onSubmit(archivedMatch.data, "reactivate")}>
                Reativar
              </Button>
            </div>
          </div>
        ) : (
        <Form {...form}>
          <form onSubmit={form.handleSubmit((d) => onSubmit(d))} className="space-y-4">
            <FormField
              control={form.control}
              name="umId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Unidade Móvel</FormLabel>
                  <FormControl>
                    <UMCombobox value={field.value as string} onChange={field.onChange} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="hostname"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Hostname</FormLabel>
                  <FormControl>
                    <Input placeholder="BSBIA01-EST01" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="serial"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>N/S</FormLabel>
                    <FormControl>
                      <Input placeholder="Opcional" {...field} value={field.value as string ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="patrimonio"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Patrimônio</FormLabel>
                    <FormControl>
                      <Input placeholder="Opcional" {...field} value={field.value as string ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <CategoriaField umId={watchedUmId} value={watchedCategoria} onChange={setCategoria} />
            {movedFrom && (
              <p className="text-xs rounded-lg border border-itc-atencao/30 bg-itc-atencao/10 p-2 text-foreground">
                O notebook sai de <span className="font-medium">{movedFrom}</span>. A quantidade esperada
                das UMs é manual: ajuste a de {movedFrom} (e a da UM de destino) em Unidades Móveis.
              </p>
            )}
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value as string}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="ATIVO">Ativo</SelectItem>
                      <SelectItem value="MANUTENCAO">Em Manutenção</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {createMutation.isPending || updateMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function BatchDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const batchMutation = useCreateNotebooksBatch();

  const form = useForm({
    resolver: zodResolver(createNotebooksBatchSchema),
    defaultValues: {
      prefix: "",
      start: 1,
      end: 106,
      umId: "",
      status: "ATIVO" as const,
    } as CreateNotebooksBatchInput,
  });

  const [conflicts, setConflicts] = useState<{ data: CreateNotebooksBatchInput; hostnames: string[] } | null>(null);

  const close = () => {
    setConflicts(null);
    onOpenChange(false);
    form.reset();
  };

  const onSubmit = async (data: CreateNotebooksBatchInput) => {
    try {
      const result = await batchMutation.mutateAsync(data);
      toast.success(bulkSummary(result, "notebooks criados"));
      // Conflitos com arquivados: mantém aberto para a decisão em massa.
      if (result.archivedConflicts.length) setConflicts({ data, hostnames: result.archivedConflicts });
      else close();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao criar notebooks em lote.");
    }
  };

  const handleArchivedChoice = async (choice: "reactivate" | "new" | "skip") => {
    if (choice === "skip" || !conflicts) return close();
    // Reenvia o mesmo lote: os já criados são ignorados (skipDuplicates).
    try {
      toast.success(bulkSummary(await batchMutation.mutateAsync({ ...conflicts.data, onArchived: choice }), "criados"));
      close();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao criar notebooks em lote.");
    }
  };

  // eslint-disable-next-line react-hooks/incompatible-library
  const start = form.watch("start");
  const batchUmId = form.watch("umId");
  const batchCategoria = form.watch("categoria");
  const setBatchCategoria = useCallback(
    (v: Categoria | null) => form.setValue("categoria", v),
    [form],
  );
  const end = form.watch("end");
  const prefix = form.watch("prefix");
  const preview =
    prefix && start && end && end >= start
      ? [
          `${prefix}${start < 10 ? `0${start}` : start}`,
          end > start ? `${prefix}${end < 10 ? `0${end}` : end}` : null,
        ]
          .filter(Boolean)
          .join(" ... ")
      : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Cadastro em Lote</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="umId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Unidade Móvel</FormLabel>
                  <FormControl>
                    <UMCombobox value={field.value} onChange={field.onChange} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="prefix"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Prefixo</FormLabel>
                  <FormControl>
                    <Input placeholder="BSBIA01-EST" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="start"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>De</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="end"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Até</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <CategoriaField umId={batchUmId} value={batchCategoria} onChange={setBatchCategoria} />
            {preview && (
              <p className="text-xs text-muted-foreground tabular-nums bg-muted rounded px-2 py-1.5">
                Prévia: {preview} ({end - start + 1} notebooks)
              </p>
            )}
            {conflicts && (
              <ArchivedConflictsPanel
                hostnames={conflicts.hostnames}
                pending={batchMutation.isPending}
                onChoose={handleArchivedChoice}
              />
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={batchMutation.isPending}>
                {batchMutation.isPending ? "Criando..." : "Criar"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

type ImportRow = { hostname: string; serial?: string; patrimonio?: string; categoria?: Categoria };

function downloadCSVTemplate() {
  const csv = "hostname,serial,patrimonio,status,categoria\nBSBIA01-EST01,,,ATIVO,\nQDFM-INSTR01,,,ATIVO,INSTRUTOR\n";
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "modelo_notebooks.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function ImportDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const importMutation = useImportNotebooks();
  const fileRef = useRef<HTMLInputElement>(null);
  const [selectedUmId, setSelectedUmId] = useState("");
  const [preview, setPreview] = useState<ImportRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);

  const parseCSV = useCallback((text: string) => {
    const lines = text.trim().split(/\r?\n/);
    if (!lines.length) return;

    const firstLine = lines[0].toLowerCase();
    const startIdx = firstLine.startsWith("hostname") ? 1 : 0;

    const rows: ImportRow[] = [];
    const errors: string[] = [];

    for (let i = startIdx; i < lines.length; i++) {
      const cols = lines[i].split(",").map((c) => c.trim());
      if (!cols[0]) { errors.push(`Linha ${i + 1}: hostname vazio`); continue; }
      const categoria = cols[4]?.toUpperCase() || undefined;
      if (categoria && !(CATEGORIAS as readonly string[]).includes(categoria)) {
        errors.push(`Linha ${i + 1}: categoria "${cols[4]}" inválida (use ${CATEGORIAS.join(", ")})`);
        continue;
      }
      rows.push({
        hostname: cols[0],
        serial: cols[1] || undefined,
        patrimonio: cols[2] || undefined,
        categoria: categoria as Categoria | undefined,
      });
    }

    if (errors.length) {
      setParseError(errors.join("; "));
      setPreview([]);
    } else {
      setParseError(null);
      setPreview(rows);
    }
  }, []);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => parseCSV(ev.target?.result as string);
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!selectedUmId) { toast.error("Selecione uma UM."); return; }
    if (!preview.length) { toast.error("Nenhum notebook para importar."); return; }
    try {
      const result = await importMutation.mutateAsync({ umId: selectedUmId, rows: preview });
      toast.success(bulkSummary(result, "notebooks importados"));
      // Conflitos com arquivados: mantém aberto para a decisão em massa.
      if (result.archivedConflicts.length) setConflicts(result.archivedConflicts);
      else close();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao importar.");
    }
  };

  const [conflicts, setConflicts] = useState<string[] | null>(null);

  const close = () => {
    setConflicts(null);
    onOpenChange(false);
    setPreview([]);
    setSelectedUmId("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleArchivedChoice = async (choice: "reactivate" | "new" | "skip") => {
    if (choice === "skip" || !conflicts) return close();
    try {
      const rows = preview.filter((r) => conflicts.includes(r.hostname));
      toast.success(
        bulkSummary(await importMutation.mutateAsync({ umId: selectedUmId, rows, onArchived: choice }), "importados"),
      );
      close();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao importar.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Importar CSV</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium text-foreground mb-1.5">Unidade Móvel</p>
            <UMCombobox value={selectedUmId} onChange={setSelectedUmId} />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-sm font-medium text-foreground">Arquivo CSV</p>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1.5 text-muted-foreground"
                onClick={downloadCSVTemplate}
                type="button"
              >
                <Download className="h-3.5 w-3.5" />
                Baixar modelo
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mb-2">
              Colunas: hostname, serial (opcional), patrimônio (opcional), status (opcional),
              categoria (obrigatória em UM itinerante: INSTRUTOR, PEDAGOGA ou COORDENADORA)
            </p>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleFile}
              className="text-sm text-muted-foreground file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border file:border-border file:text-xs file:font-medium file:bg-muted file:text-foreground hover:file:bg-muted/80 cursor-pointer"
            />
          </div>
          {parseError && (
            <p className="text-xs text-destructive bg-destructive/10 rounded px-2 py-1.5">
              {parseError}
            </p>
          )}
          {preview.length > 0 && (
            <div className="border border-border rounded-lg overflow-hidden">
              <div className="bg-muted/50 px-3 py-1.5 text-xs font-medium text-muted-foreground">
                {preview.length} notebooks encontrados — prévia dos primeiros 5
              </div>
              {preview.slice(0, 5).map((row, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex items-center gap-3 px-3 py-1.5 text-sm",
                    i < Math.min(4, preview.length - 1) && "border-b border-border",
                  )}
                >
                  <span className="tabular-nums font-medium">{row.hostname}</span>
                  {row.categoria && <span className="text-muted-foreground text-xs">{CATEGORIA_LABEL[row.categoria]}</span>}
                  {row.serial && <span className="text-muted-foreground text-xs">{row.serial}</span>}
                  {row.patrimonio && (
                    <span className="text-muted-foreground text-xs">{row.patrimonio}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        {conflicts && (
          <ArchivedConflictsPanel
            hostnames={conflicts}
            pending={importMutation.isPending}
            onChoose={handleArchivedChoice}
          />
        )}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              setPreview([]);
              setSelectedUmId("");
              setParseError(null);
              if (fileRef.current) fileRef.current.value = "";
            }}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleImport}
            disabled={!preview.length || !selectedUmId || importMutation.isPending}
          >
            {importMutation.isPending ? "Importando..." : `Importar ${preview.length} notebooks`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function lifecycleIcon(tipo: string) {
  switch (tipo) {
    case "Conferência - Sucesso":
      return <CheckCircle2 className="h-4 w-4" style={{ color: "var(--itc-sucesso)" }} />;
    case "Conferência - Faltante":
      return <XCircle className="h-4 w-4" style={{ color: "var(--itc-erro)" }} />;
    case "Manutenção":
      return <Wrench className="h-4 w-4" style={{ color: "var(--itc-atencao)" }} />;
    case "Retorno":
      return <CheckCircle2 className="h-4 w-4" style={{ color: "var(--itc-sucesso)" }} />;
    case "Cadastro":
      return <Info className="h-4 w-4" style={{ color: "var(--itc-info)" }} />;
    default:
      return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
  }
}

function HistoryModal({
  notebookId,
  hostname,
  open,
  onOpenChange,
}: {
  notebookId: string | null;
  hostname: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { data: history, isLoading } = useNotebookHistory(open ? notebookId : null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Ciclo de Vida — {hostname}</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <div className="space-y-2 py-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-12 rounded bg-muted animate-pulse" />
            ))}
          </div>
        ) : !history?.length ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhum evento registrado para este notebook.
          </p>
        ) : (
          <div className="space-y-0 rounded-lg border border-border overflow-hidden max-h-96 overflow-y-auto">
            {history.map((item, i) => (
              <div
                key={item.id}
                className={cn(
                  "flex items-start gap-3 px-4 py-3",
                  i < history.length - 1 && "border-b border-border",
                )}
              >
                <div className="shrink-0 mt-0.5">{lifecycleIcon(item.tipo)}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{item.tipo}</p>
                  <p className="text-xs text-muted-foreground">{item.descricao}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {new Date(item.createdAt).toLocaleString("pt-BR", {
                      day: "2-digit", month: "2-digit", year: "numeric",
                      hour: "2-digit", minute: "2-digit",
                    })} · {item.user.nome}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function NotebooksPage() {
  const [showArchived, setShowArchived] = useState(false);
  const { data: notebooks, isLoading } = useNotebooks(undefined, { includeArchived: showArchived });
  const deleteMutation = useDeleteNotebook();
  const updateMutation = useUpdateNotebook();
  const bulkDeleteMutation = useBulkDeleteNotebooks();

  const [formOpen, setFormOpen] = useState(false);
  const [batchOpen, setBatchOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editingNotebook, setEditingNotebook] = useState<Notebook | undefined>();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [bulkDeletingUmId, setBulkDeletingUmId] = useState<string | null>(null);
  const [bulkDeletingUmNome, setBulkDeletingUmNome] = useState("");
  const [historyNotebook, setHistoryNotebook] = useState<{ id: string; hostname: string } | null>(null);

  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [expandedUMs, setExpandedUMs] = useState<Set<string>>(new Set());

  const toggleProject = (id: string) =>
    setExpandedProjects((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const toggleUM = (id: string) =>
    setExpandedUMs((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  // Natural sort helper
  const naturalSort = (a: string, b: string) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });

  // Build hierarchy: project → um → notebooks (natural sorted)
  type UMGroup = {
    umId: string;
    umNome: string;
    projectCor: string;
    items: Notebook[];
  };
  type ProjectGroup = {
    projectId: string;
    projectNome: string;
    projectCor: string;
    ums: UMGroup[];
  };

  const hierarchy = Object.values(
    (notebooks ?? []).reduce<Record<string, ProjectGroup>>((acc, nb) => {
      const pid = nb.um.project.id;
      if (!acc[pid]) {
        acc[pid] = {
          projectId: pid,
          projectNome: nb.um.project.nome,
          projectCor: nb.um.project.cor,
          ums: [],
        };
      }
      const umGroup = acc[pid].ums.find((u) => u.umId === nb.umId);
      if (!umGroup) {
        acc[pid].ums.push({
          umId: nb.umId,
          umNome: nb.um.nome,
          projectCor: nb.um.project.cor,
          items: [nb],
        });
      } else {
        umGroup.items.push(nb);
      }
      return acc;
    }, {}),
  ).sort((a, b) => naturalSort(a.projectNome, b.projectNome));

  hierarchy.forEach((pg) => {
    pg.ums.sort((a, b) => naturalSort(a.umNome, b.umNome));
    pg.ums.forEach((u) => {
      u.items.sort((a, b) => naturalSort(a.hostname, b.hostname));
    });
  });

  const handleDelete = async () => {
    if (!deletingId) return;
    try {
      const { action } = await deleteMutation.mutateAsync(deletingId);
      toast.success(
        action === "archived"
          ? "Notebook arquivado (possui histórico)."
          : "Notebook excluído.",
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao excluir notebook.");
    } finally {
      setDeletingId(null);
    }
  };

  const handleBulkDelete = async () => {
    if (!bulkDeletingUmId) return;
    try {
      const result = await bulkDeleteMutation.mutateAsync(bulkDeletingUmId);
      const plural = (n: number, s: string) => `${n} ${s}${n !== 1 ? "s" : ""}`;
      toast.success(
        `${plural(result.deleted, "excluído")}, ${plural(result.archived, "arquivado")} (com histórico).`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao excluir notebooks.");
    } finally {
      setBulkDeletingUmId(null);
      setBulkDeletingUmNome("");
    }
  };

  const handleToggleStatus = async (nb: Notebook) => {
    const newStatus = nb.status === "ATIVO" ? "MANUTENCAO" : "ATIVO";
    try {
      await updateMutation.mutateAsync({
        id: nb.id,
        data: {
          hostname: nb.hostname,
          serial: nb.serial ?? undefined,
          patrimonio: nb.patrimonio ?? undefined,
          umId: nb.umId,
          status: newStatus,
        },
      });
      toast.success(
        newStatus === "MANUTENCAO"
          ? `${nb.hostname} movido para manutenção.`
          : `${nb.hostname} marcado como ativo.`,
      );
    } catch {
      toast.error("Erro ao alterar status.");
    }
  };

  const totalNotebooks = notebooks?.filter((n) => n.status !== "ARQUIVADO").length ?? 0;

  return (
    <div className="space-y-6 page-transition">
      <PageHeader
        title="Notebooks"
        description={`${totalNotebooks} notebook${totalNotebooks !== 1 ? "s" : ""} cadastrado${totalNotebooks !== 1 ? "s" : ""}`}
        icon={Laptop}
        action={
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground mr-2 cursor-pointer">
              <Checkbox
                checked={showArchived}
                onCheckedChange={(v) => setShowArchived(v === true)}
              />
              Mostrar arquivados
            </label>
            <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}>
              <Upload className="h-4 w-4 mr-1.5" />
              Importar CSV
            </Button>
            <Button size="sm" variant="outline" onClick={() => setBatchOpen(true)}>
              <Layers className="h-4 w-4 mr-1.5" />
              Lote
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setEditingNotebook(undefined);
                setFormOpen(true);
              }}
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Novo
            </Button>
          </div>
        }
      />

      {isLoading ? (
        <SkeletonTable rows={6} />
      ) : !notebooks?.length ? (
        <EmptyState
          icon={Laptop}
          title="Nenhum notebook cadastrado"
          description="Cadastre notebooks individualmente, em lote ou via CSV."
          action={
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}>
                <Upload className="h-4 w-4 mr-1.5" />
                Importar CSV
              </Button>
              <Button size="sm" onClick={() => setBatchOpen(true)}>
                <Layers className="h-4 w-4 mr-1.5" />
                Cadastro em Lote
              </Button>
            </div>
          }
        />
      ) : (
        <div className="space-y-2">
          {hierarchy.map((pg) => (
            <Collapsible
              key={pg.projectId}
              open={expandedProjects.has(pg.projectId)}
              onOpenChange={() => toggleProject(pg.projectId)}
            >
              <div className="rounded-lg border border-border overflow-hidden">
                <CollapsibleTrigger asChild>
                  <button className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left">
                    {expandedProjects.has(pg.projectId) ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                    <span
                      className="h-3 w-3 rounded-full shrink-0"
                      style={{ backgroundColor: pg.projectCor }}
                    />
                    <span className="font-semibold text-sm text-foreground">{pg.projectNome}</span>
                    <Badge variant="secondary" className="text-xs ml-auto">
                      {pg.ums.reduce((s, u) => s + u.items.length, 0)} notebooks
                    </Badge>
                  </button>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <div className="border-t border-border">
                    {pg.ums.map((ug) => (
                      <Collapsible
                        key={ug.umId}
                        open={expandedUMs.has(ug.umId)}
                        onOpenChange={() => toggleUM(ug.umId)}
                      >
                        <div className="flex items-center border-b border-border last:border-b-0">
                          <CollapsibleTrigger asChild>
                            <button className="flex-1 flex items-center gap-3 px-4 py-2.5 pl-10 hover:bg-muted/30 transition-colors text-left">
                              {expandedUMs.has(ug.umId) ? (
                                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              ) : (
                                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              )}
                              <span className="text-sm font-medium text-foreground">{ug.umNome}</span>
                              <Badge variant="secondary" className="text-xs ml-auto">
                                {ug.items.length}
                              </Badge>
                              {ug.items.some((n) => n.status === "MANUTENCAO") && (
                                <Badge className="text-xs bg-itc-atencao/15 text-itc-atencao border-itc-atencao/30 hover:bg-itc-atencao/15">
                                  {ug.items.filter((n) => n.status === "MANUTENCAO").length} manutenção
                                </Badge>
                              )}
                            </button>
                          </CollapsibleTrigger>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 mx-2 text-xs text-muted-foreground hover:text-destructive shrink-0"
                            onClick={() => {
                              setBulkDeletingUmId(ug.umId);
                              setBulkDeletingUmNome(ug.umNome);
                            }}
                          >
                            <Trash2 className="h-3 w-3 mr-1" />
                            Excluir todos
                          </Button>
                        </div>

                        <CollapsibleContent>
                          <div>
                            {ug.items.map((nb, i) => (
                              <div
                                key={nb.id}
                                className={cn(
                                  "flex items-center justify-between px-4 py-2 pl-16 hover:bg-muted/20 transition-colors",
                                  i < ug.items.length - 1 && "border-b border-border",
                                )}
                              >
                                <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
                                  <span className="text-sm tabular-nums font-medium text-foreground truncate max-w-[160px]">
                                    {originalHostname(nb.hostname)}
                                  </span>
                                  {nb.serial && (
                                    <span className="text-xs text-muted-foreground hidden sm:inline">
                                      {nb.serial}
                                    </span>
                                  )}
                                  {nb.patrimonio && (
                                    <span className="text-xs text-muted-foreground hidden md:inline">
                                      PAT:{nb.patrimonio}
                                    </span>
                                  )}
                                  <Badge
                                    className={cn(
                                      "text-xs shrink-0",
                                      nb.status === "ATIVO"
                                        ? "bg-itc-sucesso/15 text-itc-sucesso border-itc-sucesso/30 hover:bg-itc-sucesso/15"
                                        : nb.status === "ARQUIVADO"
                                          ? "bg-muted text-muted-foreground border-border hover:bg-muted"
                                          : "bg-itc-atencao/15 text-itc-atencao border-itc-atencao/30 hover:bg-itc-atencao/15",
                                    )}
                                  >
                                    {nb.status === "ATIVO" ? "Ativo" : nb.status === "ARQUIVADO" ? "Arquivado" : "Manutenção"}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-0.5 shrink-0">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    title="Histórico"
                                    onClick={() => setHistoryNotebook({ id: nb.id, hostname: originalHostname(nb.hostname) })}
                                  >
                                    <History className="h-3.5 w-3.5" />
                                  </Button>
                                  {nb.status !== "ARQUIVADO" && (
                                  <>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    title={nb.status === "MANUTENCAO" ? "Marcar como Ativo" : "Mover para Manutenção"}
                                    onClick={() => handleToggleStatus(nb)}
                                    disabled={updateMutation.isPending}
                                  >
                                    <Wrench
                                      className="h-3.5 w-3.5"
                                      style={{
                                        color: nb.status === "MANUTENCAO"
                                          ? "var(--itc-atencao)"
                                          : undefined,
                                      }}
                                    />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => {
                                      setEditingNotebook(nb);
                                      setFormOpen(true);
                                    }}
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                    onClick={() => setDeletingId(nb.id)}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                  </>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    ))}
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          ))}
        </div>
      )}

      <NotebookFormDialog
        key={editingNotebook?.id ?? "new"}
        open={formOpen}
        onOpenChange={(v) => {
          setFormOpen(v);
          if (!v) setEditingNotebook(undefined);
        }}
        notebook={editingNotebook}
      />
      <BatchDialog open={batchOpen} onOpenChange={setBatchOpen} />
      <ImportDialog open={importOpen} onOpenChange={setImportOpen} />

      <HistoryModal
        notebookId={historyNotebook?.id ?? null}
        hostname={historyNotebook?.hostname ?? ""}
        open={!!historyNotebook}
        onOpenChange={(v) => !v && setHistoryNotebook(null)}
      />

      <ConfirmationDialog
        open={!!deletingId}
        onOpenChange={(v) => !v && setDeletingId(null)}
        title="Excluir Notebook"
        description="Sem histórico, o notebook é removido permanentemente. Com histórico, ele é arquivado: sai das conferências e listas, mas o histórico é preservado."
        confirmLabel="Excluir"
        onConfirm={handleDelete}
        destructive
        loading={deleteMutation.isPending}
      />

      <ConfirmationDialog
        open={!!bulkDeletingUmId}
        onOpenChange={(v) => !v && setBulkDeletingUmId(null)}
        title={`Excluir todos os notebooks — ${bulkDeletingUmNome}`}
        description="Notebooks sem histórico são removidos permanentemente; os com histórico são arquivados (histórico preservado)."
        confirmLabel="Excluir todos"
        onConfirm={handleBulkDelete}
        destructive
        loading={bulkDeleteMutation.isPending}
      />
    </div>
  );
}
