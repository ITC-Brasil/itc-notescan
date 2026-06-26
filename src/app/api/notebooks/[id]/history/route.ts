import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { logger } from "@/lib/logger";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session)
    return Response.json({ message: "Não autorizado" }, { status: 401 });

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
