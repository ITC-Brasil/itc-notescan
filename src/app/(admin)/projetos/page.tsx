"use client";

import { useState } from "react";
import { FolderOpen, Plus, Pencil, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useProjects, useCreateProject, useUpdateProject, useDeleteProject, type Project } from "@/hooks/useProjects";
import { createProjectSchema, type CreateProjectInput } from "@/lib/validations";
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

function ProjectFormDialog({
  open,
  onOpenChange,
  project,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  project?: Project;
}) {
  const createMutation = useCreateProject();
  const updateMutation = useUpdateProject();
  const isEditing = !!project;

  const form = useForm<CreateProjectInput>({
    resolver: zodResolver(createProjectSchema),
    defaultValues: {
      nome: project?.nome ?? "",
      cor: project?.cor ?? "#008F95",
    },
  });

  const onSubmit = async (data: CreateProjectInput) => {
    try {
      if (isEditing) {
        await updateMutation.mutateAsync({ id: project.id, data });
        toast.success("Projeto atualizado com sucesso.");
      } else {
        await createMutation.mutateAsync(data);
        toast.success("Projeto criado com sucesso.");
      }
      onOpenChange(false);
      form.reset();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar projeto.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Projeto" : "Novo Projeto"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="nome"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome</FormLabel>
                  <FormControl>
                    <Input placeholder="Brasil.IA" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="cor"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cor</FormLabel>
                  <FormControl>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={field.value}
                        onChange={(e) => field.onChange(e.target.value)}
                        className="h-9 w-14 rounded-md border border-border cursor-pointer bg-transparent"
                      />
                      <Input
                        value={field.value}
                        onChange={(e) => field.onChange(e.target.value)}
                        placeholder="#008F95"
                        className="tabular-nums"
                        maxLength={7}
                      />
                    </div>
                  </FormControl>
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

export default function ProjetosPage() {
  const { data: projects, isLoading } = useProjects();
  const deleteMutation = useDeleteProject();

  const [formOpen, setFormOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | undefined>();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleEdit = (project: Project) => {
    setEditingProject(project);
    setFormOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    try {
      await deleteMutation.mutateAsync(deletingId);
      toast.success("Projeto excluído com sucesso.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao excluir projeto.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6 page-transition">
      <PageHeader
        title="Projetos"
        description="Gerencie os projetos e suas cores"
        icon={FolderOpen}
        action={
          <Button
            size="sm"
            onClick={() => {
              setEditingProject(undefined);
              setFormOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Novo Projeto
          </Button>
        }
      />

      {isLoading ? (
        <SkeletonTable rows={4} />
      ) : !projects?.length ? (
        <EmptyState
          icon={FolderOpen}
          title="Nenhum projeto cadastrado"
          description="Crie o primeiro projeto para começar a organizar as Unidades Móveis."
          action={
            <Button size="sm" onClick={() => setFormOpen(true)}>
              <Plus className="h-4 w-4 mr-1.5" />
              Novo Projeto
            </Button>
          }
        />
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          {projects.map((project, i) => (
            <div
              key={project.id}
              data-testid="project-row"
              className={`flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors ${
                i < projects.length - 1 ? "border-b border-border" : ""
              }`}
            >
              <div className="flex items-center gap-3">
                <span
                  className="h-4 w-4 rounded-full shrink-0 border border-border/50"
                  style={{ backgroundColor: project.cor }}
                />
                <span className="font-medium text-sm text-foreground">
                  {project.nome}
                </span>
                <Badge variant="secondary" className="text-xs">
                  {project._count.ums} UM{project._count.ums !== 1 ? "s" : ""}
                </Badge>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handleEdit(project)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => setDeletingId(project.id)}
                  disabled={project._count.ums > 0}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ProjectFormDialog
        key={editingProject?.id ?? "new"}
        open={formOpen}
        onOpenChange={(v) => {
          setFormOpen(v);
          if (!v) setEditingProject(undefined);
        }}
        project={editingProject}
      />

      <ConfirmationDialog
        open={!!deletingId}
        onOpenChange={(v) => !v && setDeletingId(null)}
        title="Excluir Projeto"
        description="Esta ação não pode ser desfeita. O projeto será permanentemente removido."
        confirmLabel="Excluir"
        onConfirm={handleDelete}
        destructive
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
