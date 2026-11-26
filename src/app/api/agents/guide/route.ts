import { readFile } from "fs/promises";
import { join } from "path";
import { authorize, MASTER_ONLY } from "@/lib/auth/actor";
import { logger } from "@/lib/logger";

// Guia de API para agentes (docs/AGENT-API.md), só para MASTER. text/plain para o
// navegador exibir em vez de baixar. O arquivo entra na imagem por
// outputFileTracingIncludes (next.config.ts) e pela exceção no .dockerignore.
const GUIDE = join(process.cwd(), "docs", "AGENT-API.md");

export async function GET(request: Request) {
  const actor = await authorize(request, MASTER_ONLY);
  if (actor instanceof Response) return actor;

  try {
    return new Response(await readFile(GUIDE, "utf-8"), {
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  } catch (error) {
    logger.captureException(error);
    return Response.json({ message: "Guia indisponível" }, { status: 500 });
  }
}
