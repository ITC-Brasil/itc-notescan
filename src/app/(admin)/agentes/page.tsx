"use client";

import { useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { AlertTriangle, Bot, Copy, KeyRound, Pencil, Plug, Plus, ShieldOff } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  useAgents,
  useCreateAgent,
  useIssueToken,
  useRevokeToken,
  useUpdateAgent,
  type Agent,
  type IssuedToken,
} from "@/hooks/useAgents";
import { SCOPES, SCOPE_INFO, type Scope, type TokenSituacao } from "@/lib/auth/scopes";
import { createAgentSchema, type CreateAgentInput } from "@/lib/validations";
import { PageHeader } from "@/components/ui/PageHeader";
import { DataTable } from "@/components/ui/DataTable";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmationDialog } from "@/components/ui/ConfirmationDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

const dateFmt = { timeZone: "America/Sao_Paulo", dateStyle: "short" } as const;
const dateTimeFmt = { ...dateFmt, timeStyle: "short" } as const;
const fmt = (iso: string | null | undefined, withTime = false) =>
  iso ? new Date(iso).toLocaleString("pt-BR", withTime ? dateTimeFmt : dateFmt) : "—";

const situacaoBadge: Record<TokenSituacao, { label: string; className: string }> = {
  ativo: { label: "Ativo", className: "bg-itc-sucesso/10 text-itc-sucesso border-itc-sucesso/30" },
  expirado: { label: "Expirado", className: "bg-itc-atencao/10 text-itc-atencao border-itc-atencao/30" },
  revogado: { label: "Revogado", className: "bg-destructive/10 text-destructive border-destructive/30" },
  nenhum: { label: "Sem token", className: "bg-muted text-muted-foreground border-border" },
};

