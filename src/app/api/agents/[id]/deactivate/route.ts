import { authorize, MASTER_ONLY } from "@/lib/auth/actor";
import { logger } from "@/lib/logger";
import { deactivateAgent, findAgent } from "@/lib/services/agent.service";

type Ctx = { params: Promise<{ id: string }> };

// Desativa e revoga o token ativo na mesma transação.
export async function POST(request: Request, { params }: Ctx) {
  const actor = await authorize(request, MASTER_ONLY);
  if (actor instanceof Response) return actor;

  const { id } = await params;
  if (!(await findAgent(id)))
    return Response.json({ message: "Agente não encontrado" }, { status: 404 });

  try {
    if (!(await deactivateAgent(id, actor)))
      return Response.json({ message: "Agente já está desativado" }, { status: 409 });
    return new Response(null, { status: 204 });
  } catch (error) {
    logger.captureException(error);
    return Response.json({ message: "Erro interno" }, { status: 500 });
  }
}
