"use client";

import { useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import {
  AlertTriangle,
  Bot,
  Copy,
  FileText,
  KeyRound,
  Pencil,
  Plus,
  Power,
  RotateCcw,
  ShieldOff,
  Trash2,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  useAgents,
  useCreateAgent,
  useDeleteAgent,
  useIssueToken,
  useRevokeToken,
  useSetAgentActive,
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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

// ── Ações da tabela ──────────────────────────────────────────────────────────
// Botão com tooltip; aria-label igual ao texto do tooltip nos botões só com ícone.
function IconAction({
  label,
  onClick,
  icon: Icon,
  danger = false,
}: {
  label: string;
  onClick: () => void;
  icon: typeof Pencil;
  danger?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={`h-8 w-8 ${danger ? "text-muted-foreground hover:text-destructive" : ""}`}
          aria-label={label}
          onClick={onClick}
        >
          <Icon className="h-3.5 w-3.5" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

type Actions = {
  edit: (a: Agent) => void;
  token: (a: Agent) => void;
  revoke: (a: Agent) => void;
  remove: (a: Agent) => void;
  deactivate: (a: Agent) => void;
  reactivate: (a: Agent) => void;
};

function columns(actions: Actions): ColumnDef<Agent>[] {
  return [
    {
      accessorKey: "nome",
      header: "Agente",
      cell: ({ row }) => (
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-foreground">{row.original.nome}</p>
            {row.original.desativadoEm && (
              <Badge variant="outline" className="text-xs bg-muted text-muted-foreground">
                Desativado
              </Badge>
            )}
          </div>
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
        if (a.desativadoEm)
          return (
            <div className="flex justify-end gap-1">
              <IconAction label="Editar agente" icon={Pencil} onClick={() => actions.edit(a)} />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="sm" onClick={() => actions.reactivate(a)}>
                    <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                    Reativar
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Reativa o agente; é preciso emitir um novo token</TooltipContent>
              </Tooltip>
            </div>
          );
        const reissue = a.situacao === "ativo";
        return (
          <div className="flex justify-end gap-1">
            <IconAction label="Editar agente" icon={Pencil} onClick={() => actions.edit(a)} />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" onClick={() => actions.token(a)}>
                  <KeyRound className="h-3.5 w-3.5 mr-1.5" />
                  {reissue ? "Reemitir" : "Emitir token"}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {reissue ? "Gera um novo token e revoga o atual" : "Gera um token de API para o agente"}
              </TooltipContent>
            </Tooltip>
            {reissue && (
              <IconAction label="Revogar token" icon={ShieldOff} danger onClick={() => actions.revoke(a)} />
            )}
            {a.temHistorico ? (
              <IconAction label="Desativar agente" icon={Power} danger onClick={() => actions.deactivate(a)} />
            ) : (
              <IconAction label="Excluir agente" icon={Trash2} danger onClick={() => actions.remove(a)} />
            )}
          </div>
        );
      },
    },
  ];
}

// ── Como conectar ────────────────────────────────────────────────────────────
function agentInstructions(baseUrl: string) {
  return `Você tem acesso à API do NoteScan (catálogo de projetos, UMs e notebooks da ITC Brasil).

- URL base: ${baseUrl}
- Autenticação: header "Authorization: Bearer $NOTESCAN_TOKEN". O token fica SÓ na variável de ambiente NOTESCAN_TOKEN: nunca o escreva em comandos, arquivos, logs ou na URL.
- Escopos do token: read:catalog (ler), write:catalog (criar/editar), delete:catalog (arquivar notebook), destructive (com delete:catalog: excluir UM ou projeto e arquivar todos os notebooks de uma UM).
- Limites: 120 leituras e 30 escritas por minuto. Em 429, aguarde alguns segundos e repita.
- 401: token inválido, revogado ou expirado. Pare e avise o responsável. 403: falta escopo ou a rota é proibida. Não insista.
- 409: regra de negócio (duplicado, arquivado, UM ou projeto com vínculos). Leia a mensagem e decida; não force.
- Proibido: conferências, usuários, notificações e gestão de agentes (sempre 403).
- Antes de operar, leia o guia completo: GET ${baseUrl}/agents/guide (mesmo header de autenticação).
- Campos obrigatórios nas criações:
  - projeto (POST /projects): nome, cor (hex #RRGGBB)
  - UM (POST /ums): nome, projectId, quantidadeEsperada (inteiro ≥ 1)
  - notebook (POST /notebooks): hostname, umId
  Para os demais campos, lote, import e notebooks arquivados, consulte o guia antes de criar.
- Antes de excluir ou arquivar em lote, confirme com o usuário.

Configuração (o usuário cola o token; ele nunca aparece em texto na conversa):
export NOTESCAN_TOKEN=<cole o token>`;
}

function CopyButton({ text, label }: { text: string | (() => Promise<string>); label: string }) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(typeof text === "string" ? text : await text());
      toast.success("Copiado.");
    } catch {
      toast.error("Não foi possível copiar.");
    }
  };
  return (
    <Button type="button" variant="outline" size="sm" onClick={copy}>
      <Copy className="h-3.5 w-3.5 mr-1.5" />
      {label}
    </Button>
  );
}

async function fetchGuide() {
  const res = await fetch("/api/agents/guide");
  if (!res.ok) throw new Error("Guia indisponível");
  return res.text();
}

function ConnectSection() {
  // Origem atual: na tela do MASTER é a de produção (ou a de dev, em dev).
  const baseUrl = typeof window === "undefined" ? "/api" : `${window.location.origin}/api`;
  const instructions = agentInstructions(baseUrl);
  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h2 className="text-sm font-semibold">URL base da API</h2>
        <div className="flex gap-2">
          <Input readOnly value={baseUrl} aria-label="URL base da API" className="font-mono text-xs" />
          <CopyButton text={baseUrl} label="Copiar" />
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Guia da API para agentes</h2>
        <p className="text-sm text-muted-foreground">
          Endpoints, escopos, regras de negócio e o que fazer em cada erro. Cole o guia nas
          instruções do agente (Claude Code, Hermes).
        </p>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <a href="/api/agents/guide" target="_blank" rel="noopener noreferrer">
              <FileText className="h-3.5 w-3.5 mr-1.5" />
              Abrir guia
            </a>
          </Button>
          <CopyButton text={fetchGuide} label="Copiar guia" />
        </div>
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Instruções para o agente</h2>
          <CopyButton text={instructions} label="Copiar instruções" />
        </div>
        <pre
          aria-label="Instruções para o agente"
          className="whitespace-pre-wrap rounded-lg border border-border bg-muted/40 p-4 text-xs font-mono"
        >
          {instructions}
        </pre>
        <p className="text-xs text-muted-foreground">
          O token não aparece aqui: ele só é exibido uma vez, na emissão. Nunca o coloque na URL.
        </p>
      </section>

      <p className="text-xs text-muted-foreground border-t border-border pt-4">
        Servidor MCP remoto: planejado. MCP local (no desktop do usuário): alternativa futura. Por
        enquanto, os agentes usam a API REST acima.
      </p>
    </div>
  );
}

