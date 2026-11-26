import { authorize, WRITE_CATALOG } from "@/lib/auth/actor";
import { audit } from "@/lib/services/audit.service";
import { UM_INCLUDE } from "@/lib/services/um.service";
import { auth } from "@/lib/auth";
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

  try {
    const um = await prisma.$transaction(async (tx) => {
      const updated = await tx.uM.update({ where: { id }, data: parsed.data, include: UM_INCLUDE });
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
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session)
    return Response.json({ message: "Não autorizado" }, { status: 401 });

  if (!["ADMIN", "MASTER"].includes(session.user.role))
    return Response.json({ message: "Proibido" }, { status: 403 });

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
    await prisma.uM.delete({ where: { id } });
    return new Response(null, { status: 204 });
  } catch (error) {
    logger.captureException(error);
    return Response.json({ message: "Erro interno" }, { status: 500 });
  }
}
