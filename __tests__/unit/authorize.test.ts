import { beforeEach, describe, expect, it, vi } from "vitest";

const { findUnique, compare } = vi.hoisted(() => ({
  findUnique: vi.fn(),
  compare: vi.fn(),
}));

vi.mock("next-auth", () => ({ default: () => ({}) }));
vi.mock("next-auth/providers/credentials", () => ({ default: (c: unknown) => c }));
vi.mock("@auth/prisma-adapter", () => ({ PrismaAdapter: () => ({}) }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { user: { findUnique } } }));
vi.mock("bcrypt", () => ({ default: { compare } }));

import { authorizeCredentials } from "@/lib/auth";

const creds = { email: "a@itc.com", password: "secret123" };
const dbUser = (role: string, passwordHash: string | null = "hash") => ({
  id: "u1",
  email: creds.email,
  nome: "Fulano",
  passwordHash,
  role,
  metaDiaria: 2,
});

describe("authorizeCredentials", () => {
  beforeEach(() => {
    findUnique.mockReset();
    compare.mockReset().mockResolvedValue(true);
  });

  it.each(["USER", "ADMIN", "MASTER"])("aceita role humana %s", async (role) => {
    findUnique.mockResolvedValue(dbUser(role));
    await expect(authorizeCredentials(creds)).resolves.toMatchObject({ id: "u1", role });
  });

  it("recusa role não humana (AGENTE) mesmo com senha correta", async () => {
    findUnique.mockResolvedValue(dbUser("AGENTE"));
    await expect(authorizeCredentials(creds)).resolves.toBeNull();
  });

  it("recusa AGENTE sem senha sem chamar o bcrypt", async () => {
    findUnique.mockResolvedValue(dbUser("AGENTE", null));
    await expect(authorizeCredentials(creds)).resolves.toBeNull();
    expect(compare).not.toHaveBeenCalled();
  });

  it("recusa role não humana sem chamar o bcrypt", async () => {
    findUnique.mockResolvedValue(dbUser("AGENTE"));
    await authorizeCredentials(creds);
    expect(compare).not.toHaveBeenCalled();
  });

  it("recusa usuário humano sem hash sem lançar", async () => {
    findUnique.mockResolvedValue(dbUser("USER", null));
    await expect(authorizeCredentials(creds)).resolves.toBeNull();
  });

  it("recusa senha inválida", async () => {
    findUnique.mockResolvedValue(dbUser("USER"));
    compare.mockResolvedValue(false);
    await expect(authorizeCredentials(creds)).resolves.toBeNull();
  });
});
