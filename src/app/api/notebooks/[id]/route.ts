import { authorize, DELETE_CATALOG, WRITE_CATALOG } from "@/lib/auth/actor";
import { prisma } from "@/lib/db/prisma";
import { logger } from "@/lib/logger";
import { updateNotebookSchema } from "@/lib/validations";
import { validateCategorias, conflictResponse, removeNotebooks } from "@/lib/services/notebook.service";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = await authorize(request, WRITE_CATALOG);
  if (actor instanceof Response) return actor;

  const parsed = updateNotebookSchema.safeParse(await request.json());
  if (!parsed.success)
    return Response.json(
      { message: "Dados inválidos", errors: parsed.error.issues },
      { status: 400 },
    );

  const { id } = await params;

  const categoriaError = await validateCategorias(parsed.data.umId, [parsed.data.categoria]);
  if (categoriaError) return Response.json({ message: categoriaError }, { status: 400 });

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
            userId: actor.userId,
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
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = await authorize(request, DELETE_CATALOG);
  if (actor instanceof Response) return actor;

  const { id } = await params;

  try {
    const existing = await prisma.notebook.findUnique({ where: { id }, select: { status: true } });
    if (!existing)
      return Response.json({ message: "Notebook não encontrado" }, { status: 404 });
    if (existing.status === "ARQUIVADO")
      return Response.json({ message: "Notebook já está arquivado" }, { status: 409 });

    // Sem histórico → exclusão real; com histórico → arquivado.
    const { archived } = await removeNotebooks({ id }, actor.userId);
    return Response.json({ action: archived > 0 ? "archived" : "deleted" });
  } catch (error) {
    const conflict = conflictResponse(error);
    if (conflict) return conflict;
    logger.captureException(error);
    return Response.json({ message: "Erro interno" }, { status: 500 });
  }
}
