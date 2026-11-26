import { Prisma } from "@/generated/prisma/client";
import type { Actor } from "@/lib/auth/actor";
import type { TokenSituacao } from "@/lib/auth/scopes";
import { prisma } from "@/lib/db/prisma";
import type { CreateAgentInput, UpdateAgentInput } from "@/lib/validations";
import { audit } from "./audit.service";
import { agentEmail, agentSlug } from "./user.service";

// Nunca selecionar tokenHash: nada aqui sai com o hash.
const tokenSelect = {
  prefix: true,
  scopes: true,
  expiresAt: true,
  revokedAt: true,
  lastUsedAt: true,
  createdAt: true,
} as const;

const agentSelect = {
  id: true,
  nome: true,
  descricao: true,
  email: true,
  createdAt: true,
  desativadoEm: true,
} as const;

// Histórico = o agente AGIU: autor de AuditLog, token já usado ou LifecycleEvent
// próprio (este último por defesa: lastUsedAt é gravado sem aguardar). O que
// outros fizeram SOBRE o agente (criar, editar, emitir token) não conta.
const historyCount = {
  _count: {
    select: {
      auditLogs: true,
      lifecycleEvents: true,
      apiTokens: { where: { lastUsedAt: { not: null } } },
    },
  },
} as const;

type HistoryCount = { _count: { auditLogs: number; lifecycleEvents: number; apiTokens: number } };
const temHistorico = ({ _count: c }: HistoryCount) => c.auditLogs + c.lifecycleEvents + c.apiTokens > 0;

export function tokenSituacao(
  token: { revokedAt: Date | null; expiresAt: Date } | undefined,
  now = Date.now(),
): TokenSituacao {
  if (!token) return "nenhum";
  if (token.revokedAt) return "revogado";
  return token.expiresAt.getTime() <= now ? "expirado" : "ativo";
}

export async function listAgents({ includeInactive = false } = {}) {
  const agents = await prisma.user.findMany({
    where: { role: "AGENTE", ...(!includeInactive && { desativadoEm: null }) },
    orderBy: { nome: "asc" },
    select: {
      ...agentSelect,
      ...historyCount,
      apiTokens: { orderBy: { createdAt: "desc" }, take: 1, select: tokenSelect },
    },
  });
  return agents.map(({ apiTokens: [token], _count, ...agent }) => ({
    ...agent,
    temHistorico: temHistorico({ _count }),
    situacao: tokenSituacao(token),
    token: token ?? null,
  }));
}

export async function findAgent(id: string) {
  return prisma.user.findFirst({
    where: { id, role: "AGENTE" },
    select: { id: true, desativadoEm: true },
  });
}

export class AgentConflictError extends Error {}

export async function createAgent({ nome, descricao }: CreateAgentInput, actor: Actor) {
  const taken = await prisma.user.findMany({
    where: { email: { startsWith: `agente-${agentSlug(nome)}` } },
    select: { email: true },
  });
  try {
    return await prisma.$transaction(async (tx) => {
      const agent = await tx.user.create({
        data: {
          nome,
          descricao,
          role: "AGENTE",
          email: agentEmail(nome, taken.map((u) => u.email)),
          passwordHash: null,
        },
        select: agentSelect,
      });
      await audit(tx, actor, {
        entidade: "Agente",
        entidadeId: agent.id,
        acao: "CRIADO",
        payload: { nome, descricao: descricao ?? null },
      });
      return agent;
    });
  } catch (error) {
    // ponytail: corrida entre dois cadastros com o mesmo slug cai aqui; repetir resolve.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
      throw new AgentConflictError("E-mail já cadastrado, tente novamente");
    throw error;
  }
}

// E-mail sintético não muda ao renomear: ele só identifica, nunca é usado.
export async function updateAgent(id: string, data: UpdateAgentInput, actor: Actor) {
  return prisma.$transaction(async (tx) => {
    const agent = await tx.user.update({ where: { id }, data, select: agentSelect });
    await audit(tx, actor, { entidade: "Agente", entidadeId: id, acao: "EDITADO", payload: data });
    return agent;
  });
}

// m8-01: só sai agente que nunca agiu. Os tokens nunca usados vão junto na mesma
// transação (FK Restrict); os AuditLog SOBRE o agente ficam (entidadeId sem FK).
export async function deleteAgent(id: string, actor: Actor): Promise<"ok" | "historico"> {
  const agent = await prisma.user.findUnique({ where: { id }, select: historyCount });
  if (agent && temHistorico(agent)) return "historico";
  await prisma.$transaction(async (tx) => {
    const { count } = await tx.apiToken.deleteMany({ where: { userId: id } });
    await tx.user.delete({ where: { id } });
    await audit(tx, actor, {
      entidade: "Agente",
      entidadeId: id,
      acao: "EXCLUIDO",
      payload: { tokensApagados: count },
    });
  });
  return "ok";
}

// Desativar revoga o token ativo na mesma transação; reativar não devolve token.
export async function deactivateAgent(id: string, actor: Actor): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const agent = await tx.user.findUnique({ where: { id }, select: { desativadoEm: true } });
    if (!agent || agent.desativadoEm) return false;
    const active = await tx.apiToken.findFirst({
      where: { userId: id, revokedAt: null },
      select: { prefix: true },
    });
    const now = new Date();
    await tx.apiToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: now } });
    await tx.user.update({ where: { id }, data: { desativadoEm: now } });
    await audit(tx, actor, {
      entidade: "Agente",
      entidadeId: id,
      acao: "DESATIVADO",
      payload: { tokenRevogado: active?.prefix ?? null },
    });
    return true;
  });
}

export async function reactivateAgent(id: string, actor: Actor): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const agent = await tx.user.findUnique({ where: { id }, select: { desativadoEm: true } });
    if (!agent?.desativadoEm) return false;
    await tx.user.update({ where: { id }, data: { desativadoEm: null } });
    await audit(tx, actor, { entidade: "Agente", entidadeId: id, acao: "REATIVADO" });
    return true;
  });
}
