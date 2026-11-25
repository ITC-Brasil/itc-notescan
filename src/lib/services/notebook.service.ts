import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@/generated/prisma/client";
import {
  archiveDateStamp,
  nextArchivedHostname,
  originalHostname,
} from "@/lib/notebook-hostname";

// Conferências e LifecycleEvents são imutáveis e referenciam o notebook por FK
// (Restrict). Por isso "excluir" um notebook com histórico = arquivar.

/** Erro de regra de negócio que a rota devolve como 409. */
export class NotebookConflictError extends Error {
  constructor(
    message: string,
    readonly code?: string,
    readonly data?: Record<string, unknown>,
  ) {
    super(message);
  }
}

/** 409 para conflitos esperados (regra ou corrida de FK/unique); null se não for um. */
export function conflictResponse(error: unknown): Response | null {
  if (error instanceof NotebookConflictError)
    return Response.json(
      { message: error.message, code: error.code, ...error.data },
      { status: 409 },
    );
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002")
      return Response.json({ message: "Já existe notebook com este hostname" }, { status: 409 });
    if (error.code === "P2003")
      return Response.json(
        { message: "O notebook ganhou histórico durante a operação. Tente novamente." },
        { status: 409 },
      );
  }
  return null;
}

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

// ponytail: ~106 updates individuais (hostname único por item) numa transação
// interativa; timeout explícito no lugar dos 5s padrão. Rever se uma UM passar de ~1000.
const TX_OPTS = { timeout: 30_000, maxWait: 10_000 };

export const umSelect = {
  um: {
    select: {
      id: true,
      nome: true,
      project: { select: { id: true, nome: true, cor: true } },
    },
  },
} as const;

/**
 * Exclui os notebooks sem histórico e arquiva os com histórico, numa transação.
 * Já arquivados são ignorados.
 */
export async function removeNotebooks(
  where: Prisma.NotebookWhereInput,
  userId: string,
  now = new Date(),
): Promise<{ deleted: number; archived: number }> {
  return prisma.$transaction(async (tx) => {
    const notebooks = await tx.notebook.findMany({
      where: { AND: [where, { status: { not: "ARQUIVADO" } }] },
      select: {
        id: true,
        hostname: true,
        _count: { select: { conferenceItems: true, lifecycleEvents: true } },
      },
    });

    const toDelete = notebooks.filter(
      (n) => n._count.conferenceItems === 0 && n._count.lifecycleEvents === 0,
    );
    const toArchive = notebooks.filter((n) => !toDelete.includes(n));

    if (toDelete.length > 0)
      await tx.notebook.deleteMany({ where: { id: { in: toDelete.map((n) => n.id) } } });

    if (toArchive.length > 0) {
      const stamp = archiveDateStamp(now);
      const taken = new Set(
        (
          await tx.notebook.findMany({
            where: { hostname: { contains: `~arq-${stamp}` } },
            select: { hostname: true },
          })
        ).map((n) => n.hostname),
      );
      for (const n of toArchive) {
        const hostname = nextArchivedHostname(n.hostname, stamp, taken);
        taken.add(hostname);
        await tx.notebook.update({ where: { id: n.id }, data: { status: "ARQUIVADO", hostname } });
      }
      await tx.lifecycleEvent.createMany({
        data: toArchive.map((n) => ({
          notebookId: n.id,
          userId,
          tipo: "ARQUIVADO",
          descricao: `Notebook arquivado (hostname original: ${n.hostname})`,
        })),
      });
    }

    return { deleted: toDelete.length, archived: toArchive.length };
  }, TX_OPTS);
}

type ArchivedMatch = { id: string; hostname: string; original: string; umNome: string };

/** Arquivado mais recente para cada hostname original informado. */
export async function findArchivedByOriginal(
  hostnames: string[],
): Promise<Map<string, ArchivedMatch>> {
  const map = new Map<string, ArchivedMatch>();
  if (hostnames.length === 0) return map;
  const rows = await prisma.notebook.findMany({
    where: {
      status: "ARQUIVADO",
      OR: hostnames.map((h) => ({ hostname: { startsWith: `${h}~arq-` } })),
    },
    orderBy: { updatedAt: "desc" },
    select: { id: true, hostname: true, um: { select: { nome: true } } },
  });
  for (const r of rows) {
    const original = originalHostname(r.hostname);
    if (!map.has(original))
      map.set(original, { id: r.id, hostname: r.hostname, original, umNome: r.um.nome });
  }
  return map;
}

