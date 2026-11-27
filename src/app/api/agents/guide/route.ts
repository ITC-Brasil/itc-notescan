import { readFile } from "fs/promises";
import { join } from "path";
import { resolveActor } from "@/lib/auth/actor";
import { logger } from "@/lib/logger";
import { rateLimitByActor } from "@/lib/rate-limit";

// Guia de API para agentes (docs/AGENT-API.md): qualquer token válido (o agente lê
// antes de operar, sem escopo exigido) ou MASTER em sessão. text/plain para o
// navegador exibir em vez de baixar. O arquivo entra na imagem por
// outputFileTracingIncludes (next.config.ts) e pela exceção no .dockerignore.
const GUIDE = join(process.cwd(), "docs", "AGENT-API.md");

export async function GET(request: Request) {
  // Revogado, expirado, inexistente ou de agente desativado → null (401).
  const actor = await resolveActor(request);
  if (!actor) return Response.json({ message: "Não autorizado" }, { status: 401 });
  if (actor.kind === "session" && actor.role !== "MASTER")
    return Response.json({ message: "Proibido" }, { status: 403 });
  if (!rateLimitByActor(actor.userId, "read", actor.kind).allowed)
    return Response.json({ message: "Muitas requisições, aguarde alguns segundos" }, { status: 429 });

  try {
    return new Response(await readFile(GUIDE, "utf-8"), {
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  } catch (error) {
    logger.captureException(error);
    return Response.json({ message: "Guia indisponível" }, { status: 500 });
  }
}
