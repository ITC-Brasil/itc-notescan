import { auth } from "@/lib/auth/config";
import { prisma } from "@/lib/db/prisma";
import { logger } from "@/lib/logger";
import { createNotebooksBatchSchema } from "@/lib/validations";

export async function POST(request: Request) {
  const session = await auth();
  if (!session)
    return Response.json({ message: "Não autorizado" }, { status: 401 });

  if (!["ADMIN", "MASTER"].includes(session.user.role))
    return Response.json({ message: "Proibido" }, { status: 403 });

  const parsed = createNotebooksBatchSchema.safeParse(await request.json());
  if (!parsed.success)
    return Response.json(
      { message: "Dados inválidos", errors: parsed.error.issues },
      { status: 400 },
    );

  const { prefix, start, end, umId, status } = parsed.data;

  if (end < start)
    return Response.json(
      { message: "O número final deve ser maior ou igual ao inicial" },
      { status: 400 },
    );

  const hostnames: string[] = [];
  for (let i = start; i <= end; i++) {
    const suffix = i < 10 ? `0${i}` : String(i);
    hostnames.push(`${prefix}${suffix}`);
  }

  try {
    const result = await prisma.notebook.createMany({
      data: hostnames.map((hostname) => ({ hostname, umId, status })),
      skipDuplicates: true,
    });

    return Response.json(
      { created: result.count, total: hostnames.length },
      { status: 201 },
    );
  } catch (error) {
    logger.captureException(error);
    return Response.json({ message: "Erro interno" }, { status: 500 });
  }
}
