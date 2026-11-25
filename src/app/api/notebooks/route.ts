import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { logger } from "@/lib/logger";
import { createNotebookSchema } from "@/lib/validations";
import { conflictResponse, createNotebook } from "@/lib/services/notebook.service";

export async function GET(request: Request) {
  const session = await auth();
  if (!session)
    return Response.json({ message: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const umId = searchParams.get("umId");
  // Arquivados ficam fora de tudo que é operacional. Só a tela de notebooks
  // ("Mostrar arquivados") e o scanner (mensagem "arquivado") pedem com o flag.
  const includeArchived = searchParams.get("includeArchived") === "1";

  const notebooks = await prisma.notebook.findMany({
    where: {
      ...(umId && { umId }),
      ...(!includeArchived && { status: { not: "ARQUIVADO" as const } }),
    },
    orderBy: [
      { um: { project: { nome: "asc" } } },
      { um: { nome: "asc" } },
      { hostname: "asc" },
    ],
    include: {
      um: {
        select: {
          id: true,
          nome: true,
          project: { select: { id: true, nome: true, cor: true } },
        },
      },
    },
  });

  return Response.json(notebooks);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session)
    return Response.json({ message: "Não autorizado" }, { status: 401 });

  if (!["ADMIN", "MASTER"].includes(session.user.role))
    return Response.json({ message: "Proibido" }, { status: 403 });

  const parsed = createNotebookSchema.safeParse(await request.json());
  if (!parsed.success)
    return Response.json(
      { message: "Dados inválidos", errors: parsed.error.issues },
      { status: 400 },
    );

  try {
    const { onArchived, ...data } = parsed.data;
    const notebook = await createNotebook(data, session.user.id, onArchived);
    return Response.json(notebook, { status: 201 });
  } catch (error) {
    const conflict = conflictResponse(error);
    if (conflict) return conflict;
    logger.captureException(error);
    return Response.json({ message: "Erro interno" }, { status: 500 });
  }
}
