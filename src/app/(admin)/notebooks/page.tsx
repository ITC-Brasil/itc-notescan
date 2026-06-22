"use client";

import { useCallback, useRef, useState } from "react";
import {
  Laptop,
  Plus,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronRight,
  Upload,
  Layers,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  useNotebooks,
  useCreateNotebook,
  useUpdateNotebook,
  useDeleteNotebook,
  useCreateNotebooksBatch,
  useImportNotebooks,
  type Notebook,
} from "@/hooks/useNotebooks";
import { useUMs } from "@/hooks/useUMs";
import {
  createNotebookSchema,
  createNotebooksBatchSchema,
  updateNotebookSchema,
  type CreateNotebooksBatchInput,
  type UpdateNotebookInput,
} from "@/lib/validations";
import { PageHeader } from "@/components/ui/PageHeader";
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
import { cn } from "@/lib/utils";

type NotebookFormValues = {
  hostname: string;
  serial?: string;
  patrimonio?: string;
  status: "ATIVO" | "MANUTENCAO";
  umId: string;
};

function NotebookFormDialog({
  open,
  onOpenChange,
  notebook,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  notebook?: Notebook;
}) {
  const { data: ums } = useUMs();
  const createMutation = useCreateNotebook();
  const updateMutation = useUpdateNotebook();
  const isEditing = !!notebook;

  const schema = isEditing ? updateNotebookSchema : createNotebookSchema;

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      hostname: notebook?.hostname ?? "",
      serial: notebook?.serial ?? "",
      patrimonio: notebook?.patrimonio ?? "",
      status: notebook?.status ?? "ATIVO",
      umId: notebook?.umId ?? "",
    } as NotebookFormValues,
  });

  const onSubmit = async (data: NotebookFormValues) => {
    try {
      if (isEditing) {
        await updateMutation.mutateAsync({
          id: notebook.id,
          data: data as UpdateNotebookInput,
        });
        toast.success("Notebook atualizado.");
      } else {
        await createMutation.mutateAsync(data);
        toast.success("Notebook criado.");
      }
      onOpenChange(false);
      form.reset();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar notebook.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Notebook" : "Novo Notebook"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="umId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Unidade Móvel</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value as string}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a UM" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {ums?.map((um) => (
                        <SelectItem key={um.id} value={um.id}>
                          <div className="flex items-center gap-2">
                            <span
                              className="h-2 w-2 rounded-full"
                              style={{ backgroundColor: um.project.cor }}
                            />
                            {um.project.nome} / {um.nome}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                    <FormLabel>Serial</FormLabel>
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
  const { data: ums } = useUMs();
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

  const onSubmit = async (data: CreateNotebooksBatchInput) => {
    try {
      const result = await batchMutation.mutateAsync(data);
      toast.success(`${result.created} de ${result.total} notebooks criados.`);
      onOpenChange(false);
      form.reset();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao criar notebooks em lote.");
    }
  };

  const start = form.watch("start");
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
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a UM" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {ums?.map((um) => (
                        <SelectItem key={um.id} value={um.id}>
                          <div className="flex items-center gap-2">
                            <span
                              className="h-2 w-2 rounded-full"
                              style={{ backgroundColor: um.project.cor }}
                            />
                            {um.project.nome} / {um.nome}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
            {preview && (
              <p className="text-xs text-muted-foreground font-mono bg-muted rounded px-2 py-1.5">
                Prévia: {preview} ({end - start + 1} notebooks)
              </p>
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

function ImportDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { data: ums } = useUMs();
  const importMutation = useImportNotebooks();
  const fileRef = useRef<HTMLInputElement>(null);
  const [selectedUmId, setSelectedUmId] = useState("");
  const [preview, setPreview] = useState<{ hostname: string; serial?: string; patrimonio?: string }[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);

  const parseCSV = useCallback((text: string) => {
    const lines = text.trim().split(/\r?\n/);
    if (!lines.length) return;

    const rows: { hostname: string; serial?: string; patrimonio?: string }[] = [];
    const errors: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const cols = lines[i].split(",").map((c) => c.trim());
      if (!cols[0]) { errors.push(`Linha ${i + 1}: hostname vazio`); continue; }
      rows.push({
        hostname: cols[0],
        serial: cols[1] || undefined,
        patrimonio: cols[2] || undefined,
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
      toast.success(`${result.created} de ${result.total} notebooks importados.`);
      onOpenChange(false);
      setPreview([]);
      setSelectedUmId("");
      if (fileRef.current) fileRef.current.value = "";
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
            <Select value={selectedUmId} onValueChange={setSelectedUmId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a UM" />
              </SelectTrigger>
              <SelectContent>
                {ums?.map((um) => (
                  <SelectItem key={um.id} value={um.id}>
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: um.project.cor }}
                      />
                      {um.project.nome} / {um.nome}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <p className="text-sm font-medium text-foreground mb-1.5">Arquivo CSV</p>
            <p className="text-xs text-muted-foreground mb-2">
              Formato: hostname, serial (opcional), patrimônio (opcional)
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
                  <span className="font-mono font-medium">{row.hostname}</span>
                  {row.serial && <span className="text-muted-foreground text-xs">{row.serial}</span>}
                  {row.patrimonio && (
                    <span className="text-muted-foreground text-xs">{row.patrimonio}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
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

export default function NotebooksPage() {
  const { data: notebooks, isLoading } = useNotebooks();
  const deleteMutation = useDeleteNotebook();

  const [formOpen, setFormOpen] = useState(false);
  const [batchOpen, setBatchOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editingNotebook, setEditingNotebook] = useState<Notebook | undefined>();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  type GroupKey = string;
  const grouped = (notebooks ?? []).reduce<
    Record<
      GroupKey,
      {
        label: string;
        projectCor: string;
        umNome: string;
        items: Notebook[];
      }
    >
  >((acc, nb) => {
    const key = `${nb.um.project.id}::${nb.umId}`;
    if (!acc[key]) {
      acc[key] = {
        label: `${nb.um.project.nome} / ${nb.um.nome}`,
        projectCor: nb.um.project.cor,
        umNome: nb.um.nome,
        items: [],
      };
    }
    acc[key].items.push(nb);
    return acc;
  }, {});

  const handleDelete = async () => {
    if (!deletingId) return;
    try {
      await deleteMutation.mutateAsync(deletingId);
      toast.success("Notebook excluído.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao excluir notebook.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notebooks"
        description="Gerencie o inventário de notebooks"
        icon={Laptop}
        action={
          <div className="flex items-center gap-2">
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
          {Object.entries(grouped).map(([key, group]) => {
            const isExpanded = expandedGroups.has(key);
            return (
              <div key={key} className="rounded-lg border border-border overflow-hidden">
                <button
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left"
                  onClick={() => toggleGroup(key)}
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  )}
                  <span
                    className="h-3 w-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: group.projectCor }}
                  />
                  <span className="font-medium text-sm text-foreground">{group.label}</span>
                  <Badge variant="secondary" className="text-xs ml-auto">
                    {group.items.length} notebook{group.items.length !== 1 ? "s" : ""}
                  </Badge>
                  <Badge
                    variant={
                      group.items.some((n) => n.status === "MANUTENCAO") ? "destructive" : "secondary"
                    }
                    className="text-xs"
                  >
                    {group.items.filter((n) => n.status === "MANUTENCAO").length} manutenção
                  </Badge>
                </button>

                {isExpanded && (
                  <div className="border-t border-border">
                    {group.items.map((nb, i) => (
                      <div
                        key={nb.id}
                        className={cn(
                          "flex items-center justify-between px-4 py-2 pl-11 hover:bg-muted/30 transition-colors",
                          i < group.items.length - 1 && "border-b border-border",
                        )}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-sm font-mono font-medium text-foreground truncate">
                            {nb.hostname}
                          </span>
                          {nb.serial && (
                            <span className="text-xs text-muted-foreground hidden sm:inline">
                              {nb.serial}
                            </span>
                          )}
                          {nb.patrimonio && (
                            <span className="text-xs text-muted-foreground hidden md:inline">
                              PAT: {nb.patrimonio}
                            </span>
                          )}
                          <Badge
                            variant={nb.status === "MANUTENCAO" ? "destructive" : "secondary"}
                            className="text-xs"
                          >
                            {nb.status === "MANUTENCAO" ? "Manutenção" : "Ativo"}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
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
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <NotebookFormDialog
        open={formOpen}
        onOpenChange={(v) => {
          setFormOpen(v);
          if (!v) setEditingNotebook(undefined);
        }}
        notebook={editingNotebook}
      />
      <BatchDialog open={batchOpen} onOpenChange={setBatchOpen} />
      <ImportDialog open={importOpen} onOpenChange={setImportOpen} />

      <ConfirmationDialog
        open={!!deletingId}
        onOpenChange={(v) => !v && setDeletingId(null)}
        title="Excluir Notebook"
        description="Esta ação não pode ser desfeita. O notebook será permanentemente removido."
        confirmLabel="Excluir"
        onConfirm={handleDelete}
        destructive
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
