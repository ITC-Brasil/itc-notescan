import { authorize, DESTRUCTIVE } from "@/lib/auth/actor";
import { logger } from "@/lib/logger";
import { z } from "zod";
import { conflictResponse, removeNotebooks } from "@/lib/services/notebook.service";

const schema = z.object({ umId: z.string().min(1) });

export async function POST(request: Request) {
  const actor = await authorize(request, DESTRUCTIVE);
  if (actor instanceof Response) return actor;

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success)
    return Response.json({ message: "Dados inválidos" }, { status: 400 });

  const { umId } = parsed.data;

  try {
    // Sem histórico → excluídos; com histórico → arquivados. Uma transação.
    return Response.json(await removeNotebooks({ umId }, actor.userId));
  } catch (error) {
    const conflict = conflictResponse(error);
    if (conflict) return conflict;
    logger.captureException(error);
    return Response.json({ message: "Erro interno" }, { status: 500 });
  }
}
