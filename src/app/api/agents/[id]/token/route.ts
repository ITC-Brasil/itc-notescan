import { authorize, MASTER_ONLY } from "@/lib/auth/actor";
import { issueApiToken, revokeApiToken } from "@/lib/auth/token";
import { logger } from "@/lib/logger";
import { findAgent } from "@/lib/services/agent.service";
import { issueTokenSchema } from "@/lib/validations";

type Ctx = { params: Promise<{ id: string }> };
const notFound = () => Response.json({ message: "Agente não encontrado" }, { status: 404 });

// Emite (ou reemite, revogando o anterior na mesma transação). O valor em
// claro só existe nesta resposta: no-store e nada de log.
export async function POST(request: Request, { params }: Ctx) {
  const actor = await authorize(request, MASTER_ONLY);
  if (actor instanceof Response) return actor;

  const parsed = issueTokenSchema.safeParse(await request.json());
  if (!parsed.success)
    return Response.json(
      { message: "Dados inválidos", errors: parsed.error.issues },
      { status: 400 },
    );

  const { id } = await params;
  if (!(await findAgent(id))) return notFound();

  try {
    const { token, prefix, scopes, expiresAt } = await issueApiToken(id, parsed.data.scopes, actor);
    return Response.json(
      { token, prefix, scopes, expiresAt },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
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
    if (!(await revokeApiToken(id, actor)))
      return Response.json({ message: "Nenhum token ativo" }, { status: 404 });
    return new Response(null, { status: 204 });
  } catch (error) {
    logger.captureException(error);
    return Response.json({ message: "Erro interno" }, { status: 500 });
  }
}
