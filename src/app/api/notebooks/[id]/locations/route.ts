import { authorize } from "@/lib/auth/actor";
import { getNotebookLocations } from "@/lib/services/conference.service";
import { logger } from "@/lib/logger";

/** Histórico de localização: UM física de cada leitura em conferência itinerante. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = await authorize(request, { scopes: ["read:catalog"], rate: "read" });
  if (actor instanceof Response) return actor;

  const { id } = await params;

  try {
    return Response.json(await getNotebookLocations(id));
  } catch (error) {
    logger.captureException(error);
    return Response.json({ message: "Erro interno" }, { status: 500 });
  }
}
