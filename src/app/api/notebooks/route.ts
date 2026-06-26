import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { logger } from "@/lib/logger";
import { createNotebookSchema } from "@/lib/validations";

export async function GET(request: Request) {
  const session = await auth();
  if (!session)
    return Response.json({ message: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const umId = searchParams.get("umId");

  const notebooks = await prisma.notebook.findMany({
    where: umId ? { umId } : undefined,
    orderBy: [
      { um: { project: { nome: "asc" } } },
      { um: { nome: "asc" } },
      { hostname: "asc" },
    ],
    include: {
      um: {
        select: {
          id: true,
          nome: true,
          project: { select: { id: true, nome: true, cor: true } },
        },
      },
    },
  });

  return Response.json(notebooks);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session)
    return Response.json({ message: "Não autorizado" }, { status: 401 });

  if (!["ADMIN", "MASTER"].includes(session.user.role))
    return Response.json({ message: "Proibido" }, { status: 403 });

  const parsed = createNotebookSchema.safeParse(await request.json());
  if (!parsed.success)
    return Response.json(
      { message: "Dados inválidos", errors: parsed.error.issues },
      { status: 400 },
    );

  try {
    const notebook = await prisma.notebook.create({
      data: parsed.data,
      include: {
        um: {
          select: {
            id: true,
            nome: true,
            project: { select: { id: true, nome: true, cor: true } },
          },
        },
      },
    });
    return Response.json(notebook, { status: 201 });
  } catch (error) {
    logger.captureException(error);
    return Response.json({ message: "Erro interno" }, { status: 500 });
  }
}
