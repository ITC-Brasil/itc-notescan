import { auth } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { z } from "zod";
import { conflictResponse, removeNotebooks } from "@/lib/services/notebook.service";

const schema = z.object({ umId: z.string().min(1) });

export async function POST(request: Request) {
  const session = await auth();
  if (!session)
    return Response.json({ message: "Não autorizado" }, { status: 401 });

  if (!["ADMIN", "MASTER"].includes(session.user.role))
    return Response.json({ message: "Proibido" }, { status: 403 });

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success)
    return Response.json({ message: "Dados inválidos" }, { status: 400 });

  const { umId } = parsed.data;

  try {
    // Sem histórico → excluídos; com histórico → arquivados. Uma transação.
    return Response.json(await removeNotebooks({ umId }, session.user.id));
  } catch (error) {
    const conflict = conflictResponse(error);
    if (conflict) return conflict;
    logger.captureException(error);
    return Response.json({ message: "Erro interno" }, { status: 500 });
  }
}
