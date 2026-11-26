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

const agentSelect = { id: true, nome: true, descricao: true, email: true, createdAt: true } as const;

export function tokenSituacao(
  token: { revokedAt: Date | null; expiresAt: Date } | undefined,
  now = Date.now(),
): TokenSituacao {
  if (!token) return "nenhum";
  if (token.revokedAt) return "revogado";
  return token.expiresAt.getTime() <= now ? "expirado" : "ativo";
}

export async function listAgents() {
  const agents = await prisma.user.findMany({
    where: { role: "AGENTE" },
    orderBy: { nome: "asc" },
    select: { ...agentSelect, apiTokens: { orderBy: { createdAt: "desc" }, take: 1, select: tokenSelect } },
  });
  return agents.map(({ apiTokens: [token], ...agent }) => ({
    ...agent,
    situacao: tokenSituacao(token),
    token: token ?? null,
  }));
}

export async function findAgent(id: string) {
  return prisma.user.findFirst({ where: { id, role: "AGENTE" }, select: { id: true } });
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

// m8-01: agente com token ou AuditLog próprio não sai (FKs Restrict).
export async function deleteAgent(id: string, actor: Actor): Promise<"ok" | "historico"> {
  const counts = await prisma.user.findUnique({
    where: { id },
    select: { _count: { select: { apiTokens: true, auditLogs: true } } },
  });
  if (counts && counts._count.apiTokens + counts._count.auditLogs > 0) return "historico";
  await prisma.$transaction(async (tx) => {
    await tx.user.delete({ where: { id } });
    await audit(tx, actor, { entidade: "Agente", entidadeId: id, acao: "EXCLUIDO" });
  });
  return "ok";
}
