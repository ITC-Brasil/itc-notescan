import { describe, it, expect } from "vitest";
import {
  createConferenceSchema,
  createNotebookSchema,
  createProjectSchema,
  createUMSchema,
  loginSchema,
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
