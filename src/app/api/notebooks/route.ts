import { authorize, WRITE_CATALOG } from "@/lib/auth/actor";
import { prisma } from "@/lib/db/prisma";
import { logger } from "@/lib/logger";
import { createNotebookSchema } from "@/lib/validations";
import { validateCategorias, conflictResponse, createNotebook } from "@/lib/services/notebook.service";

export async function GET(request: Request) {
  const actor = await authorize(request, { scopes: ["read:catalog"], rate: "read" });
  if (actor instanceof Response) return actor;

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
  const actor = await authorize(request, WRITE_CATALOG);
  if (actor instanceof Response) return actor;

  const parsed = createNotebookSchema.safeParse(await request.json());
  if (!parsed.success)
    return Response.json(
      { message: "Dados inválidos", errors: parsed.error.issues },
      { status: 400 },
    );

  const categoriaError = await validateCategorias(parsed.data.umId, [parsed.data.categoria]);
  if (categoriaError) return Response.json({ message: categoriaError }, { status: 400 });

  try {
    const { onArchived, ...data } = parsed.data;
    const notebook = await createNotebook(data, actor.userId, onArchived);
    return Response.json(notebook, { status: 201 });
  } catch (error) {
    const conflict = conflictResponse(error);
    if (conflict) return conflict;
    logger.captureException(error);
    return Response.json({ message: "Erro interno" }, { status: 500 });
  }
}
