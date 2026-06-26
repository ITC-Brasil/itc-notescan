"use client";

import { useState } from "react";
import { Users, Plus, Pencil, Trash2, Shield, ShieldCheck, ShieldAlert } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useSession } from "next-auth/react";
import {
  useUsers,
  useCreateUser,
  useUpdateUser,
  useDeleteUser,
  type User,
} from "@/hooks/useUsers";
import { createUserSchema, type CreateUserInput } from "@/lib/validations";
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

const updateUserSchema = z.object({
  nome: z.string().min(2).max(100),
  email: z.string().email(),
  role: z.enum(["USER", "ADMIN", "MASTER"]),
  metaDiaria: z.number().int().min(1),
  password: z.string().min(8).optional().or(z.literal("")),
});

type UpdateUserFormValues = z.infer<typeof updateUserSchema>;

const roleLabels: Record<User["role"], string> = {
  USER: "Técnico",
  ADMIN: "Gestor",
  MASTER: "Master",
};

const roleIcons: Record<User["role"], typeof Shield> = {
  USER: Shield,
  ADMIN: ShieldCheck,
  MASTER: ShieldAlert,
};

const roleVariants: Record<User["role"], "secondary" | "default" | "destructive"> = {
  USER: "secondary",
  ADMIN: "default",
  MASTER: "destructive",
};

function CreateUserDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const createMutation = useCreateUser();

  const form = useForm({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      nome: "",
      email: "",
      password: "",
      role: "USER" as const,
      metaDiaria: 2,
    } as CreateUserInput,
  });

  // eslint-disable-next-line react-hooks/incompatible-library
  const role = form.watch("role");

  const onSubmit = async (data: CreateUserInput) => {
    try {
      await createMutation.mutateAsync(data);
      toast.success("Usuário criado com sucesso.");
      onOpenChange(false);
      form.reset();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao criar usuário.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Novo Usuário</DialogTitle>
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
                    <Input placeholder="João Silva" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>E-mail</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="joao@grupoitcbrasil.com.br" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Senha</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="Mínimo 8 caracteres" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className={role === "USER" ? "grid grid-cols-2 gap-3" : ""}>
              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Perfil</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="USER">Técnico</SelectItem>
                        <SelectItem value="ADMIN">Gestor</SelectItem>
                        <SelectItem value="MASTER">Master</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {role === "USER" && (
                <FormField
                  control={form.control}
                  name="metaDiaria"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Meta diária</FormLabel>
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
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Criando..." : "Criar"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function EditUserDialog({
  open,
  onOpenChange,
  user,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  user: User;
}) {
  const updateMutation = useUpdateUser();

  const form = useForm<UpdateUserFormValues>({
    resolver: zodResolver(updateUserSchema),
    defaultValues: {
      nome: user.nome,
      email: user.email,
      role: user.role,
      metaDiaria: user.metaDiaria,
      password: "",
    },
  });

  // eslint-disable-next-line react-hooks/incompatible-library
  const role = form.watch("role");

  const onSubmit = async (data: UpdateUserFormValues) => {
    try {
      const payload = {
        nome: data.nome,
        email: data.email,
        role: data.role,
        metaDiaria: data.metaDiaria,
        ...(data.password ? { password: data.password } : {}),
      };
      await updateMutation.mutateAsync({ id: user.id, data: payload });
      toast.success("Usuário atualizado com sucesso.");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao atualizar usuário.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Usuário</DialogTitle>
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
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>E-mail</FormLabel>
                  <FormControl>
                    <Input type="email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nova senha</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="Deixe em branco para não alterar"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className={role === "USER" ? "grid grid-cols-2 gap-3" : ""}>
              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Perfil</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="USER">Técnico</SelectItem>
                        <SelectItem value="ADMIN">Gestor</SelectItem>
                        <SelectItem value="MASTER">Master</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {role === "USER" && (
                <FormField
                  control={form.control}
                  name="metaDiaria"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Meta diária</FormLabel>
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
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default function UsuariosPage() {
  const { data: session } = useSession();
  const { data: users, isLoading } = useUsers();
  const deleteMutation = useDeleteUser();

  const [createOpen, setCreateOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | undefined>();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!deletingId) return;
    try {
      await deleteMutation.mutateAsync(deletingId);
      toast.success("Usuário excluído.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao excluir usuário.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6 page-transition">
      <PageHeader
        title="Usuários"
        description="Gerencie os acessos ao sistema"
        icon={Users}
        action={
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            Novo Usuário
          </Button>
        }
      />

      {isLoading ? (
        <SkeletonTable rows={5} />
      ) : !users?.length ? (
        <EmptyState
          icon={Users}
          title="Nenhum usuário cadastrado"
          description="Crie o primeiro usuário para permitir acesso ao sistema."
          action={
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-1.5" />
              Novo Usuário
            </Button>
          }
        />
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          {users.map((user, i) => {
            const RoleIcon = roleIcons[user.role];
            const isSelf = user.id === session?.user.id;
            return (
              <div
                key={user.id}
                className={`flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors ${
                  i < users.length - 1 ? "border-b border-border" : ""
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-semibold text-foreground">
                      {user.nome.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground truncate">
                        {user.nome}
                      </span>
                      {isSelf && (
                        <Badge variant="outline" className="text-xs">
                          você
                        </Badge>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground truncate block">
                      {user.email}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge variant={roleVariants[user.role]} className="text-xs gap-1">
                      <RoleIcon className="h-3 w-3" />
                      {roleLabels[user.role]}
                    </Badge>
                    {user.role === "USER" && (
                      <span className="text-xs text-muted-foreground hidden sm:inline">
                        Meta: {user.metaDiaria}/dia
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setEditingUser(user)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => setDeletingId(user.id)}
                    disabled={isSelf}
                    title={isSelf ? "Você não pode excluir sua própria conta" : undefined}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <CreateUserDialog open={createOpen} onOpenChange={setCreateOpen} />

      {editingUser && (
        <EditUserDialog
          open={!!editingUser}
          onOpenChange={(v) => !v && setEditingUser(undefined)}
          user={editingUser}
        />
      )}

      <ConfirmationDialog
        open={!!deletingId}
        onOpenChange={(v) => !v && setDeletingId(null)}
        title="Excluir Usuário"
        description="Esta ação não pode ser desfeita. O usuário perderá acesso ao sistema imediatamente."
        confirmLabel="Excluir"
        onConfirm={handleDelete}
        destructive
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
