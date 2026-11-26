import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Scope, TokenSituacao } from "@/lib/auth/scopes";
import type { CreateAgentInput, UpdateAgentInput } from "@/lib/validations";

export interface Agent {
  id: string;
  nome: string;
  descricao: string | null;
  email: string;
  createdAt: string;
  situacao: TokenSituacao;
  token: {
    prefix: string;
    scopes: Scope[];
    expiresAt: string;
    revokedAt: string | null;
    lastUsedAt: string | null;
    createdAt: string;
  } | null;
}

export interface IssuedToken {
  token: string;
  prefix: string;
  scopes: Scope[];
  expiresAt: string;
}

const KEY = ["agents"] as const;

async function send<T>(url: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(err.message ?? "Falha na operação");
  }
  return (res.status === 204 ? undefined : res.json()) as Promise<T>;
}

export function useAgents() {
  return useQuery({ queryKey: KEY, queryFn: () => send<Agent[]>("/api/agents", "GET") });
}

export function useCreateAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateAgentInput) => send<Agent>("/api/agents", "POST", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateAgentInput }) =>
      send<Agent>(`/api/agents/${id}`, "PATCH", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

// O token em claro nunca entra no cache: gcTime 0 descarta a mutation assim
// que ninguém a observa, e quem chama faz reset() depois de copiar o valor.
// A lista ["agents"] só é invalidada (refetch traz apenas o prefixo).
export function useIssueToken() {
  const qc = useQueryClient();
  return useMutation({
    gcTime: 0,
    mutationFn: ({ id, scopes }: { id: string; scopes: Scope[] }) =>
      send<IssuedToken>(`/api/agents/${id}/token`, "POST", { scopes }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

// 409 quando o agente tem histórico: a mensagem da API vai para o toast.
export function useDeleteAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => send<void>(`/api/agents/${id}`, "DELETE"),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useRevokeToken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => send<void>(`/api/agents/${id}/token`, "DELETE"),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
