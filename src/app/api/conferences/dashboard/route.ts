import { auth } from "@/lib/auth/config";
import { getDashboardStats } from "@/lib/services/conference.service";
import { logger } from "@/lib/logger";

export async function GET() {
  const session = await auth();
  if (!session)
    return Response.json({ message: "Não autorizado" }, { status: 401 });

  if (!["ADMIN", "MASTER"].includes(session.user.role))
    return Response.json({ message: "Proibido" }, { status: 403 });

  try {
    const stats = await getDashboardStats();
    return Response.json(stats);
  } catch (error) {
    logger.captureException(error);
    return Response.json({ message: "Erro interno" }, { status: 500 });
  }
}
