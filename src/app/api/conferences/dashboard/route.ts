import { authorize } from "@/lib/auth/actor";
import { getDashboardStats } from "@/lib/services/conference.service";
import { logger } from "@/lib/logger";

export async function GET(request: Request) {
  const actor = await authorize(request, { scopes: [], roles: ["ADMIN", "MASTER"] });
  if (actor instanceof Response) return actor;

  try {
    const stats = await getDashboardStats();
    return Response.json(stats);
  } catch (error) {
    logger.captureException(error);
    return Response.json({ message: "Erro interno" }, { status: 500 });
  }
}
