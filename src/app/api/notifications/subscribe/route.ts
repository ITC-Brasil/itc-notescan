import { authorize } from "@/lib/auth/actor";
import { prisma } from "@/lib/db/prisma";
import { logger } from "@/lib/logger";
import { z } from "zod";

const subscribeSchema = z.object({
  endpoint: z.string().url(),
  p256dh: z.string().min(1),
  auth: z.string().min(1),
});

export async function POST(request: Request) {
  const actor = await authorize(request, { scopes: [] });
  if (actor instanceof Response) return actor;

  const parsed = subscribeSchema.safeParse(await request.json());
  if (!parsed.success)
    return Response.json(
      { message: "Dados inválidos", errors: parsed.error.issues },
      { status: 400 },
    );

  try {
    await prisma.pushSubscription.upsert({
      where: { userId: actor.userId },
      update: {
        endpoint: parsed.data.endpoint,
        p256dh: parsed.data.p256dh,
        auth: parsed.data.auth,
      },
      create: {
        endpoint: parsed.data.endpoint,
        p256dh: parsed.data.p256dh,
        auth: parsed.data.auth,
        userId: actor.userId,
      },
    });
    return Response.json({ ok: true }, { status: 201 });
  } catch (error) {
    logger.captureException(error);
    return Response.json({ message: "Erro interno" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const actor = await authorize(request, { scopes: [] });
  if (actor instanceof Response) return actor;

  try {
    await prisma.pushSubscription.deleteMany({
      where: { userId: actor.userId },
    });
    return new Response(null, { status: 204 });
  } catch (error) {
    logger.captureException(error);
    return Response.json({ message: "Erro interno" }, { status: 500 });
  }
}
