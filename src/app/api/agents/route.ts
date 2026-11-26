import { authorize, MASTER_ONLY } from "@/lib/auth/actor";
import { logger } from "@/lib/logger";
import { AgentConflictError, createAgent, listAgents } from "@/lib/services/agent.service";
import { createAgentSchema } from "@/lib/validations";


export async function GET(request: Request) {
  const actor = await authorize(request, MASTER_ONLY);
  if (actor instanceof Response) return actor;
  const includeInactive = new URL(request.url).searchParams.get("includeInactive") === "1";
  return Response.json(await listAgents({ includeInactive }));
}

export async function POST(request: Request) {
  const actor = await authorize(request, MASTER_ONLY);
  if (actor instanceof Response) return actor;

  const parsed = createAgentSchema.safeParse(await request.json());
  if (!parsed.success)
    return Response.json(
      { message: "Dados inválidos", errors: parsed.error.issues },
      { status: 400 },
    );

  try {
    return Response.json(await createAgent(parsed.data, actor), { status: 201 });
  } catch (error) {
    if (error instanceof AgentConflictError)
      return Response.json({ message: error.message }, { status: 409 });
    logger.captureException(error);
    return Response.json({ message: "Erro interno" }, { status: 500 });
  }
}
