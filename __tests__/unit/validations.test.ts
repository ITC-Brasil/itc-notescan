import { describe, it, expect } from "vitest";
import {
  createConferenceSchema,
  createNotebookSchema,
  createNotebooksBatchSchema,
  createProjectSchema,
  createUMSchema,
  createUserSchema,
  importNotebooksSchema,
  loginSchema,
  updateNotebookSchema,
} from "@/lib/validations";

describe("createConferenceSchema", () => {
  const validConference = {
    umId: "cm123",
    dataInicio: "2026-06-22T08:00:00.000Z",
    dataFim: "2026-06-22T09:00:00.000Z",
    status: "CONCLUIDO_OK" as const,
    items: [{ notebookId: "nb1", status: "ESCANEADO" as const }],
  };

  it("accepts a valid conference payload", () => {
    const result = createConferenceSchema.safeParse(validConference);
    expect(result.success).toBe(true);
  });

  it("requires at least one item", () => {
    const result = createConferenceSchema.safeParse({ ...validConference, items: [] });
    expect(result.success).toBe(false);
  });

  it("rejects invalid status", () => {
    const result = createConferenceSchema.safeParse({ ...validConference, status: "INVALID" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid item status", () => {
    const result = createConferenceSchema.safeParse({
      ...validConference,
      items: [{ notebookId: "nb1", status: "DESCONHECIDO" }],
    });
    expect(result.success).toBe(false);
  });

  it("accepts optional localizacao", () => {
    const result = createConferenceSchema.safeParse({
      ...validConference,
      localizacao: "São Paulo, SP",
    });
    expect(result.success).toBe(true);
  });
});

describe("createNotebookSchema", () => {
  it("accepts a valid notebook", () => {
    const result = createNotebookSchema.safeParse({
      hostname: "BSBIA01-EST01",
      umId: "um123",
    });
    expect(result.success).toBe(true);
  });

  it("requires hostname", () => {
    const result = createNotebookSchema.safeParse({ umId: "um123" });
    expect(result.success).toBe(false);
  });

  it("defaults status to ATIVO", () => {
    const result = createNotebookSchema.safeParse({ hostname: "BSBIA01-EST01", umId: "um123" });
    if (result.success) {
      expect(result.data.status).toBe("ATIVO");
    }
  });
});

describe("createProjectSchema", () => {
  it("accepts valid project with hex color", () => {
    const result = createProjectSchema.safeParse({ nome: "Brasil.IA", cor: "#008F95" });
    expect(result.success).toBe(true);
  });

  it("rejects invalid hex color", () => {
    const result = createProjectSchema.safeParse({ nome: "Brasil.IA", cor: "ciano" });
    expect(result.success).toBe(false);
  });
});

describe("createUMSchema", () => {
  it("accepts a valid UM", () => {
    const result = createUMSchema.safeParse({
      nome: "BSBIA01",
      projectId: "proj1",
      quantidadeEsperada: 106,
    });
    expect(result.success).toBe(true);
  });

  it("requires quantidadeEsperada >= 1", () => {
    const result = createUMSchema.safeParse({
      nome: "BSBIA01",
      projectId: "proj1",
      quantidadeEsperada: 0,
    });
    expect(result.success).toBe(false);
  });
});

describe("loginSchema", () => {
  it("accepts valid credentials", () => {
    const result = loginSchema.safeParse({ email: "user@itc.com", password: "senha123" });
    expect(result.success).toBe(true);
  });

  it("rejects invalid email", () => {
    const result = loginSchema.safeParse({ email: "nao-e-email", password: "senha123" });
    expect(result.success).toBe(false);
  });

  it("rejects empty password", () => {
    const result = loginSchema.safeParse({ email: "user@itc.com", password: "" });
    expect(result.success).toBe(false);
  });
});

describe("createUserSchema", () => {
  const validUser = {
    nome: "João Silva",
    email: "joao@itc.com",
    password: "senha1234",
  };

  it("accepts valid user payload", () => {
    expect(createUserSchema.safeParse(validUser).success).toBe(true);
  });

  it("requires nome with at least 2 characters", () => {
    expect(createUserSchema.safeParse({ ...validUser, nome: "J" }).success).toBe(false);
  });

  it("requires valid email", () => {
    expect(createUserSchema.safeParse({ ...validUser, email: "invalido" }).success).toBe(false);
  });

  it("requires password with at least 8 characters", () => {
    expect(createUserSchema.safeParse({ ...validUser, password: "1234567" }).success).toBe(false);
  });

  it("defaults role to USER", () => {
    const result = createUserSchema.safeParse(validUser);
    if (result.success) expect(result.data.role).toBe("USER");
  });

  it("accepts role ADMIN", () => {
    expect(createUserSchema.safeParse({ ...validUser, role: "ADMIN" }).success).toBe(true);
  });

  // Trava o comportamento atual: AGENTE não é criável via schema (rever na Fase 2).
  it("rejects role AGENTE", () => {
    expect(createUserSchema.safeParse({ ...validUser, role: "AGENTE" }).success).toBe(false);
  });

  it("rejects invalid role", () => {
    expect(createUserSchema.safeParse({ ...validUser, role: "SUPERUSER" }).success).toBe(false);
  });

  it("defaults metaDiaria to 2", () => {
    const result = createUserSchema.safeParse(validUser);
    if (result.success) expect(result.data.metaDiaria).toBe(2);
  });
});

describe("updateNotebookSchema", () => {
  const validUpdate = {
    hostname: "BSBIA01-EST01",
    umId: "um123",
    status: "ATIVO" as const,
  };

  it("accepts valid update payload", () => {
    expect(updateNotebookSchema.safeParse(validUpdate).success).toBe(true);
  });

  it("requires hostname", () => {
    const { hostname: _, ...rest } = validUpdate;
    expect(updateNotebookSchema.safeParse(rest).success).toBe(false);
  });

  it("rejects empty hostname", () => {
    expect(updateNotebookSchema.safeParse({ ...validUpdate, hostname: "" }).success).toBe(false);
  });

  it("rejects invalid status", () => {
    expect(updateNotebookSchema.safeParse({ ...validUpdate, status: "INVALIDO" }).success).toBe(false);
  });

  it("accepts MANUTENCAO status", () => {
    expect(updateNotebookSchema.safeParse({ ...validUpdate, status: "MANUTENCAO" }).success).toBe(true);
  });
});

describe("createNotebooksBatchSchema", () => {
  const validBatch = {
    prefix: "BSBIA01-EST",
    start: 1,
    end: 10,
    umId: "um123",
  };

  it("accepts valid batch payload", () => {
    expect(createNotebooksBatchSchema.safeParse(validBatch).success).toBe(true);
  });

  it("requires prefix", () => {
    const { prefix: _, ...rest } = validBatch;
    expect(createNotebooksBatchSchema.safeParse(rest).success).toBe(false);
  });

  it("requires start >= 1", () => {
    expect(createNotebooksBatchSchema.safeParse({ ...validBatch, start: 0 }).success).toBe(false);
  });

  it("requires end >= 1", () => {
    expect(createNotebooksBatchSchema.safeParse({ ...validBatch, end: 0 }).success).toBe(false);
  });

  it("defaults status to ATIVO", () => {
    const result = createNotebooksBatchSchema.safeParse(validBatch);
    if (result.success) expect(result.data.status).toBe("ATIVO");
  });
});

describe("importNotebooksSchema", () => {
  const validImport = {
    umId: "um123",
    rows: [{ hostname: "BSBIA01-EST01" }],
  };

  it("accepts valid import payload", () => {
    expect(importNotebooksSchema.safeParse(validImport).success).toBe(true);
  });

  it("requires at least one row", () => {
    expect(importNotebooksSchema.safeParse({ ...validImport, rows: [] }).success).toBe(false);
  });

  it("rejects row with empty hostname", () => {
    expect(
      importNotebooksSchema.safeParse({ ...validImport, rows: [{ hostname: "" }] }).success,
    ).toBe(false);
  });

  it("accepts rows with optional serial and patrimonio", () => {
    const result = importNotebooksSchema.safeParse({
      ...validImport,
      rows: [{ hostname: "BSBIA01-EST01", serial: "SN123", patrimonio: "PA456" }],
    });
    expect(result.success).toBe(true);
  });
});

describe("createUMSchema — tipo e metas", () => {
  const base = { nome: "QDFM-PEDAGÓGICO", projectId: "p1", quantidadeEsperada: 24 };

  it("default FIXA sem metas", () => {
    const r = createUMSchema.parse(base);
    expect(r.tipo).toBe("FIXA");
    expect(r.metas).toEqual([]);
  });

  it("ITINERANTE exige pelo menos uma meta > 0", () => {
    expect(createUMSchema.safeParse({ ...base, tipo: "ITINERANTE" }).success).toBe(false);
    expect(
      createUMSchema.safeParse({ ...base, tipo: "ITINERANTE", metas: [{ categoria: "INSTRUTOR", meta: 0 }] }).success,
    ).toBe(false);
    expect(
      createUMSchema.safeParse({
        ...base,
        tipo: "ITINERANTE",
        metas: [{ categoria: "INSTRUTOR", meta: 5 }, { categoria: "PEDAGOGA", meta: 1 }],
      }).success,
    ).toBe(true);
  });

  it("FIXA com meta > 0 é rejeitada", () => {
    expect(
      createUMSchema.safeParse({ ...base, metas: [{ categoria: "PEDAGOGA", meta: 1 }] }).success,
    ).toBe(false);
  });

  it("categoria repetida é rejeitada", () => {
    expect(
      createUMSchema.safeParse({
        ...base,
        tipo: "ITINERANTE",
        metas: [{ categoria: "PEDAGOGA", meta: 1 }, { categoria: "PEDAGOGA", meta: 2 }],
      }).success,
    ).toBe(false);
  });
});
