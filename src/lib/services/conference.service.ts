import { prisma } from "@/lib/db/prisma";
import type { CreateConferenceInput } from "@/lib/validations";

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
