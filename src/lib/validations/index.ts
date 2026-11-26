import { z } from "zod";
import { SCOPES } from "@/lib/auth/scopes";
import { isReservedHostname } from "@/lib/notebook-hostname";

// Sufixo ~arq-YYYYMMDD é reservado ao arquivamento.
const hostnameSchema = z
  .string()
  .min(1)
  .max(100)
  .refine((h) => !isReservedHostname(h), "Hostname usa o sufixo reservado ~arq-");

const onArchivedSchema = z.enum(["reactivate", "new"]).optional();
const onArchivedBulkSchema = z.enum(["skip", "reactivate", "new"]).default("skip");

export const conferenceItemSchema = z.object({
  notebookId: z.string().min(1),
  status: z.enum(["ESCANEADO", "FALTANTE", "MANUTENCAO"]),
});

export const createConferenceSchema = z.object({
  umId: z.string().min(1),
  dataInicio: z.string().datetime(),
  dataFim: z.string().datetime(),
  localizacao: z.string().optional(),
  status: z.enum(["CONCLUIDO_OK", "CONCLUIDO_FALTANTES"]),
  mousesQtd: z.number().int().min(0).optional(),
  carregadoresQtd: z.number().int().min(0).optional(),
  fonesQtd: z.number().int().min(0).optional(),
  items: z.array(conferenceItemSchema).min(1),
});

export const createNotebookSchema = z.object({
  hostname: hostnameSchema,
  serial: z.string().optional(),
  patrimonio: z.string().optional(),
  status: z.enum(["ATIVO", "MANUTENCAO"]).default("ATIVO"),
  umId: z.string().min(1),
  onArchived: onArchivedSchema,
});

export const createNotebooksBatchSchema = z.object({
  prefix: z
    .string()
    .min(1)
    .max(50)
    .refine((p) => !p.includes("~arq-"), "Prefixo usa o sufixo reservado ~arq-"),
  start: z.number().int().min(1),
  end: z.number().int().min(1),
  umId: z.string().min(1),
  status: z.enum(["ATIVO", "MANUTENCAO"]).default("ATIVO"),
  onArchived: onArchivedBulkSchema,
});

export const updateNotebookSchema = z.object({
  hostname: hostnameSchema,
  serial: z.string().optional(),
  patrimonio: z.string().optional(),
  status: z.enum(["ATIVO", "MANUTENCAO"]),
  umId: z.string().min(1),
});

export const importNotebooksSchema = z.object({
  umId: z.string().min(1),
  rows: z.array(
    z.object({
      hostname: hostnameSchema,
      serial: z.string().optional(),
      patrimonio: z.string().optional(),
    }),
  ).min(1),
  onArchived: onArchivedBulkSchema,
});

export const createProjectSchema = z.object({
  nome: z.string().min(1).max(100),
  cor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Cor deve ser um hex válido"),
});

export const createUMSchema = z.object({
  nome: z.string().min(1).max(100),
  projectId: z.string().min(1),
  quantidadeEsperada: z.number().int().min(1),
  perifericos: z.boolean().default(false),
  mouses: z.boolean().default(false),
  carregadores: z.boolean().default(false),
  fones: z.boolean().default(false),
});

export const createUserSchema = z.object({
  nome: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(["USER", "ADMIN", "MASTER"]).default("USER"),
  metaDiaria: z.number().int().min(1).default(2),
});

// AGENTE: sem senha, sem meta e sem e-mail informado (gerado pela API).
// strict: password/metaDiaria/email/role enviados → 400.
export const createAgentSchema = z
  .object({
    nome: z.string().trim().min(2).max(100),
    descricao: z.string().trim().max(500).optional(),
  })
  .strict();

export const updateAgentSchema = createAgentSchema.partial().strict();

export const issueTokenSchema = z
  .object({ scopes: z.array(z.enum(SCOPES)).min(1).transform((s) => [...new Set(s)]) })
  .strict();

export type CreateAgentInput = z.infer<typeof createAgentSchema>;
export type UpdateAgentInput = z.infer<typeof updateAgentSchema>;

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export type UpdateNotebookInput = z.infer<typeof updateNotebookSchema>;
export type ImportNotebooksInput = z.input<typeof importNotebooksSchema>;
export type CreateConferenceInput = z.infer<typeof createConferenceSchema>;
export type CreateNotebookInput = z.input<typeof createNotebookSchema>;
export type CreateNotebooksBatchInput = z.input<typeof createNotebooksBatchSchema>;
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type CreateUMInput = z.infer<typeof createUMSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
