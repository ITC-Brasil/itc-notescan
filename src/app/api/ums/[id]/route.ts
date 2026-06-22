import { auth } from "@/lib/auth/config";
import { prisma } from "@/lib/db/prisma";
import { logger } from "@/lib/logger";
import { createUMSchema } from "@/lib/validations";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session)
    return Response.json({ message: "Não autorizado" }, { status: 401 });

  if (!["ADMIN", "MASTER"].includes(session.user.role))
    return Response.json({ message: "Proibido" }, { status: 403 });

  const parsed = createUMSchema.safeParse(await request.json());
  if (!parsed.success)
    return Response.json(
      { message: "Dados inválidos", errors: parsed.error.issues },
      { status: 400 },
    );

  const { id } = await params;

  try {
    const um = await prisma.uM.update({
      where: { id },
      data: parsed.data,
      include: {
        project: { select: { id: true, nome: true, cor: true } },
        _count: { select: { notebooks: true } },
      },
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

  const notebooksCount = await prisma.notebook.count({ where: { umId: id } });
  if (notebooksCount > 0)
    return Response.json(
      { message: "Não é possível excluir uma UM com notebooks associados" },
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
