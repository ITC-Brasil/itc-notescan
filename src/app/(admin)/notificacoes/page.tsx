"use client";

import { useState } from "react";
import { Bell, Send, Users } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useSendNotification, useDispatchNotification } from "@/hooks/useNotifications";
import { useUsers } from "@/hooks/useUsers";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

const notificationSchema = z.object({
  title: z.string().min(1, "Título obrigatório").max(100),
  body: z.string().min(1, "Mensagem obrigatória").max(500),
});

type NotificationInput = z.infer<typeof notificationSchema>;

function BroadcastForm() {
  const sendMutation = useSendNotification();
  const form = useForm<NotificationInput>({
    resolver: zodResolver(notificationSchema),
    defaultValues: { title: "", body: "" },
  });

  const onSubmit = async (data: NotificationInput) => {
    try {
      const result = await sendMutation.mutateAsync(data);
      toast.success(`Notificação enviada para ${result.sent} técnico${result.sent !== 1 ? "s" : ""}.`);
      form.reset();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao enviar notificação.");
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Título</FormLabel>
              <FormControl>
                <Input placeholder="Atenção técnicos!" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="body"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Mensagem</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Mensagem para todos os técnicos..."
                  className="resize-none"
                  rows={4}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={sendMutation.isPending} className="w-full">
          <Send className="h-4 w-4 mr-2" />
          {sendMutation.isPending ? "Enviando..." : "Enviar para todos"}
        </Button>
      </form>
    </Form>
  );
}

function TargetedForm() {
  const { data: users } = useUsers();
  const dispatchMutation = useDispatchNotification();
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());

  const form = useForm<NotificationInput>({
    resolver: zodResolver(notificationSchema),
    defaultValues: { title: "", body: "" },
  });

  const toggleUser = (id: string) => {
    setSelectedUsers((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const technicians = users?.filter((u) => u.role === "USER") ?? [];

  const onSubmit = async (data: NotificationInput) => {
    if (!selectedUsers.size) {
      toast.error("Selecione pelo menos um técnico.");
      return;
    }
    try {
      const result = await dispatchMutation.mutateAsync({
        ...data,
        userIds: Array.from(selectedUsers),
      });
      toast.success(`Notificação enviada para ${result.sent} técnico${result.sent !== 1 ? "s" : ""}.`);
      form.reset();
      setSelectedUsers(new Set());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao enviar notificação.");
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <p className="text-sm font-medium text-foreground mb-2">
            Técnicos
            {selectedUsers.size > 0 && (
              <Badge variant="secondary" className="ml-2 text-xs">
                {selectedUsers.size} selecionado{selectedUsers.size !== 1 ? "s" : ""}
              </Badge>
            )}
          </p>
          {technicians.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum técnico cadastrado.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
              {technicians.map((u) => (
                <label
                  key={u.id}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border px-3 py-2 cursor-pointer transition-colors",
                    selectedUsers.has(u.id)
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/50",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={selectedUsers.has(u.id)}
                    onChange={() => toggleUser(u.id)}
                    className="accent-primary"
                  />
                  <span className="text-sm font-medium">{u.nome}</span>
                </label>
              ))}
            </div>
          )}
        </div>
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Título</FormLabel>
              <FormControl>
                <Input placeholder="Lembrete de conferência" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="body"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Mensagem</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Mensagem personalizada..."
                  className="resize-none"
                  rows={4}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button
          type="submit"
          disabled={dispatchMutation.isPending || !selectedUsers.size}
          className="w-full"
        >
          <Send className="h-4 w-4 mr-2" />
          {dispatchMutation.isPending
            ? "Enviando..."
            : `Enviar para ${selectedUsers.size || "?"} técnico${selectedUsers.size !== 1 ? "s" : ""}`}
        </Button>
      </form>
    </Form>
  );
}

export default function NotificacoesPage() {
  return (
    <div className="space-y-6 page-transition">
      <PageHeader
        title="Notificações"
        description="Envie push notifications para os técnicos de campo"
        icon={Bell}
      />

      <div className="max-w-xl">
        <Tabs defaultValue="broadcast">
          <TabsList className="w-full mb-6">
            <TabsTrigger value="broadcast" className="flex-1">
              <Bell className="h-4 w-4 mr-1.5" />
              Para todos
            </TabsTrigger>
            <TabsTrigger value="targeted" className="flex-1">
              <Users className="h-4 w-4 mr-1.5" />
              Individual
            </TabsTrigger>
          </TabsList>
          <TabsContent value="broadcast">
            <BroadcastForm />
          </TabsContent>
          <TabsContent value="targeted">
            <TargetedForm />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
