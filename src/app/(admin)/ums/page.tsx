"use client";

import { useState } from "react";
import { Truck, Plus, Pencil, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useUMs, useCreateUM, useUpdateUM, useDeleteUM, type UM } from "@/hooks/useUMs";
import { useProjects } from "@/hooks/useProjects";
import { createUMSchema, type CreateUMInput } from "@/lib/validations";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

function UMFormDialog({
  open,
  onOpenChange,
  um,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  um?: UM;
}) {
  const { data: projects } = useProjects();
  const createMutation = useCreateUM();
  const updateMutation = useUpdateUM();
  const isEditing = !!um;

  const form = useForm({
    resolver: zodResolver(createUMSchema),
    defaultValues: {
      nome: um?.nome ?? "",
      projectId: um?.projectId ?? "",
      quantidadeEsperada: um?.quantidadeEsperada ?? 106,
      perifericos: um?.perifericos ?? false,
      mouses: um?.mouses ?? false,
      carregadores: um?.carregadores ?? false,
      fones: um?.fones ?? false,
    },
  });

  const onSubmit = async (data: CreateUMInput) => {
    try {
      if (isEditing) {
        await updateMutation.mutateAsync({ id: um.id, data });
        toast.success("UM atualizada com sucesso.");
      } else {
        await createMutation.mutateAsync(data);
        toast.success("UM criada com sucesso.");
      }
      onOpenChange(false);
      form.reset();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar UM.");
    }
  };

  const perifericoFields = [
    { name: "mouses" as const, label: "Mouses" },
    { name: "carregadores" as const, label: "Carregadores" },
    { name: "fones" as const, label: "Fones" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar UM" : "Nova UM"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="projectId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Projeto</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um projeto" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {projects?.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          <div className="flex items-center gap-2">
                            <span
                              className="h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: p.cor }}
                            />
                            {p.nome}
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
              name="nome"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome</FormLabel>
                  <FormControl>
                    <Input placeholder="BSBIA01" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="quantidadeEsperada"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quantidade esperada</FormLabel>
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
            <Separator />
            <div>
              <p className="text-sm font-medium text-foreground mb-3">Periféricos</p>
              <div className="grid grid-cols-3 gap-2">
                {perifericoFields.map(({ name, label }) => (
                  <FormField
                    key={name}
                    control={form.control}
                    name={name}
                    render={({ field }) => (
                      <label className="flex items-center gap-1.5 cursor-pointer rounded-lg border border-border p-2 hover:bg-muted/50 transition-colors min-w-0 overflow-hidden">
                        <Checkbox
                          checked={field.value as boolean}
                          onCheckedChange={field.onChange}
                          className="shrink-0"
                        />
                        <span className="text-xs min-w-0 truncate">{label}</span>
                      </label>
                    )}
                  />
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {createMutation.isPending || updateMutation.isPending
                  ? "Salvando..."
                  : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default function UMsPage() {
  const { data: ums, isLoading } = useUMs();
  const deleteMutation = useDeleteUM();

  const [formOpen, setFormOpen] = useState(false);
  const [editingUM, setEditingUM] = useState<UM | undefined>();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());

  const toggleProject = (projectId: string) => {
    setExpandedProjects((prev) => {
      const next = new Set(prev);
      next.has(projectId) ? next.delete(projectId) : next.add(projectId);
      return next;
    });
  };

  const groupedByProject = (ums ?? []).reduce<
    Record<string, { project: UM["project"]; ums: UM[] }>
  >((acc, um) => {
    const pid = um.project.id;
    if (!acc[pid]) acc[pid] = { project: um.project, ums: [] };
    acc[pid].ums.push(um);
    return acc;
  }, {});

  const handleDelete = async () => {
    if (!deletingId) return;
    try {
      await deleteMutation.mutateAsync(deletingId);
      toast.success("UM excluída com sucesso.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao excluir UM.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6 page-transition">
      <PageHeader
        title="Unidades Móveis"
        description="Gerencie as carretas e sua configuração"
        icon={Truck}
        action={
          <Button
            size="sm"
            onClick={() => {
              setEditingUM(undefined);
              setFormOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Nova UM
          </Button>
        }
      />

      {isLoading ? (
        <SkeletonTable rows={5} />
      ) : !ums?.length ? (
        <EmptyState
          icon={Truck}
          title="Nenhuma UM cadastrada"
          description="Crie projetos primeiro, depois adicione as Unidades Móveis."
          action={
            <Button size="sm" onClick={() => setFormOpen(true)}>
              <Plus className="h-4 w-4 mr-1.5" />
              Nova UM
            </Button>
          }
        />
      ) : (
        <div className="space-y-2">
          {Object.values(groupedByProject).map(({ project, ums: projectUMs }) => {
            const isExpanded = expandedProjects.has(project.id);
            return (
              <div key={project.id} className="rounded-lg border border-border overflow-hidden">
                <button
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left"
                  onClick={() => toggleProject(project.id)}
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                  <span
                    className="h-3 w-3 rounded-full shrink-0"
                    style={{ backgroundColor: project.cor }}
                  />
                  <span className="font-medium text-sm text-foreground">{project.nome}</span>
                  <Badge variant="secondary" className="text-xs ml-auto">
                    {projectUMs.length} UM{projectUMs.length !== 1 ? "s" : ""}
                  </Badge>
                </button>

                {isExpanded && (
                  <div className="border-t border-border">
                    {projectUMs.map((um, i) => (
                      <div
                        key={um.id}
                        className={cn(
                          "flex items-center justify-between px-4 py-2.5 pl-11 hover:bg-muted/30 transition-colors",
                          i < projectUMs.length - 1 && "border-b border-border",
                        )}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-sm font-medium text-foreground truncate">
                            {um.nome}
                          </span>
                          <span className="text-xs text-muted-foreground hidden sm:inline">
                            {um.quantidadeEsperada} notebooks
                          </span>
                          <Badge variant="secondary" className="text-xs">
                            {um._count.notebooks} cadastrados
                          </Badge>
                          {[
                            um.mouses && "Mouses",
                            um.carregadores && "Carregadores",
                            um.fones && "Fones",
                          ]
                            .filter(Boolean)
                            .map((p) => (
                              <Badge key={p as string} variant="outline" className="text-xs hidden md:inline-flex">
                                {p}
                              </Badge>
                            ))}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => {
                              setEditingUM(um);
                              setFormOpen(true);
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() => setDeletingId(um.id)}
                            disabled={um._count.notebooks > 0}
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

      <UMFormDialog
        key={editingUM?.id ?? "new"}
        open={formOpen}
        onOpenChange={(v) => {
          setFormOpen(v);
          if (!v) setEditingUM(undefined);
        }}
        um={editingUM}
      />

      <ConfirmationDialog
        open={!!deletingId}
        onOpenChange={(v) => !v && setDeletingId(null)}
        title="Excluir UM"
        description="Esta ação não pode ser desfeita. A UM será permanentemente removida."
        confirmLabel="Excluir"
        onConfirm={handleDelete}
        destructive
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
