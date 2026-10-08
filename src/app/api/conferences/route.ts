import { auth } from "@/lib/auth";
import { isHumanRole } from "@/lib/auth/roles";
import { prisma } from "@/lib/db/prisma";
import { rateLimitByIp } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { createConferenceSchema } from "@/lib/validations";

export async function GET(request: Request) {
  const session = await auth();
  if (!session)
    return Response.json({ message: "Não autorizado" }, { status: 401 });

  if (!isHumanRole(session.user.role))
    return Response.json({ message: "Proibido" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? "10"), 100);
  const offset = Math.max(Number(searchParams.get("offset") ?? "0"), 0);
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
    // Só roles humanas chegam aqui: ADMIN/MASTER veem tudo, USER só as próprias.
    ...(session.user.role === "USER" && { userId: session.user.id }),
  };

  const conferences = await prisma.conference.findMany({
    where,
    orderBy: { dataInicio: "desc" },
    take: limit,
    skip: offset,
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

  if (!isHumanRole(session.user.role))
    return Response.json({ message: "Proibido" }, { status: 403 });

  const parsed = createConferenceSchema.safeParse(await request.json());
  if (!parsed.success)
    return Response.json(
      { message: "Dados inválidos", errors: parsed.error.issues },
      { status: 400 },
    );

  const { umId, dataInicio, dataFim, localizacao, status, mousesQtd, carregadoresQtd, fonesQtd, items } = parsed.data;

  // Dedupe defensiva por notebookId (mantém a 1ª ocorrência). A @@unique
  // ([conferenceId, notebookId]) é a rede final no banco; esta dedupe impede
  // que uma request legada (cliente anterior à correção da race de leitura
  // dupla) quebre com 500 no índice único. Contagens de Telegram/resumo
  // derivam de conference.items (pós-insert), logo já refletem o deduplicado.
  const seenNotebookIds = new Set<string>();
  const dedupedItems = items.filter((i) => {
    if (seenNotebookIds.has(i.notebookId)) return false;
    seenNotebookIds.add(i.notebookId);
    return true;
  });
  if (dedupedItems.length < items.length) {
    logger.warn("Conferência recebida com itens duplicados (deduplicados na rota)", {
      umId,
      recebidos: items.length,
      apos: dedupedItems.length,
    });
  }

  // Daily limit — hard block for interactive submissions only. Offline
  // conferences replayed from the syncQueue carry X-Sync-Replay and are always
  // recorded (they already happened; never drop data). Counts both statuses.
  const isSyncReplay = request.headers.get("x-sync-replay") === "1";
  if (!isSyncReplay) {
    const dbUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { metaDiaria: true },
    });
    const meta = dbUser?.metaDiaria ?? 0;
    if (meta > 0) {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);
      const todayCount = await prisma.conference.count({
        where: {
          userId: session.user.id,
          dataInicio: { gte: startOfDay, lte: endOfDay },
        },
      });
      if (todayCount >= meta) {
        return Response.json(
          { message: "Meta diária atingida", code: "META_REACHED" },
          { status: 409 },
        );
      }
    }
  }

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
          create: dedupedItems.map((item) => ({
            notebookId: item.notebookId,
            status: item.status,
          })),
        },
      },
      include: {
        user: { select: { id: true, nome: true } },
        um: {
          select: {
            id: true,
            nome: true,
            mouses: true,
            carregadores: true,
            fones: true,
            project: { select: { nome: true, cor: true } },
          },
        },
        items: { include: { notebook: { select: { hostname: true } } } },
      },
    });

    const faltantes = dedupedItems.filter((i) => i.status === "FALTANTE");
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
  mousesQtd?: number | null;
  carregadoresQtd?: number | null;
  fonesQtd?: number | null;
  user: { nome: string };
  um: { nome: string; mouses: boolean; carregadores: boolean; fones: boolean; project: { nome: string; cor: string } };
  items: { status: string; notebook: { hostname: string } }[];
}) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  // MarkdownV2 requires every reserved char to be escaped. A single stray one
  // (e.g. the '-' in hostnames like BSBIA01-EST01) makes Telegram reject the
  // whole message with HTTP 400. Escape all interpolated values.
  const esc = (s: string) => s.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, "\\$&");

  const escaneados = conference.items.filter((i) => i.status === "ESCANEADO").length;
  const faltanteItems = conference.items.filter((i) => i.status === "FALTANTE");
  const manutencaoItems = conference.items.filter((i) => i.status === "MANUTENCAO");
  const totalAtivos = escaneados + faltanteItems.length;

  const dataInicio = new Date(conference.dataInicio);
  const dataFim = new Date(conference.dataFim);
  const dataStr = dataInicio.toLocaleDateString("pt-BR");
  const horaInicio = dataInicio.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const horaFim = dataFim.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  const localizacao = conference.localizacao
    ? `[Ver no Mapa](https://www.google.com/maps?q=${conference.localizacao})`
    : "Não informado";

  const isOk = conference.status === "CONCLUIDO_OK";
  const statusLabel = isOk ? "COMPLETO 🟢" : "INCOMPLETO 🔴";

  const um = conference.um;
  const hasPeripherals = um.mouses || um.carregadores || um.fones;

  const lines: string[] = [
    `🔍 *Conferência Concluída \\- ITC NoteScan*`,
    ``,
    `👤 Técnico: ${esc(conference.user.nome)}`,
    `🚚 UM: ${esc(um.nome)} \\(${esc(um.project.nome)}\\)`,
    `📅 Data: ${esc(dataStr)}`,
    `🕒 Horário: ${esc(horaInicio)} às ${esc(horaFim)}`,
    `📍 Localização: ${localizacao}`,
  ];

  if (hasPeripherals) {
    lines.push(`\`------------------------------------\``);
    lines.push(`Periféricos:`);
    if (um.mouses) lines.push(`\\- Mouses: ${conference.mousesQtd ?? 0}`);
    if (um.carregadores) lines.push(`\\- Carregadores: ${conference.carregadoresQtd ?? 0}`);
    if (um.fones) lines.push(`\\- Fones: ${conference.fonesQtd ?? 0}`);
  }

  lines.push(`\`------------------------------------\``);
  lines.push(`💻 Dispositivos Ativos \\(Esperados\\): ${totalAtivos}`);
  lines.push(`👍 Dispositivos Escaneados: ${escaneados}`);
  lines.push(`❗️ Dispositivos Faltantes: ${faltanteItems.length}`);
  lines.push(`🔧 Dispositivos em Manutenção: ${manutencaoItems.length}`);

  if (faltanteItems.length > 0) {
    lines.push(``);
    lines.push(`*Lista de Faltantes:*`);
    for (const item of faltanteItems) {
      lines.push(`\\- ${esc(item.notebook.hostname)}`);
    }
  }

  if (manutencaoItems.length > 0) {
    lines.push(``);
    lines.push(`*Lista em Manutenção:*`);
    for (const item of manutencaoItems) {
      lines.push(`\\- ${esc(item.notebook.hostname)}`);
    }
  }

  lines.push(``);
  lines.push(`Status: *${statusLabel}*`);

  const text = lines.join("\n");

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "MarkdownV2" }),
    });
    if (!res.ok) {
      // Telegram returns 400 with a description when parsing/escaping fails —
      // surface it instead of silently dropping the notification.
      logger.warn("Telegram notification rejected", {
        status: res.status,
        body: await res.text(),
      });
    }
  } catch (err) {
    logger.warn("Telegram notification failed", { error: String(err) });
  }
}
