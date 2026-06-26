import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { logger } from "@/lib/logger";
import { importNotebooksSchema } from "@/lib/validations";

export async function POST(request: Request) {
  const session = await auth();
  if (!session)
    return Response.json({ message: "Não autorizado" }, { status: 401 });

  if (!["ADMIN", "MASTER"].includes(session.user.role))
    return Response.json({ message: "Proibido" }, { status: 403 });

  const parsed = importNotebooksSchema.safeParse(await request.json());
  if (!parsed.success)
    return Response.json(
      { message: "Dados inválidos", errors: parsed.error.issues },
      { status: 400 },
    );

  const { umId, rows } = parsed.data;

  try {
    const result = await prisma.notebook.createMany({
      data: rows.map((row) => ({
        hostname: row.hostname,
        serial: row.serial ?? null,
        patrimonio: row.patrimonio ?? null,
        umId,
        status: "ATIVO",
      })),
      skipDuplicates: true,
    });

    return Response.json(
      { created: result.count, total: rows.length },
      { status: 201 },
    );
  } catch (error) {
    logger.captureException(error);
    return Response.json({ message: "Erro interno" }, { status: 500 });
  }
}
