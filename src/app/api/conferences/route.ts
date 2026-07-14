import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { rateLimitByIp } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { createConferenceSchema } from "@/lib/validations";

export async function GET(request: Request) {
  const session = await auth();
  if (!session)
    return Response.json({ message: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? "10"), 100);
  const userId = searchParams.get("userId");
  const umId = searchParams.get("umId");
  const status = searchParams.get("status");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const where = {
    ...(userId && { userId }),
    ...(umId && { umId }),
    ...(status && { status: status as "CONCLUIDO_OK" | "CONCLUIDO_FALTANTES" }),
    ...(from || to
      ? {
          dataInicio: {
            ...(from && { gte: new Date(from) }),
            ...(to && { lte: new Date(to) }),
          },
        }
      : {}),
    ...(session.user.role === "USER" && { userId: session.user.id }),
  };

  const conferences = await prisma.conference.findMany({
    where,
    orderBy: { dataInicio: "desc" },
    take: limit,
    include: {
      user: { select: { id: true, nome: true } },
      um: {
        select: {
          id: true,
          nome: true,
          mouses: true,
          carregadores: true,
          fones: true,
          project: { select: { id: true, nome: true, cor: true } },
        },
      },
      items: { select: { status: true, notebook: { select: { hostname: true } } } },
      _count: { select: { items: true } },
    },
  });

  return Response.json(conferences);
}

export async function POST(request: Request) {
  const rl = rateLimitByIp(request, 30, 60_000);
  if (!rl.allowed)
    return Response.json({ message: "Muitas requisições" }, { status: 429 });

  const session = await auth();
  if (!session)
    return Response.json({ message: "Não autorizado" }, { status: 401 });

  const parsed = createConferenceSchema.safeParse(await request.json());
  if (!parsed.success)
    return Response.json(
      { message: "Dados inválidos", errors: parsed.error.issues },
      { status: 400 },
    );

  const { umId, dataInicio, dataFim, localizacao, status, mousesQtd, carregadoresQtd, fonesQtd, items } = parsed.data;

  try {
    const conference = await prisma.conference.create({
      data: {
        userId: session.user.id,
        umId,
        dataInicio: new Date(dataInicio),
        dataFim: new Date(dataFim),
        localizacao,
        status,
        mousesQtd,
        carregadoresQtd,
        fonesQtd,
        items: {
          create: items.map((item) => ({
            notebookId: item.notebookId,
            status: item.status,
          })),
        },
      },
      include: {
        user: { select: { id: true, nome: true } },
        um: { select: { id: true, nome: true, project: { select: { nome: true, cor: true } } } },
        items: { include: { notebook: { select: { hostname: true } } } },
      },
    });

    const faltantes = items.filter((i) => i.status === "FALTANTE");
    if (faltantes.length > 0) {
      await prisma.lifecycleEvent.createMany({
        data: faltantes.map((item) => ({
          notebookId: item.notebookId,
          userId: session.user.id,
          tipo: "FALTANTE",
          descricao: `Notebook não encontrado na conferência ${conference.id}`,
        })),
      });
    }

    await notifyTelegram(conference);

    return Response.json(conference, { status: 201 });
  } catch (error) {
    logger.captureException(error, { userId: session.user.id, umId });
    return Response.json({ message: "Erro interno" }, { status: 500 });
  }
}

async function notifyTelegram(conference: {
  id: string;
  status: string;
  dataInicio: Date;
  dataFim: Date;
  localizacao?: string | null;
  user: { nome: string };
  um: { nome: string; project: { nome: string; cor: string } };
  items: { status: string; notebook: { hostname: string } }[];
}) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  const escaneados = conference.items.filter((i) => i.status === "ESCANEADO").length;
  const faltantes = conference.items.filter((i) => i.status === "FALTANTE").length;
  const manutencao = conference.items.filter((i) => i.status === "MANUTENCAO").length;
  const total = conference.items.length;

  const data = new Date(conference.dataInicio).toLocaleDateString("pt-BR");
  const hora = new Date(conference.dataInicio).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const statusLabel =
    conference.status === "CONCLUIDO_OK" ? "CONCLUÍDO ✅" : "FALTANTES ⚠️";

  const text = [
    `🔍 *Conferência Concluída*`,
    ``,
    `👤 Técnico: ${conference.user.nome}`,
    `📦 UM: ${conference.um.nome} (${conference.um.project.nome})`,
    `📅 Data: ${data} às ${hora}`,
    `📍 Local: ${conference.localizacao ?? "Não informado"}`,
    ``,
    `✅ Escaneados: ${escaneados}/${total}`,
    `❌ Faltantes: ${faltantes}`,
    `🔧 Manutenção: ${manutencao}`,
    ``,
    `Status: ${statusLabel}`,
  ].join("\n");

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" }),
    });
  } catch (err) {
    logger.warn("Telegram notification failed", { error: String(err) });
  }
}
