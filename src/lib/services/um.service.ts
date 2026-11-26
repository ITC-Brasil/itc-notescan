// Formato da UM devolvido pela API (lista, criação e edição).
export const UM_INCLUDE = {
  project: { select: { id: true, nome: true, cor: true } },
  _count: { select: { notebooks: { where: { status: { not: "ARQUIVADO" as const } } } } },
};
