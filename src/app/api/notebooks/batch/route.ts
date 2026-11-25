import { auth } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { createNotebooksBatchSchema } from "@/lib/validations";
import { conflictResponse, createNotebooksBulk } from "@/lib/services/notebook.service";

export async function POST(request: Request) {
  const session = await auth();
  if (!session)
    return Response.json({ message: "Não autorizado" }, { status: 401 });

  if (!["ADMIN", "MASTER"].includes(session.user.role))
    return Response.json({ message: "Proibido" }, { status: 403 });

  const parsed = createNotebooksBatchSchema.safeParse(await request.json());
  if (!parsed.success)
    return Response.json(
      { message: "Dados inválidos", errors: parsed.error.issues },
      { status: 400 },
    );

  const { prefix, start, end, umId, status, onArchived } = parsed.data;

  if (end < start)
    return Response.json(
      { message: "O número final deve ser maior ou igual ao inicial" },
      { status: 400 },
    );

  const hostnames: string[] = [];
  for (let i = start; i <= end; i++) {
    const suffix = i < 10 ? `0${i}` : String(i);
    hostnames.push(`${prefix}${suffix}`);
  }

  try {
    const result = await createNotebooksBulk(
      hostnames.map((hostname) => ({ hostname })),
      umId,
      status,
      session.user.id,
      onArchived,
    );
    return Response.json(result, { status: 201 });
  } catch (error) {
    const conflict = conflictResponse(error);
    if (conflict) return conflict;
    logger.captureException(error);
    return Response.json({ message: "Erro interno" }, { status: 500 });
  }
}
