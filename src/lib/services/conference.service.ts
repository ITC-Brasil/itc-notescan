import { prisma } from "@/lib/db/prisma";
import type { Categoria, CreateConferenceInput } from "@/lib/validations";
import { archiveDateStamp } from "@/lib/notebook-hostname";

type UMRef = { tipo: "FIXA" | "ITINERANTE"; projectId: string };

/**
 * Regras estruturais da conferência × tipo da UM. Pura (testável); devolve a
 * mensagem do 400 ou null. Não confere meta nem posse dos notebooks: isso pode
 * mudar entre o scan offline e o sync, e a conferência nunca pode ser perdida.
 */
export function checkConferenceShape(
  input: Pick<CreateConferenceInput, "status" | "umFisicaId" | "items">,
  um: UMRef,
  umFisica: UMRef | null,
): string | null {
  const temFaltante = input.items.some((i) => i.status === "FALTANTE");
  if (um.tipo === "FIXA") {
    if (input.umFisicaId) return "UM fixa não aceita UM física";
    const esperado = temFaltante ? "CONCLUIDO_FALTANTES" : "CONCLUIDO_OK";
    if (input.status !== esperado) return "Status inconsistente com os itens";
    return null;
  }
  if (!input.umFisicaId) return "Conferência itinerante exige a UM física";
  if (!umFisica) return "UM física não encontrada";
  if (umFisica.tipo !== "FIXA") return "A UM física deve ser uma UM fixa";
  if (umFisica.projectId !== um.projectId) return "A UM física deve ser do mesmo projeto";
  if (input.items.some((i) => i.status !== "ESCANEADO"))
    return "Conferência itinerante só envia itens escaneados";
  if (input.status !== "CONCLUIDO_OK") return "Conferência itinerante é sempre CONCLUIDO_OK";
  return null;
}

/** Carrega as UMs e aplica checkConferenceShape. */
export async function validateConference(
  input: Pick<CreateConferenceInput, "umId" | "status" | "umFisicaId" | "items">,
): Promise<{ error: string } | { tipo: UMRef["tipo"] }> {
  const select = { tipo: true, projectId: true } as const;
  const [um, umFisica] = await Promise.all([
    prisma.uM.findUnique({ where: { id: input.umId }, select }),
    input.umFisicaId ? prisma.uM.findUnique({ where: { id: input.umFisicaId }, select }) : null,
  ]);
  if (!um) return { error: "UM não encontrada" };
  const error = checkConferenceShape(input, um, umFisica);
  return error ? { error } : { tipo: um.tipo };
}

export async function getDashboardStats() {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [
    conferencesToday,
    conferencesWithMissing,
    notebooksInMaintenance,
    notebooksTotal,
    activeTechnicians,
    latestConferences,
    maintenanceNotebooks,
  ] = await Promise.all([
    prisma.conference.count({
      where: { dataInicio: { gte: todayStart } },
    }),
    prisma.conference.count({
      where: {
        dataInicio: { gte: todayStart },
        status: "CONCLUIDO_FALTANTES",
      },
    }),
    prisma.notebook.count({
      where: { status: "MANUTENCAO" },
    }),
    prisma.notebook.count({ where: { status: { not: "ARQUIVADO" } } }),
    prisma.conference
      .findMany({
        where: { dataInicio: { gte: todayStart } },
        select: { userId: true },
        distinct: ["userId"],
      })
      .then((r) => r.length),
    prisma.conference.findMany({
      orderBy: { dataInicio: "desc" },
      take: 10,
      // include retorna todos os escalares (localizacao, dataInicio/Fim, *Qtd).
      // Itens com select mínimo (status + hostname) — suficiente para a contagem
      // lidos/total e para o modal "Ver" (ConferenceSummary), sem carregar
      // serial/patrimônio nem relações desnecessárias.
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
      },
    }),
    prisma.notebook.findMany({
      where: { status: "MANUTENCAO" },
      orderBy: [{ um: { project: { nome: "asc" } } }, { um: { nome: "asc" } }, { hostname: "asc" }],
      select: {
        id: true,
        hostname: true,
        serial: true,
        um: { select: { nome: true, project: { select: { nome: true, cor: true } } } },
      },
    }),
  ]);

  return {
    conferencesToday,
    conferencesWithMissing,
    notebooksInMaintenance,
    notebooksTotal,
    activeTechnicians,
    latestConferences,
    maintenanceNotebooks,
  };
}


/**
 * [início, fim) do dia em America/Sao_Paulo que contém `now`.
 * ponytail: offset fixo -03:00 (Brasil sem horário de verão desde 2019);
 * se o DST voltar, trocar por cálculo de offset via Intl.
 */
export function saoPauloDayRange(now: Date): { gte: Date; lt: Date } {
  const d = archiveDateStamp(now); // YYYYMMDD em SP
  const gte = new Date(`${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6)}T00:00:00-03:00`);
  return { gte, lt: new Date(gte.getTime() + 86_400_000) };
}

/** Leituras (ESCANEADO) do dia em conferências das UMs informadas. */
export async function getItinerantReadsToday(umIds: string[], now = new Date()) {
  return prisma.conferenceItem.findMany({
    where: {
      status: "ESCANEADO",
      conference: { umId: { in: umIds }, dataInicio: saoPauloDayRange(now) },
    },
    select: { notebookId: true, conference: { select: { umId: true, userId: true } } },
  });
}

/** Leituras por notebook necessárias para cobertura do dia (abertura + fechamento). */
export const LEITURAS_COBERTURA = 2;

export interface CoverageNotebook {
  id: string;
  hostname: string;
  categoria: Categoria | null;
}

/** Pura: cobertos = notebooks com >= 2 leituras no dia; pendentes com a contagem. */
export function computeCoverage(notebooks: CoverageNotebook[], readNotebookIds: string[]) {
  const leituras = new Map<string, number>();
  for (const id of readNotebookIds) leituras.set(id, (leituras.get(id) ?? 0) + 1);
  const pendentes = notebooks
    .map((n) => ({ ...n, leituras: leituras.get(n.id) ?? 0 }))
    .filter((n) => n.leituras < LEITURAS_COBERTURA);
  return { total: notebooks.length, cobertos: notebooks.length - pendentes.length, pendentes };
}

/** Cobertura do dia de cada UM ITINERANTE (só notebooks ATIVO; MANUTENCAO não conta). */
export async function getItinerantCoverage(now = new Date(), umIds?: string[]) {
  const ums = await prisma.uM.findMany({
    where: { tipo: "ITINERANTE", ...(umIds && { id: { in: umIds } }) },
    orderBy: [{ project: { nome: "asc" } }, { nome: "asc" }],
    select: {
      id: true,
      nome: true,
      project: { select: { nome: true, cor: true } },
      notebooks: {
        where: { status: "ATIVO" },
        orderBy: { hostname: "asc" },
        select: { id: true, hostname: true, categoria: true },
      },
    },
  });
  if (!ums.length) return [];
  const reads = await getItinerantReadsToday(ums.map((u) => u.id), now);
  return ums.map(({ notebooks, ...um }) => ({
    ...um,
    ...computeCoverage(
      notebooks,
      reads.filter((r) => r.conference.umId === um.id).map((r) => r.notebookId),
    ),
  }));
}
