import { authorize, DESTRUCTIVE, WRITE_CATALOG } from "@/lib/auth/actor";
import { audit } from "@/lib/services/audit.service";
import { prisma } from "@/lib/db/prisma";
import { logger } from "@/lib/logger";
import { createProjectSchema } from "@/lib/validations";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = await authorize(request, WRITE_CATALOG);
  if (actor instanceof Response) return actor;

  const parsed = createProjectSchema.safeParse(await request.json());
  if (!parsed.success)
    return Response.json(
      { message: "Dados inválidos", errors: parsed.error.issues },
      { status: 400 },
    );

  const { id } = await params;

  try {
    const project = await prisma.$transaction(async (tx) => {
      const updated = await tx.project.update({ where: { id }, data: parsed.data });
      await audit(tx, actor, { entidade: "Project", entidadeId: id, acao: "EDITADO", payload: parsed.data });
      return updated;
    });
    return Response.json(project);
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

  const umsCount = await prisma.uM.count({ where: { projectId: id } });
  if (umsCount > 0)
    return Response.json(
      { message: "Não é possível excluir um projeto com UMs associadas" },
      { status: 409 },
    );

  try {
    await prisma.$transaction(async (tx) => {
      const { nome, cor } = await tx.project.delete({ where: { id } });
      await audit(tx, actor, { entidade: "Project", entidadeId: id, acao: "EXCLUIDO", payload: { nome, cor } });
    });
    return new Response(null, { status: 204 });
  } catch (error) {
    logger.captureException(error);
    return Response.json({ message: "Erro interno" }, { status: 500 });
  }
}
