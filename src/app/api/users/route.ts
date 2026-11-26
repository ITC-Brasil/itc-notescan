import { auth } from "@/lib/auth";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { logger } from "@/lib/logger";
import { agentEmail, agentSlug } from "@/lib/services/user.service";
import { createAgentSchema, createUserSchema } from "@/lib/validations";
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

  const body: unknown = await request.json();
  const isAgent =
    typeof body === "object" && body !== null && "role" in body && body.role === "AGENTE";
  if (isAgent) return createAgent(body);

  const parsed = createUserSchema.safeParse(body);
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

const userSelect = {
  id: true,
  nome: true,
  email: true,
  role: true,
  metaDiaria: true,
  createdAt: true,
} as const;

async function createAgent(body: unknown) {
  const parsed = createAgentSchema.safeParse(body);
  if (!parsed.success)
    return Response.json(
      { message: "Dados inválidos", errors: parsed.error.issues },
      { status: 400 },
    );

  const { nome, descricao } = parsed.data;
  try {
    const taken = await prisma.user.findMany({
      where: { email: { startsWith: `agente-${agentSlug(nome)}` } },
      select: { email: true },
    });
    const user = await prisma.user.create({
      data: {
        nome,
        descricao,
        role: "AGENTE",
        email: agentEmail(nome, taken.map((u) => u.email)),
        passwordHash: null,
      },
      select: { ...userSelect, descricao: true },
    });
    return Response.json(user, { status: 201 });
  } catch (error) {
    // ponytail: corrida entre dois cadastros com o mesmo slug cai aqui; repetir resolve.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
      return Response.json({ message: "E-mail já cadastrado, tente novamente" }, { status: 409 });
    logger.captureException(error);
    return Response.json({ message: "Erro interno" }, { status: 500 });
  }
}
