import { prisma } from "@/lib/db/prisma";

export async function getDashboardStats() {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [
    conferencesToday,
    conferencesWithMissing,
    notebooksInMaintenance,
    activeTechnicians,
    latestConferences,
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
  ]);

  return {
    conferencesToday,
    conferencesWithMissing,
    notebooksInMaintenance,
    activeTechnicians,
    latestConferences,
  };
}
