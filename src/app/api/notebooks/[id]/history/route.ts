import { authorize } from "@/lib/auth/actor";
import { prisma } from "@/lib/db/prisma";
import { logger } from "@/lib/logger";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = await authorize(request, { scopes: ["read:catalog"], rate: "read" });
  if (actor instanceof Response) return actor;

  const { id } = await params;

  try {
    const events = await prisma.lifecycleEvent.findMany({
      where: { notebookId: id },
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { nome: true } },
      },
    });
    return Response.json(events);
  } catch (error) {
    logger.captureException(error);
    return Response.json({ message: "Erro interno" }, { status: 500 });
  }
}
