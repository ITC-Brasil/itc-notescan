import { authorize, WRITE_CATALOG } from "@/lib/auth/actor";
import { audit } from "@/lib/services/audit.service";
import { UM_INCLUDE } from "@/lib/services/um.service";
import { prisma } from "@/lib/db/prisma";
import { logger } from "@/lib/logger";
import { createUMSchema } from "@/lib/validations";

export async function GET(request: Request) {
  const actor = await authorize(request, { scopes: ["read:catalog"], rate: "read" });
  if (actor instanceof Response) return actor;

  const ums = await prisma.uM.findMany({
    orderBy: [{ project: { nome: "asc" } }, { nome: "asc" }],
    include: UM_INCLUDE,
  });

  return Response.json(ums);
}

export async function POST(request: Request) {
  const actor = await authorize(request, WRITE_CATALOG);
  if (actor instanceof Response) return actor;

  const parsed = createUMSchema.safeParse(await request.json());
  if (!parsed.success)
    return Response.json(
      { message: "Dados inválidos", errors: parsed.error.issues },
      { status: 400 },
    );

  try {
    const um = await prisma.$transaction(async (tx) => {
      const created = await tx.uM.create({ data: parsed.data, include: UM_INCLUDE });
      await audit(tx, actor, { entidade: "UM", entidadeId: created.id, acao: "CRIADO", payload: parsed.data });
      return created;
    });
    return Response.json(um, { status: 201 });
  } catch (error) {
    logger.captureException(error);
    return Response.json({ message: "Erro interno" }, { status: 500 });
  }
}
