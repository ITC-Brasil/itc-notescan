import { z } from "zod";
import { authorize } from "@/lib/auth/actor";
import { getItinerantReadsToday } from "@/lib/services/conference.service";

const querySchema = z.object({ umId: z.string().min(1) });

/**
 * Notebooks da UM itinerante já lidos hoje por OUTROS técnicos — só para o aviso
 * no scanner (não bloqueia). Offline o cliente simplesmente não avisa.
 */
export async function GET(request: Request) {
  const actor = await authorize(request, { scopes: [], rate: "read" });
  if (actor instanceof Response) return actor;

  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success)
    return Response.json({ message: "Dados inválidos", errors: parsed.error.issues }, { status: 400 });

  const reads = await getItinerantReadsToday([parsed.data.umId]);
  const ids = [...new Set(reads.filter((r) => r.conference.userId !== actor.userId).map((r) => r.notebookId))];
  return Response.json({ notebookIds: ids });
}
