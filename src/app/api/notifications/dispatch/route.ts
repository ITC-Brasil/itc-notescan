import { authorize } from "@/lib/auth/actor";
import { isHumanRole } from "@/lib/auth/roles";
import { prisma } from "@/lib/db/prisma";
import { logger } from "@/lib/logger";
import { z } from "zod";
import webpush from "web-push";

const dispatchSchema = z.object({
  title: z.string().min(1).max(100),
  body: z.string().min(1).max(500),
  userIds: z.array(z.string()).min(1),
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

  const parsed = dispatchSchema.safeParse(await request.json());
  if (!parsed.success)
    return Response.json(
      { message: "Dados inválidos", errors: parsed.error.issues },
      { status: 400 },
    );

  const { title, body, userIds } = parsed.data;

  // Destinatários só podem ser usuários humanos existentes.
  const recipients = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, role: true },
  });
  const humanIds = new Set(recipients.filter((u) => isHumanRole(u.role)).map((u) => u.id));
  const invalidUserIds = userIds.filter((id) => !humanIds.has(id));
  if (invalidUserIds.length)
    return Response.json(
      { message: "Destinatários inválidos", invalidUserIds },
      { status: 400 },
    );

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId: { in: userIds } },
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
    logger.warn("Some push dispatch notifications failed", { sent, failed });
  }

  return Response.json({ sent, failed });
}
