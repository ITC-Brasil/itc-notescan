import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@/generated/prisma/client";
import { archiveDateStamp, nextArchivedHostname } from "@/lib/notebook-hostname";

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
