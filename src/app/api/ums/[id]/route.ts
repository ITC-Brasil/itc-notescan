import { authorize, DESTRUCTIVE, WRITE_CATALOG } from "@/lib/auth/actor";
import { audit } from "@/lib/services/audit.service";
import { replaceMetas, UM_INCLUDE } from "@/lib/services/um.service";
import { prisma } from "@/lib/db/prisma";
import { logger } from "@/lib/logger";
import { createUMSchema } from "@/lib/validations";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = await authorize(request, WRITE_CATALOG);
  if (actor instanceof Response) return actor;

  const parsed = createUMSchema.safeParse(await request.json());
  if (!parsed.success)
    return Response.json(
      { message: "Dados inválidos", errors: parsed.error.issues },
      { status: 400 },
    );

  const { id } = await params;

  // Trocar o tipo de uma UM com conferências mudaria o sentido do histórico
  // (status, faltantes, cobertura). Só permitido antes da primeira conferência.
  const current = await prisma.uM.findUnique({
    where: { id },
    select: { tipo: true, _count: { select: { conferences: true } } },
  });
  if (!current) return Response.json({ message: "UM não encontrada" }, { status: 404 });
  if (current.tipo !== parsed.data.tipo && current._count.conferences > 0)
    return Response.json(
      { message: "Não é possível trocar o tipo de uma UM que já tem conferências" },
      { status: 409 },
    );

  try {
    const um = await prisma.$transaction(async (tx) => {
      const { metas, ...data } = parsed.data;
      await tx.uM.update({ where: { id }, data });
      await replaceMetas(tx, id, metas);
      const updated = await tx.uM.findUniqueOrThrow({ where: { id }, include: UM_INCLUDE });
      await audit(tx, actor, { entidade: "UM", entidadeId: id, acao: "EDITADO", payload: parsed.data });
      return updated;
    });
    return Response.json(um);
  } catch (error) {
    logger.captureException(error);
    return Response.json({ message: "Erro interno" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = await authorize(request, DESTRUCTIVE);
  if (actor instanceof Response) return actor;

  const { id } = await params;

  // Arquivados também bloqueiam: o histórico deles referencia a UM.
  const notebooks = await prisma.notebook.groupBy({
    by: ["status"],
    where: { umId: id },
    _count: true,
  });
  if (notebooks.length > 0)
    return Response.json(
      {
        message: notebooks.every((g) => g.status === "ARQUIVADO")
          ? "Não é possível excluir uma UM com notebooks arquivados (histórico preservado)"
          : "Não é possível excluir uma UM com notebooks associados",
      },
      { status: 409 },
    );

  try {
    await prisma.$transaction(async (tx) => {
      const { nome, projectId } = await tx.uM.delete({ where: { id } });
      await audit(tx, actor, { entidade: "UM", entidadeId: id, acao: "EXCLUIDO", payload: { nome, projectId } });
    });
    return new Response(null, { status: 204 });
  } catch (error) {
    logger.captureException(error);
    return Response.json({ message: "Erro interno" }, { status: 500 });
  }
}
