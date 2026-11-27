import { authorize, WRITE_CATALOG } from "@/lib/auth/actor";
import { logger } from "@/lib/logger";
import { createNotebooksBatchSchema } from "@/lib/validations";
import { validateCategorias, conflictResponse, createNotebooksBulk } from "@/lib/services/notebook.service";

export async function POST(request: Request) {
  const actor = await authorize(request, WRITE_CATALOG);
  if (actor instanceof Response) return actor;

  const parsed = createNotebooksBatchSchema.safeParse(await request.json());
  if (!parsed.success)
    return Response.json(
      { message: "Dados inválidos", errors: parsed.error.issues },
      { status: 400 },
    );

  const { prefix, start, end, umId, status, onArchived } = parsed.data;

  const categoriaError = await validateCategorias(umId, [parsed.data.categoria]);
  if (categoriaError) return Response.json({ message: categoriaError }, { status: 400 });

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
      hostnames.map((hostname) => ({ hostname, categoria: parsed.data.categoria })),
      umId,
      status,
      actor.userId,
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
