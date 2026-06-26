import { prisma } from "@/lib/db/prisma";

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
    prisma.notebook.count(),
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
      include: {
        user: { select: { id: true, nome: true } },
        um: {
          select: {
            id: true,
            nome: true,
            project: { select: { id: true, nome: true, cor: true } },
          },
        },
        _count: { select: { items: true } },
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
