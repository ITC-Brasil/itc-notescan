import { authorize, MASTER_ONLY } from "@/lib/auth/actor";
import { logger } from "@/lib/logger";
import { reactivateAgent, findAgent } from "@/lib/services/agent.service";

type Ctx = { params: Promise<{ id: string }> };

// Reativa sem devolver token: é preciso emitir um novo.
export async function POST(request: Request, { params }: Ctx) {
  const actor = await authorize(request, MASTER_ONLY);
  if (actor instanceof Response) return actor;

  const { id } = await params;
  if (!(await findAgent(id)))
    return Response.json({ message: "Agente não encontrado" }, { status: 404 });

  try {
    if (!(await reactivateAgent(id, actor)))
      return Response.json({ message: "Agente já está ativo" }, { status: 409 });
    return new Response(null, { status: 204 });
  } catch (error) {
    logger.captureException(error);
    return Response.json({ message: "Erro interno" }, { status: 500 });
  }
}
