import { authorize, MASTER_ONLY } from "@/lib/auth/actor";
import { logger } from "@/lib/logger";
import { deleteAgent, findAgent, updateAgent } from "@/lib/services/agent.service";
import { updateAgentSchema } from "@/lib/validations";

type Ctx = { params: Promise<{ id: string }> };
const notFound = () => Response.json({ message: "Agente não encontrado" }, { status: 404 });

export async function PATCH(request: Request, { params }: Ctx) {
  const actor = await authorize(request, MASTER_ONLY);
  if (actor instanceof Response) return actor;

  const parsed = updateAgentSchema.safeParse(await request.json());
  if (!parsed.success)
    return Response.json(
      { message: "Dados inválidos", errors: parsed.error.issues },
      { status: 400 },
    );

  const { id } = await params;
  if (!(await findAgent(id))) return notFound();

  try {
    return Response.json(await updateAgent(id, parsed.data, actor));
  } catch (error) {
    logger.captureException(error);
    return Response.json({ message: "Erro interno" }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: Ctx) {
  const actor = await authorize(request, MASTER_ONLY);
  if (actor instanceof Response) return actor;

  const { id } = await params;
  if (!(await findAgent(id))) return notFound();

  try {
    if ((await deleteAgent(id, actor)) === "historico")
      return Response.json(
        {
          message:
            "Agentes com histórico não podem ser excluídos; para desativar, revogue o token",
        },
        { status: 409 },
      );
    return new Response(null, { status: 204 });
  } catch (error) {
    logger.captureException(error);
    return Response.json({ message: "Erro interno" }, { status: 500 });
  }
}
