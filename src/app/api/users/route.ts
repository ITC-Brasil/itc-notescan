import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { logger } from "@/lib/logger";
import { createUserSchema } from "@/lib/validations";
import bcrypt from "bcrypt";

export async function GET() {
  const session = await auth();
  if (!session)
    return Response.json({ message: "Não autorizado" }, { status: 401 });

  if (!["ADMIN", "MASTER"].includes(session.user.role))
    return Response.json({ message: "Proibido" }, { status: 403 });

  const users = await prisma.user.findMany({
    orderBy: { nome: "asc" },
    select: {
      id: true,
      nome: true,
      email: true,
      role: true,
      metaDiaria: true,
      createdAt: true,
    },
  });

  return Response.json(users);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session)
    return Response.json({ message: "Não autorizado" }, { status: 401 });

  if (session.user.role !== "MASTER")
    return Response.json({ message: "Proibido" }, { status: 403 });

  const parsed = createUserSchema.safeParse(await request.json());
  if (!parsed.success)
    return Response.json(
      { message: "Dados inválidos", errors: parsed.error.issues },
      { status: 400 },
    );

  const { password, ...rest } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email: rest.email } });
  if (existing)
    return Response.json({ message: "E-mail já cadastrado" }, { status: 409 });

  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { ...rest, passwordHash },
      select: {
        id: true,
        nome: true,
        email: true,
        role: true,
        metaDiaria: true,
        createdAt: true,
      },
    });
    return Response.json(user, { status: 201 });
  } catch (error) {
    logger.captureException(error);
    return Response.json({ message: "Erro interno" }, { status: 500 });
  }
}
