import { authorize } from "@/lib/auth/actor";
import { prisma } from "@/lib/db/prisma";
import { rateLimitByIp } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { createConferenceSchema } from "@/lib/validations";
import { originalHostname } from "@/lib/notebook-hostname";
import { getItinerantCoverage, validateConference } from "@/lib/services/conference.service";
import { CATEGORIA_LABEL } from "@/lib/constants";
import { progressoPorCategoria, rotuloProgresso, type MetaCategoria, type ProgressoCategoria } from "@/lib/meta-categoria";

export async function GET(request: Request) {
  const actor = await authorize(request, { scopes: [] });
  if (actor instanceof Response) return actor;

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
    ...(actor.role === "USER" && { userId: actor.userId }),
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
          tipo: true,
          project: { select: { id: true, nome: true, cor: true } },
        },
      },
      umFisica: { select: { id: true, nome: true } },
      metas: { select: { categoria: true, meta: true } },
      items: { select: { status: true, notebook: { select: { hostname: true, categoria: true } } } },
      _count: { select: { items: true } },
    },
  });

  return Response.json(conferences);
}

export async function POST(request: Request) {
  const rl = rateLimitByIp(request, 30, 60_000);
  if (!rl.allowed)
    return Response.json({ message: "Muitas requisições" }, { status: 429 });

  const actor = await authorize(request, { scopes: [] });
  if (actor instanceof Response) return actor;

  const parsed = createConferenceSchema.safeParse(await request.json());
  if (!parsed.success)
    return Response.json(
      { message: "Dados inválidos", errors: parsed.error.issues },
      { status: 400 },
    );

  const { umId, umFisicaId, dataInicio, dataFim, localizacao, mousesQtd, carregadoresQtd, fonesQtd, items } = parsed.data;

  const shape = await validateConference(parsed.data);
  if ("error" in shape) return Response.json({ message: shape.error }, { status: 400 });
  const itinerante = shape.tipo === "ITINERANTE";
  // Fixa: o do cliente (já conferido com os itens). Itinerante: recalculado pela meta.
  const status = shape.status;

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
  // Conferência itinerante acompanha a da carreta: não conta para a meta diária.
  if (!isSyncReplay && !itinerante) {
    const dbUser = await prisma.user.findUnique({
      where: { id: actor.userId },
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
          userId: actor.userId,
          dataInicio: { gte: startOfDay, lte: endOfDay },
          um: { tipo: "FIXA" },
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
        userId: actor.userId,
        umId,
        umFisicaId,
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
        ...(shape.metas.length > 0 && { metas: { create: shape.metas } }),
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
        umFisica: { select: { nome: true } },
        metas: { select: { categoria: true, meta: true } },
        items: { include: { notebook: { select: { hostname: true, categoria: true } } } },
      },
    });

    const faltantes = dedupedItems.filter((i) => i.status === "FALTANTE");
    if (faltantes.length > 0) {
      await prisma.lifecycleEvent.createMany({
        data: faltantes.map((item) => ({
          notebookId: item.notebookId,
          userId: actor.userId,
          tipo: "FALTANTE",
          descricao: `Notebook não encontrado na conferência ${conference.id}`,
        })),
      });
    }

    await notifyTelegram(conference, itinerante ? await itinerantSummary(conference) : undefined);

    return Response.json(conference, { status: 201 });
  } catch (error) {
    logger.captureException(error, { userId: actor.userId, umId });
    return Response.json({ message: "Erro interno" }, { status: 500 });
  }
}

type CreatedConference = Omit<Parameters<typeof notifyTelegram>[0], "items"> & {
  umId: string;
  umFisica: { nome: string } | null;
  metas: MetaCategoria[];
  items: { status: string; notebook: { hostname: string; categoria: keyof typeof CATEGORIA_LABEL | null } }[];
};

interface ItinerantSummary {
  umFisica: string;
  progresso: ProgressoCategoria[];
  grupo: { cobertos: number; total: number };
}

/** UM física, lidos × meta por categoria e cobertura do grupo no dia da conferência. */
async function itinerantSummary(conference: CreatedConference): Promise<ItinerantSummary | undefined> {
  try {
    const progresso = progressoPorCategoria(
      conference.metas,
      conference.items.filter((i) => i.status === "ESCANEADO").map((i) => i.notebook.categoria),
    );
    // Dia da conferência (não "agora"): replay offline cai no dia certo.
    const [grupo] = await getItinerantCoverage(new Date(conference.dataInicio), [conference.umId]);
    return {
      umFisica: conference.umFisica?.nome ?? "-",
      progresso,
      grupo: { cobertos: grupo?.cobertos ?? 0, total: grupo?.total ?? 0 },
    };
  } catch (err) {
    // Telegram é acessório: a conferência já foi gravada.
    logger.warn("Resumo itinerante do Telegram falhou", { error: String(err) });
    return undefined;
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
}, itinerante?: ItinerantSummary) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    // Só presença (booleanos), nunca os valores. Chaves sem "token"/"auth":
    // o logger mascara essas chaves e esconderia o próprio booleano.
    logger.warn("Telegram não configurado", { bot: !!token, chatId: !!chatId });
    return;
  }

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
    ...(itinerante ? [`🏠 UM física: ${esc(itinerante.umFisica)}`] : []),
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
  if (itinerante) {
    // Mesmo layout da fixa; o faltante é a diferença por categoria (o notebook
    // itinerante não tem carreta, então não dá para dizer QUAL falta).
    const { progresso } = itinerante;
    const incompletas = progresso.filter((p) => p.falta > 0);
    lines.push(`💻 Meta: ${progresso.reduce((a, p) => a + p.meta, 0)}`);
    lines.push(`👍 Dispositivos Escaneados: ${escaneados}`);
    lines.push(`❗️ Dispositivos Faltantes: ${incompletas.reduce((a, p) => a + p.falta, 0)}`);
    if (incompletas.length > 0) {
      lines.push(``);
      lines.push(`*Lista de Faltantes:*`);
      for (const p of incompletas) lines.push(`\\- ${esc(`${rotuloProgresso(p)} — falta ${p.falta}`)}`);
    }
    lines.push(``);
    lines.push(`👥 Grupo: ${itinerante.grupo.cobertos}/${itinerante.grupo.total} com 2 leituras hoje`);
    lines.push(``);
    lines.push(`Status: *${statusLabel}*`);
    return sendTelegram(token, chatId, lines.join("\n"));
  }
  lines.push(`💻 Dispositivos Ativos: ${totalAtivos}`);
  lines.push(`👍 Dispositivos Escaneados: ${escaneados}`);
  lines.push(`❗️ Dispositivos Faltantes: ${faltanteItems.length}`);
  lines.push(`🔧 Dispositivos em Manutenção: ${manutencaoItems.length}`);

  if (faltanteItems.length > 0) {
    lines.push(``);
    lines.push(`*Lista de Faltantes:*`);
    for (const item of faltanteItems) {
      lines.push(`\\- ${esc(originalHostname(item.notebook.hostname))}`);
    }
  }

  if (manutencaoItems.length > 0) {
    lines.push(``);
    lines.push(`*Lista em Manutenção:*`);
    for (const item of manutencaoItems) {
      lines.push(`\\- ${esc(originalHostname(item.notebook.hostname))}`);
    }
  }

  lines.push(``);
  lines.push(`Status: *${statusLabel}*`);

  return sendTelegram(token, chatId, lines.join("\n"));
}

async function sendTelegram(token: string, chatId: string, text: string) {
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
