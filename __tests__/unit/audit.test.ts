import { describe, expect, it, vi } from "vitest";
import { audit } from "@/lib/services/audit.service";

describe("audit", () => {
  const tx = () => ({ auditLog: { create: vi.fn() } });

  it("ator token grava tokenId", async () => {
    const t = tx();
    await audit(t as never, { kind: "token", userId: "ag1", role: "AGENTE", tokenId: "tok1", scopes: [] }, {
      entidade: "Project",
      entidadeId: "p1",
      acao: "CRIADO",
    });
    expect(t.auditLog.create.mock.calls[0][0].data).toMatchObject({ actorId: "ag1", tokenId: "tok1" });
  });

  it("sessão humana grava tokenId null", async () => {
    const t = tx();
    await audit(t as never, { kind: "session", userId: "m1", role: "MASTER" }, {
      entidade: "Project",
      entidadeId: "p1",
      acao: "CRIADO",
    });
    expect(t.auditLog.create.mock.calls[0][0].data).toMatchObject({ actorId: "m1", tokenId: null });
  });
});