export type OnArchived = "reactivate" | "new";

interface NotebookData {
  hostname: string;
  serial?: string | null;
  patrimonio?: string | null;
  umId: string;
}

async function reactivateIn(
  tx: Tx,
  archived: ArchivedMatch,
  data: NotebookData,
  userId: string,
) {
  const active = await tx.notebook.findUnique({ where: { hostname: data.hostname }, select: { id: true } });
  if (active)
    throw new NotebookConflictError("Já existe notebook ativo com este hostname", "ACTIVE_EXISTS");

  const notebook = await tx.notebook.update({
    where: { id: archived.id },
    data: {
      hostname: data.hostname,
      status: "ATIVO",
      umId: data.umId,
      ...(data.serial ? { serial: data.serial } : {}),
      ...(data.patrimonio ? { patrimonio: data.patrimonio } : {}),
    },
    include: umSelect,
  });
  await tx.lifecycleEvent.create({
    data: {
      notebookId: archived.id,
      userId,
      tipo: "REATIVADO",
      descricao: `Notebook reativado (estava arquivado como ${archived.hostname})`,
    },
  });
  return notebook;
}

/**
 * Cadastro individual. Hostname igual ao original de um arquivado exige decisão:
 * sem `onArchived` → conflito ARCHIVED_MATCH para a UI perguntar.
 */
export async function createNotebook(
  data: NotebookData & { status: "ATIVO" | "MANUTENCAO" },
  userId: string,
  onArchived?: OnArchived,
) {
  const active = await prisma.notebook.findUnique({ where: { hostname: data.hostname }, select: { id: true } });
  if (active) throw new NotebookConflictError("Já existe notebook com este hostname", "ACTIVE_EXISTS");

  const archived = (await findArchivedByOriginal([data.hostname])).get(data.hostname);
  if (archived && !onArchived)
    throw new NotebookConflictError(
      "Este hostname pertence a um notebook arquivado",
      "ARCHIVED_MATCH",
      { archived: { id: archived.id, hostname: archived.original, umNome: archived.umNome } },
    );

  if (archived && onArchived === "reactivate")
    return prisma.$transaction((tx) => reactivateIn(tx, archived, data, userId));

  return prisma.notebook.create({ data, include: umSelect });
}

export interface BulkCreateResult {
  total: number;
  created: number;
  reactivated: number;
  /** Hostnames de arquivados não tratados (onArchived = "skip"). */
  archivedConflicts: string[];
  /** Reativação impossível: já há notebook ativo com o hostname. */
  blocked: string[];
}

/** Lote/import: conflitos com arquivados são tratados em massa, sem diálogo por item. */
export async function createNotebooksBulk(
  rows: { hostname: string; serial?: string | null; patrimonio?: string | null }[],
  umId: string,
  status: "ATIVO" | "MANUTENCAO",
  userId: string,
  onArchived: OnArchived | "skip" = "skip",
): Promise<BulkCreateResult> {
  const archivedMap = await findArchivedByOriginal(rows.map((r) => r.hostname));
  const conflicts = rows.filter((r) => archivedMap.has(r.hostname));
  const toCreate = onArchived === "new" ? rows : rows.filter((r) => !archivedMap.has(r.hostname));

  return prisma.$transaction(async (tx) => {
    const { count: created } = await tx.notebook.createMany({
      data: toCreate.map((r) => ({
        hostname: r.hostname,
        serial: r.serial ?? null,
        patrimonio: r.patrimonio ?? null,
        umId,
        status,
      })),
      skipDuplicates: true,
    });

    const result: BulkCreateResult = {
      total: rows.length,
      created,
      reactivated: 0,
      archivedConflicts: onArchived === "skip" ? conflicts.map((r) => r.hostname) : [],
      blocked: [],
    };

    if (onArchived === "reactivate") {
      for (const r of conflicts) {
        try {
          await reactivateIn(tx, archivedMap.get(r.hostname)!, { ...r, umId }, userId);
          result.reactivated++;
        } catch (e) {
          if (!(e instanceof NotebookConflictError)) throw e;
          result.blocked.push(r.hostname);
        }
      }
    }
    return result;
  }, TX_OPTS);
}
