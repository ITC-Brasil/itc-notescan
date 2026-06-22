import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { logger } from "@/lib/logger";
import { z } from "zod";

const schema = z.object({ umId: z.string().min(1) });

export async function POST(request: Request) {
  const session = await auth();
  if (!session)
    return Response.json({ message: "Não autorizado" }, { status: 401 });

  if (!["ADMIN", "MASTER"].includes(session.user.role))
    return Response.json({ message: "Proibido" }, { status: 403 });

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success)
    return Response.json({ message: "Dados inválidos" }, { status: 400 });

  const { umId } = parsed.data;

  try {
    const result = await prisma.notebook.deleteMany({ where: { umId } });
    return Response.json({ deleted: result.count });
  } catch (error) {
    logger.captureException(error);
    return Response.json({ message: "Erro interno" }, { status: 500 });
  }
}
