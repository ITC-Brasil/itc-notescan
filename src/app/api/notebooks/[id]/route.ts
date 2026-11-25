import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { logger } from "@/lib/logger";
import { updateNotebookSchema } from "@/lib/validations";
import { conflictResponse, removeNotebooks } from "@/lib/services/notebook.service";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session)
    return Response.json({ message: "Não autorizado" }, { status: 401 });

  if (!["ADMIN", "MASTER"].includes(session.user.role))
    return Response.json({ message: "Proibido" }, { status: 403 });

  const parsed = updateNotebookSchema.safeParse(await request.json());
  if (!parsed.success)
    return Response.json(
      { message: "Dados inválidos", errors: parsed.error.issues },
      { status: 400 },
    );

  const { id } = await params;

  try {
    const existing = await prisma.notebook.findUnique({
      where: { id },
      select: { status: true },
    });

    if (!existing)
      return Response.json({ message: "Notebook não encontrado" }, { status: 404 });
    if (existing.status === "ARQUIVADO")
      return Response.json({ message: "Notebook arquivado não pode ser editado" }, { status: 409 });

    const statusChanged =
      existing && parsed.data.status && existing.status !== parsed.data.status;

    const notebookUpdateArgs = {
      where: { id },
      data: parsed.data,
      include: {
        um: {
          select: {
            id: true,
            nome: true,
            project: { select: { id: true, nome: true, cor: true } },
          },
        },
      },
    };

    if (statusChanged && parsed.data.status) {
      const isMaintenance = parsed.data.status === "MANUTENCAO";
      const [notebook] = await prisma.$transaction([
        prisma.notebook.update(notebookUpdateArgs),
        prisma.lifecycleEvent.create({
          data: {
            notebookId: id,
            userId: session.user.id,
            tipo: isMaintenance ? "Manutenção" : "Retorno",
            descricao: isMaintenance
              ? "Notebook colocado em manutenção"
              : "Notebook retirado da manutenção",
          },
        }),
      ]);
      return Response.json(notebook);
    }

    const notebook = await prisma.notebook.update(notebookUpdateArgs);
    return Response.json(notebook);
  } catch (error) {
    const conflict = conflictResponse(error);
    if (conflict) return conflict;
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

  try {
    const existing = await prisma.notebook.findUnique({ where: { id }, select: { status: true } });
    if (!existing)
      return Response.json({ message: "Notebook não encontrado" }, { status: 404 });
    if (existing.status === "ARQUIVADO")
      return Response.json({ message: "Notebook já está arquivado" }, { status: 409 });

    // Sem histórico → exclusão real; com histórico → arquivado.
    const { archived } = await removeNotebooks({ id }, session.user.id);
    return Response.json({ action: archived > 0 ? "archived" : "deleted" });
  } catch (error) {
    const conflict = conflictResponse(error);
    if (conflict) return conflict;
    logger.captureException(error);
    return Response.json({ message: "Erro interno" }, { status: 500 });
  }
}
