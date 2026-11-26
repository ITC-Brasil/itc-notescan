import { auth } from "@/lib/auth";
import { authorize } from "@/lib/auth/actor";
import { prisma } from "@/lib/db/prisma";
import { logger } from "@/lib/logger";
import { createUMSchema } from "@/lib/validations";

export async function GET(request: Request) {
  const actor = await authorize(request, { scopes: ["read:catalog"] });
  if (actor instanceof Response) return actor;

  const ums = await prisma.uM.findMany({
    orderBy: [{ project: { nome: "asc" } }, { nome: "asc" }],
    include: {
      project: { select: { id: true, nome: true, cor: true } },
      _count: { select: { notebooks: { where: { status: { not: "ARQUIVADO" } } } } },
    },
  });

  return Response.json(ums);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session)
    return Response.json({ message: "Não autorizado" }, { status: 401 });

  if (!["ADMIN", "MASTER"].includes(session.user.role))
    return Response.json({ message: "Proibido" }, { status: 403 });

  const parsed = createUMSchema.safeParse(await request.json());
  if (!parsed.success)
    return Response.json(
      { message: "Dados inválidos", errors: parsed.error.issues },
      { status: 400 },
    );

  try {
    const um = await prisma.uM.create({
      data: parsed.data,
      include: {
        project: { select: { id: true, nome: true, cor: true } },
        _count: { select: { notebooks: { where: { status: { not: "ARQUIVADO" } } } } },
      },
    });
    return Response.json(um, { status: 201 });
  } catch (error) {
    logger.captureException(error);
    return Response.json({ message: "Erro interno" }, { status: 500 });
  }
}
