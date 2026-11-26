import { authorize } from "@/lib/auth/actor";
import { prisma } from "@/lib/db/prisma";
import { logger } from "@/lib/logger";
import { z } from "zod";
import bcrypt from "bcrypt";

const updateUserSchema = z.object({
  nome: z.string().min(2).max(100),
  email: z.string().email(),
  role: z.enum(["USER", "ADMIN", "MASTER", "AGENTE"]),
  metaDiaria: z.number().int().min(1),
  password: z.string().min(8).optional(),
});

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = await authorize(request, { scopes: [], roles: ["MASTER"] });
  if (actor instanceof Response) return actor;

  const parsed = updateUserSchema.safeParse(await request.json());
  if (!parsed.success)
    return Response.json(
      { message: "Dados inválidos", errors: parsed.error.issues },
      { status: 400 },
    );

  const { id } = await params;
  const { password, ...rest } = parsed.data;

  // m8-01: AGENTE é imutável — nenhuma conversão de/para AGENTE.
  const current = await prisma.user.findUnique({ where: { id }, select: { role: true } });
  if (!current)
    return Response.json({ message: "Usuário não encontrado" }, { status: 404 });
  if (current.role === "AGENTE" || rest.role === "AGENTE")
    return Response.json({ message: "A role AGENTE é imutável" }, { status: 409 });

  try {
    const data: Parameters<typeof prisma.user.update>[0]["data"] = { ...rest };
    if (password) {
      data.passwordHash = await bcrypt.hash(password, 12);
    }

    const user = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        nome: true,
        email: true,
        role: true,
        metaDiaria: true,
        createdAt: true,
      },
    });
    return Response.json(user);
  } catch (error) {
    logger.captureException(error);
    return Response.json({ message: "Erro interno" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = await authorize(request, { scopes: [], roles: ["MASTER"] });
  if (actor instanceof Response) return actor;

  const { id } = await params;

  if (id === actor.userId)
    return Response.json(
      { message: "Você não pode excluir sua própria conta" },
      { status: 409 },
    );

  // m8-01: agentes são geridos em /api/agents.
  const target = await prisma.user.findUnique({ where: { id }, select: { role: true } });
  if (!target || target.role === "AGENTE")
    return Response.json({ message: "Usuário não encontrado" }, { status: 404 });

  try {
    await prisma.user.delete({ where: { id } });
    return new Response(null, { status: 204 });
  } catch (error) {
    logger.captureException(error);
    return Response.json({ message: "Erro interno" }, { status: 500 });
  }
}
