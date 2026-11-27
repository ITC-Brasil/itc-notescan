// Funções puras da meta por categoria (UM itinerante) — usadas no cliente e no servidor.
import { CATEGORIA_LABEL } from "@/lib/constants";
import type { Categoria } from "@/lib/validations";

export interface MetaCategoria {
  categoria: Categoria;
  meta: number;
}

export interface ProgressoCategoria extends MetaCategoria {
  lidos: number;
  falta: number;
}

/** Lidos e falta por categoria. Na itinerante o faltante é a diferença, não um notebook. */
export function progressoPorCategoria(
  metas: MetaCategoria[],
  categoriasLidas: (Categoria | null | undefined)[],
): ProgressoCategoria[] {
  return metas
    .filter((m) => m.meta > 0)
    .map((m) => {
      const lidos = categoriasLidas.filter((c) => c === m.categoria).length;
      return { categoria: m.categoria, meta: m.meta, lidos, falta: Math.max(0, m.meta - lidos) };
    });
}

export function statusPorMeta(progresso: ProgressoCategoria[]): "CONCLUIDO_OK" | "CONCLUIDO_FALTANTES" {
  return progresso.every((p) => p.falta === 0) ? "CONCLUIDO_OK" : "CONCLUIDO_FALTANTES";
}

/** "Instrutores 4/5" — o "falta N" vai à parte (coluna de detalhe / sufixo). */
export const rotuloProgresso = (p: ProgressoCategoria) => `${CATEGORIA_LABEL[p.categoria]} ${p.lidos}/${p.meta}`;

interface ConferenceLike {
  items: { status: string; notebook: { hostname: string; categoria?: Categoria | null } }[];
  metas?: MetaCategoria[];
}

type ItemResumo = { id: string; hostname: string; detail?: string };

/**
 * Contagens do resumo para UM fixa e itinerante, no mesmo formato. Fixa: faltante
 * = item FALTANTE. Itinerante (tem metas): faltante = soma do que falta por
 * categoria, e a lista de faltantes traz uma linha por categoria incompleta.
 */

export function conferenceCounts(c: ConferenceLike): {
  escaneados: number;
  faltantes: number;
  manutencao: number;
  ativos: number;
  faltantesList: ItemResumo[];
  manutencaoList: ItemResumo[];
} {
  const escaneados = c.items.filter((i) => i.status === "ESCANEADO");
  const manutencao = c.items.filter((i) => i.status === "MANUTENCAO");
  const manutencaoList = manutencao.map((it, i) => ({ id: String(i), hostname: it.notebook.hostname }));
  if (c.metas?.length) {
    const progresso = progressoPorCategoria(c.metas, escaneados.map((i) => i.notebook.categoria));
    const faltantes = progresso.reduce((a, p) => a + p.falta, 0);
    return {
      escaneados: escaneados.length,
      faltantes,
      manutencao: manutencao.length,
      ativos: progresso.reduce((a, p) => a + p.meta, 0),
      faltantesList: progresso
        .filter((p) => p.falta > 0)
        .map((p) => ({ id: p.categoria, hostname: rotuloProgresso(p), detail: `falta ${p.falta}` })),
      manutencaoList,
    };
  }
  const faltantes = c.items.filter((i) => i.status === "FALTANTE");
  return {
    escaneados: escaneados.length,
    faltantes: faltantes.length,
    manutencao: manutencao.length,
    ativos: escaneados.length + faltantes.length,
    faltantesList: faltantes.map((it, i) => ({ id: String(i), hostname: it.notebook.hostname })),
    manutencaoList,
  };
}
