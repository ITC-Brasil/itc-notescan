import { auth } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { importNotebooksSchema } from "@/lib/validations";
import { conflictResponse, createNotebooksBulk } from "@/lib/services/notebook.service";

export async function POST(request: Request) {
  const session = await auth();
  if (!session)
    return Response.json({ message: "Não autorizado" }, { status: 401 });

  if (!["ADMIN", "MASTER"].includes(session.user.role))
    return Response.json({ message: "Proibido" }, { status: 403 });

  const parsed = importNotebooksSchema.safeParse(await request.json());
  if (!parsed.success)
    return Response.json(
      { message: "Dados inválidos", errors: parsed.error.issues },
      { status: 400 },
    );

  const { umId, rows, onArchived } = parsed.data;

  try {
    const result = await createNotebooksBulk(rows, umId, "ATIVO", session.user.id, onArchived);
    return Response.json(result, { status: 201 });
  } catch (error) {
    const conflict = conflictResponse(error);
    if (conflict) return conflict;
    logger.captureException(error);
    return Response.json({ message: "Erro interno" }, { status: 500 });
  }
}
