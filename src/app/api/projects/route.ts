import { authorize, WRITE_CATALOG } from "@/lib/auth/actor";
import { audit } from "@/lib/services/audit.service";
import { prisma } from "@/lib/db/prisma";
import { logger } from "@/lib/logger";
import { createProjectSchema } from "@/lib/validations";

export async function GET(request: Request) {
  const actor = await authorize(request, { scopes: ["read:catalog"], rate: "read" });
  if (actor instanceof Response) return actor;

  const projects = await prisma.project.findMany({
    orderBy: { nome: "asc" },
    include: { _count: { select: { ums: true } } },
  });

  return Response.json(projects);
}

export async function POST(request: Request) {
  const actor = await authorize(request, WRITE_CATALOG);
  if (actor instanceof Response) return actor;

  const parsed = createProjectSchema.safeParse(await request.json());
  if (!parsed.success)
    return Response.json(
      { message: "Dados inválidos", errors: parsed.error.issues },
      { status: 400 },
    );

  try {
    const project = await prisma.$transaction(async (tx) => {
      const created = await tx.project.create({ data: parsed.data });
      await audit(tx, actor, { entidade: "Project", entidadeId: created.id, acao: "CRIADO", payload: parsed.data });
      return created;
    });
    return Response.json(project, { status: 201 });
  } catch (error) {
    logger.captureException(error);
    return Response.json({ message: "Erro interno" }, { status: 500 });
  }
}
