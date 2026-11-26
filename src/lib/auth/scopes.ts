// m8-01: escopos independentes — nenhum implica outro. Sem imports: a página
// de agentes (cliente) usa isto sem puxar o Prisma para o bundle.
export const SCOPES = ["read:catalog", "write:catalog", "delete:catalog", "destructive"] as const;
export type Scope = (typeof SCOPES)[number];

export const SCOPE_INFO: Record<Scope, { label: string; descricao: string }> = {
  "read:catalog": {
    label: "Leitura do catálogo",
    descricao: "Lê projetos, UMs, notebooks e o histórico de cada notebook.",
  },
  "write:catalog": {
    label: "Escrita no catálogo",
    descricao: "Cadastra e edita projetos, UMs e notebooks (inclusive em lote e por CSV).",
  },
  "delete:catalog": {
    label: "Exclusão simples",
    descricao: "Arquiva notebooks um a um.",
  },
  destructive: {
    label: "Operações destrutivas",
    descricao:
      "Junto com a exclusão simples, libera excluir UMs e projetos e arquivar todos os notebooks de uma UM.",
  },
};

export type TokenSituacao = "ativo" | "expirado" | "revogado" | "nenhum";