// ── Página ───────────────────────────────────────────────────────────────────
export default function AgentesPage() {
  const [showInactive, setShowInactive] = useState(false);
  const { data: agents, isLoading } = useAgents({ includeInactive: showInactive });
  const revoke = useRevokeToken();
  const remove = useDeleteAgent();
  const setActive = useSetAgentActive();
  const [editing, setEditing] = useState<Agent | "new" | null>(null);
  const [tokenFor, setTokenFor] = useState<Agent | null>(null);
  const [revoking, setRevoking] = useState<Agent | null>(null);
  const [removing, setRemoving] = useState<Agent | null>(null);
  const [deactivating, setDeactivating] = useState<Agent | null>(null);

  // Toast de sucesso ou a mensagem da API (inclusive o 409 de histórico).
  const run = async (fn: () => Promise<unknown>, ok: string, fail: string, done?: () => void) => {
    try {
      await fn();
      toast.success(ok);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : fail);
    } finally {
      done?.();
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

        <TabsContent value="agentes" className="mt-4 space-y-3">
          <label className="flex w-fit items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
            <Checkbox checked={showInactive} onCheckedChange={(v) => setShowInactive(v === true)} />
            Mostrar desativados
          </label>
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
              columns={columns({
                edit: setEditing,
                token: setTokenFor,
                revoke: setRevoking,
                remove: setRemoving,
                deactivate: setDeactivating,
                reactivate: (a) =>
                  void run(
                    () => setActive.mutateAsync({ id: a.id, active: true }),
                    "Agente reativado. Emita um novo token.",
                    "Erro ao reativar agente.",
                  ),
              })}
              data={agents}
            />
          )}
        </TabsContent>

        <TabsContent value="conectar" className="mt-4">
          <ConnectSection />
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
        onConfirm={() =>
          revoking &&
          void run(() => revoke.mutateAsync(revoking.id), "Token revogado.", "Erro ao revogar token.", () =>
            setRevoking(null),
          )
        }
        destructive
        loading={revoke.isPending}
      />

      <ConfirmationDialog
        open={!!removing}
        onOpenChange={(v) => !v && setRemoving(null)}
        title="Excluir agente"
        description={`Excluir ${removing?.nome ?? ""}? Ele nunca agiu no sistema; tokens não usados são apagados junto. Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        onConfirm={() =>
          removing &&
          void run(() => remove.mutateAsync(removing.id), "Agente excluído.", "Erro ao excluir agente.", () =>
            setRemoving(null),
          )
        }
        destructive
        loading={remove.isPending}
      />

      <ConfirmationDialog
        open={!!deactivating}
        onOpenChange={(v) => !v && setDeactivating(null)}
        title="Desativar agente"
        description={`${deactivating?.nome ?? ""} já agiu no sistema, então o histórico é preservado. Desativar revoga o token agora e impede emitir outro até reativar.`}
        confirmLabel="Desativar"
        onConfirm={() =>
          deactivating &&
          void run(
            () => setActive.mutateAsync({ id: deactivating.id, active: false }),
            "Agente desativado.",
            "Erro ao desativar agente.",
            () => setDeactivating(null),
          )
        }
        destructive
        loading={setActive.isPending}
      />
    </div>
  );
}
