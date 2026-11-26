import bcrypt from "bcryptjs";
import { z } from "zod";
import { authorize } from "@/lib/auth/actor";
import { prisma } from "@/lib/db/prisma";
import { logger } from "@/lib/logger";

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Senha atual obrigatória"),
  newPassword: z.string().min(8, "Nova senha deve ter no mínimo 8 caracteres"),
});

export async function PUT(request: Request) {
  const actor = await authorize(request, { scopes: [] });
  if (actor instanceof Response) return actor;

  const parsed = changePasswordSchema.safeParse(await request.json());
  if (!parsed.success)
    return Response.json(
      { message: "Dados inválidos", errors: parsed.error.issues },
      { status: 400 },
    );

  try {
    const user = await prisma.user.findUnique({
      where: { id: actor.userId },
      select: { passwordHash: true },
    });

    if (!user)
      return Response.json({ message: "Usuário não encontrado" }, { status: 404 });

    if (!user.passwordHash)
      return Response.json({ message: "Usuário sem senha" }, { status: 409 });

    const isValid = await bcrypt.compare(
      parsed.data.currentPassword,
      user.passwordHash,
    );
    if (!isValid)
      return Response.json({ message: "Senha atual incorreta" }, { status: 400 });

    const hash = await bcrypt.hash(parsed.data.newPassword, 12);
    await prisma.user.update({
      where: { id: actor.userId },
      data: { passwordHash: hash },
    });

    return Response.json({ message: "Senha alterada com sucesso" });
  } catch (error) {
    logger.captureException(error);
    return Response.json({ message: "Erro interno" }, { status: 500 });
  }
}
