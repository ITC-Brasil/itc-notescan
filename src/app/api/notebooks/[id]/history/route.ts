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
    const items = await prisma.conferenceItem.findMany({
      where: { notebookId: id },
      orderBy: { conference: { dataInicio: "desc" } },
      include: {
        conference: {
          include: {
            user: { select: { nome: true } },
            um: {
              select: {
                nome: true,
                project: { select: { nome: true, cor: true } },
              },
            },
          },
        },
      },
    });
    return Response.json(items);
  } catch (error) {
    logger.captureException(error);
    return Response.json({ message: "Erro interno" }, { status: 500 });
  }
}
