import { authorize } from "@/lib/auth/actor";
import { HUMAN_ROLES } from "@/lib/auth/roles";
import { prisma } from "@/lib/db/prisma";
import { logger } from "@/lib/logger";
import { z } from "zod";
import webpush from "web-push";

const sendSchema = z.object({
  title: z.string().min(1).max(100),
  body: z.string().min(1).max(500),
  userId: z.string().optional(),
});

if (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    "mailto:ti@grupoitcbrasil.com.br",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );
}

export async function POST(request: Request) {
  const actor = await authorize(request, { scopes: [], roles: ["ADMIN", "MASTER"] });
  if (actor instanceof Response) return actor;

  const parsed = sendSchema.safeParse(await request.json());
  if (!parsed.success)
    return Response.json(
      { message: "Dados inválidos", errors: parsed.error.issues },
      { status: 400 },
    );

  const { title, body, userId } = parsed.data;

  const subscriptions = await prisma.pushSubscription.findMany({
    where: {
      user: { role: { in: [...HUMAN_ROLES] } },
      ...(userId && { userId }),
    },
  });

  if (!subscriptions.length)
    return Response.json({ message: "Nenhum assinante encontrado", sent: 0 });

  const payload = JSON.stringify({ title, body });
  const results = await Promise.allSettled(
    subscriptions.map((sub) =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
      ),
    ),
  );

  const sent = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.length - sent;

  if (failed > 0) {
    logger.warn("Some push notifications failed", { sent, failed });
  }

  return Response.json({ sent, failed });
}
