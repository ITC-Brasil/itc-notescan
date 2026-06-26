import { z } from "zod";

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
  items: z.array(conferenceItemSchema).min(1),
});

export const createNotebookSchema = z.object({
  hostname: z.string().min(1).max(100),
  serial: z.string().optional(),
  patrimonio: z.string().optional(),
  status: z.enum(["ATIVO", "MANUTENCAO"]).default("ATIVO"),
  umId: z.string().min(1),
});

export const createNotebooksBatchSchema = z.object({
  prefix: z.string().min(1).max(50),
  start: z.number().int().min(1),
  end: z.number().int().min(1),
  umId: z.string().min(1),
  status: z.enum(["ATIVO", "MANUTENCAO"]).default("ATIVO"),
});

export const updateNotebookSchema = z.object({
  hostname: z.string().min(1).max(100),
  serial: z.string().optional(),
  patrimonio: z.string().optional(),
  status: z.enum(["ATIVO", "MANUTENCAO"]),
  umId: z.string().min(1),
});

export const importNotebooksSchema = z.object({
  umId: z.string().min(1),
  rows: z.array(
    z.object({
      hostname: z.string().min(1).max(100),
      serial: z.string().optional(),
      patrimonio: z.string().optional(),
    }),
  ).min(1),
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

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export type UpdateNotebookInput = z.infer<typeof updateNotebookSchema>;
export type ImportNotebooksInput = z.infer<typeof importNotebooksSchema>;
export type CreateConferenceInput = z.infer<typeof createConferenceSchema>;
export type CreateNotebookInput = z.infer<typeof createNotebookSchema>;
export type CreateNotebooksBatchInput = z.infer<typeof createNotebooksBatchSchema>;
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type CreateUMInput = z.infer<typeof createUMSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
