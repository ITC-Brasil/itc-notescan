import { prisma } from "@/lib/db/prisma";
import type { Categoria } from "@/lib/validations";

// Formato da UM devolvido pela API (lista, criação e edição).
export const UM_INCLUDE = {
  project: { select: { id: true, nome: true, cor: true } },
  _count: { select: { notebooks: { where: { status: { not: "ARQUIVADO" as const } } } } },
  metas: { select: { categoria: true, meta: true }, orderBy: { categoria: "asc" as const } },
};

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/** Substitui as metas da UM. Metas 0 não são gravadas (categoria fora da meta). */
export async function replaceMetas(
  tx: Tx,
  umId: string,
  metas: { categoria: Categoria; meta: number }[],
) {
  await tx.uMMetaCategoria.deleteMany({ where: { umId } });
  const positivas = metas.filter((m) => m.meta > 0);
  if (positivas.length)
    await tx.uMMetaCategoria.createMany({ data: positivas.map((m) => ({ umId, ...m })) });
}