// ── Criar / editar agente ────────────────────────────────────────────────────
function AgentDialog({ agent, onClose }: { agent?: Agent; onClose: () => void }) {
  const create = useCreateAgent();
  const update = useUpdateAgent();
  const form = useForm<CreateAgentInput>({
    resolver: zodResolver(createAgentSchema),
    defaultValues: { nome: agent?.nome ?? "", descricao: agent?.descricao ?? "" },
  });

  const onSubmit = async (data: CreateAgentInput) => {
    try {
      if (agent) await update.mutateAsync({ id: agent.id, data });
      else await create.mutateAsync(data);
      toast.success(agent ? "Agente atualizado." : "Agente criado.");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar agente.");
    }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{agent ? "Editar agente" : "Novo agente"}</DialogTitle>
          <DialogDescription>
            Agentes não têm senha nem login: acessam a API só com token.
          </DialogDescription>
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
                    <Input placeholder="MCP Catálogo" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="descricao"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Para que serve este agente" rows={3} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={create.isPending || update.isPending}>
                {agent ? "Salvar" : "Criar agente"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ── Emitir / reemitir token ──────────────────────────────────────────────────
// O valor em claro vive só no estado deste componente, que é desmontado ao
// fechar. Nada vai para cache, storage, URL ou log.
function TokenDialog({ agent, onClose }: { agent: Agent; onClose: () => void }) {
  const issue = useIssueToken();
  const [scopes, setScopes] = useState<Scope[]>(agent.token?.scopes ?? ["read:catalog"]);
  const [issued, setIssued] = useState<IssuedToken | null>(null);
  const reissue = agent.situacao === "ativo";

  const toggle = (scope: Scope, checked: boolean) =>
    setScopes((s) => (checked ? [...s, scope] : s.filter((x) => x !== scope)));

  const submit = async () => {
    try {
      setIssued(await issue.mutateAsync({ id: agent.id, scopes }));
      issue.reset(); // tira o token do estado da mutation
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao emitir token.");
    }
  };

  const copy = async () => {
    if (!issued) return;
    try {
      await navigator.clipboard.writeText(issued.token);
      toast.success("Token copiado.");
    } catch {
      toast.error("Não foi possível copiar. Selecione o texto e copie manualmente.");
    }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg" data-sentry-block>
        <DialogHeader>
          <DialogTitle>
            {issued ? "Token emitido" : reissue ? "Reemitir token" : "Emitir token"} — {agent.nome}
          </DialogTitle>
          <DialogDescription>
            {issued
              ? "Copie agora. Este valor não será exibido novamente e não pode ser recuperado."
              : reissue
                ? "O token atual será revogado no mesmo instante e deixará de funcionar."
                : "Escolha o que o agente poderá fazer. Validade: 365 dias."}
          </DialogDescription>
        </DialogHeader>

        {issued ? (
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input
                readOnly
                value={issued.token}
                aria-label="Token"
                className="font-mono text-xs"
                autoComplete="off"
                spellCheck={false}
                onFocus={(e) => e.currentTarget.select()}
              />
              <Button type="button" onClick={copy} aria-label="Copiar token">
                <Copy className="h-4 w-4 mr-1.5" />
                Copiar
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Escopos: {issued.scopes.join(", ")} · expira em {fmt(issued.expiresAt)}
            </p>
            <DialogFooter>
              <Button onClick={onClose}>Já copiei, fechar</Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-3">
              {SCOPES.map((scope) => (
                <div key={scope} className="flex items-start gap-3">
                  <Checkbox
                    id={`scope-${scope}`}
                    checked={scopes.includes(scope)}
                    onCheckedChange={(v) => toggle(scope, v === true)}
                    className="mt-0.5"
                  />
                  <Label htmlFor={`scope-${scope}`} className="flex flex-col items-start gap-0.5 font-normal">
                    <span className="text-sm font-medium">
                      {SCOPE_INFO[scope].label}{" "}
                      <code className="text-xs text-muted-foreground">{scope}</code>
                    </span>
                    <span className="text-xs text-muted-foreground">{SCOPE_INFO[scope].descricao}</span>
                  </Label>
                </div>
              ))}
            </div>
            {scopes.includes("destructive") && (
              <div
                role="alert"
                className="flex gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
              >
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>
                  Com <code>destructive</code> e <code>delete:catalog</code>, o agente pode excluir UMs e
                  projetos inteiros e arquivar todos os notebooks de uma UM. Só marque se o agente
                  realmente precisar.
                </span>
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button
                onClick={submit}
                disabled={scopes.length === 0 || issue.isPending}
                variant={reissue ? "destructive" : "default"}
              >
                {reissue ? "Revogar atual e emitir" : "Emitir token"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Página ───────────────────────────────────────────────────────────────────
function columns(actions: {
  edit: (a: Agent) => void;
  token: (a: Agent) => void;
  revoke: (a: Agent) => void;
}): ColumnDef<Agent>[] {
  return [
    {
      accessorKey: "nome",
      header: "Agente",
      cell: ({ row }) => (
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">{row.original.nome}</p>
          {row.original.descricao && (
            <p className="text-xs text-muted-foreground line-clamp-2">{row.original.descricao}</p>
          )}
        </div>
      ),
    },
    {
      id: "situacao",
      header: "Token",
      cell: ({ row }) => {
        const { label, className } = situacaoBadge[row.original.situacao];
        return (
          <div className="space-y-1">
            <Badge variant="outline" className={`text-xs ${className}`}>
              {label}
            </Badge>
            {row.original.token && (
              <p className="font-mono text-xs text-muted-foreground">{row.original.token.prefix}…</p>
            )}
          </div>
        );
      },
    },
    {
      id: "escopos",
      header: "Escopos",
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1">
          {row.original.token?.scopes.map((s) => (
            <Badge
              key={s}
              variant="outline"
              className={`text-xs font-mono ${s === "destructive" ? "text-destructive border-destructive/30" : ""}`}
            >
              {s}
            </Badge>
          )) ?? <span className="text-xs text-muted-foreground">—</span>}
        </div>
      ),
    },
    {
      id: "expiracao",
      header: "Expira",
      cell: ({ row }) => (
        <span className="text-sm tabular-nums">{fmt(row.original.token?.expiresAt)}</span>
      ),
    },
    {
      id: "uso",
      header: "Último uso",
      cell: ({ row }) => (
        <span className="text-sm tabular-nums text-muted-foreground">
          {fmt(row.original.token?.lastUsedAt, true)}
        </span>
      ),
    },
    {
      id: "acoes",
      header: "",
      cell: ({ row }) => {
        const a = row.original;
        return (
          <div className="flex justify-end gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Editar agente" onClick={() => actions.edit(a)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => actions.token(a)}>
              <KeyRound className="h-3.5 w-3.5 mr-1.5" />
              {a.situacao === "ativo" ? "Reemitir" : "Emitir token"}
            </Button>
            {a.situacao === "ativo" && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                aria-label="Revogar token"
                onClick={() => actions.revoke(a)}
              >
                <ShieldOff className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        );
      },
    },
  ];
}

export default function AgentesPage() {
  const { data: agents, isLoading } = useAgents();
  const revoke = useRevokeToken();
  const [editing, setEditing] = useState<Agent | "new" | null>(null);
  const [tokenFor, setTokenFor] = useState<Agent | null>(null);
  const [revoking, setRevoking] = useState<Agent | null>(null);

  const handleRevoke = async () => {
    if (!revoking) return;
    try {
      await revoke.mutateAsync(revoking.id);
      toast.success("Token revogado.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao revogar token.");
    } finally {
      setRevoking(null);
    }
  };

  const newButton = (
    <Button size="sm" onClick={() => setEditing("new")}>
      <Plus className="h-4 w-4 mr-1.5" />
      Novo agente
    </Button>
  );

  return (
    <div className="space-y-6 page-transition">
      <PageHeader
        title="MCP e Agentes"
        description="Acesso de automações e IA ao catálogo via token de API"
        icon={Bot}
        action={newButton}
      />

      <Tabs defaultValue="agentes">
        <TabsList>
          <TabsTrigger value="agentes">Agentes</TabsTrigger>
          <TabsTrigger value="conectar">Como conectar</TabsTrigger>
        </TabsList>

        <TabsContent value="agentes" className="mt-4">
          {isLoading ? (
            <SkeletonTable rows={3} />
          ) : !agents?.length ? (
            <EmptyState
              icon={Bot}
              title="Nenhum agente cadastrado"
              description="Crie um agente e emita um token para dar acesso ao catálogo."
              action={newButton}
            />
          ) : (
            <DataTable
              columns={columns({ edit: setEditing, token: setTokenFor, revoke: setRevoking })}
              data={agents}
            />
          )}
        </TabsContent>

        <TabsContent value="conectar" className="mt-4">
          <EmptyState
            icon={Plug}
            title="Servidor MCP chega na Etapa 2"
            description="Por enquanto, o token acessa a API REST do NoteScan no cabeçalho Authorization: Bearer <token>. Nunca coloque o token na URL ou em query string."
          />
        </TabsContent>
      </Tabs>

      {editing && (
        <AgentDialog
          agent={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
        />
      )}
      {tokenFor && <TokenDialog agent={tokenFor} onClose={() => setTokenFor(null)} />}

      <ConfirmationDialog
        open={!!revoking}
        onOpenChange={(v) => !v && setRevoking(null)}
        title="Revogar token"
        description={`O token de ${revoking?.nome ?? ""} deixa de funcionar imediatamente. Para voltar a dar acesso, emita um novo.`}
        confirmLabel="Revogar"
        onConfirm={handleRevoke}
        destructive
        loading={revoke.isPending}
      />
    </div>
  );
}
