import { readFileSync } from "fs";
import { join } from "path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { db, auth } = vi.hoisted(() => ({
  db: { apiToken: { findUnique: vi.fn(), update: vi.fn() } },
  auth: vi.fn(),
}));
vi.mock("@/lib/db/prisma", () => ({ prisma: db }));
vi.mock("@/lib/auth", () => ({ auth }));

import { GET } from "@/app/api/agents/guide/route";
import { SCOPES } from "@/lib/auth/scopes";
import { ACTOR_LIMITS } from "@/lib/rate-limit";
import { ALL_SCOPES, invalidTokens, tokenRecord, withBearer } from "./helpers/actor";

const guide = readFileSync(join(process.cwd(), "docs", "AGENT-API.md"), "utf-8");

// O guia é colado nas instruções de agentes: não pode divergir do código.
describe("docs/AGENT-API.md", () => {
  it("documenta todos os escopos", () => {
    for (const s of SCOPES) expect(guide).toContain(`\`${s}\``);
  });

  it("limites batem com ACTOR_LIMITS do token", () => {
    expect(guide).toContain(`| Leitura (GET) | ${ACTOR_LIMITS.token.read} por minuto |`);
    expect(guide).toContain(`| Escrita e exclusão | ${ACTOR_LIMITS.token.write} por minuto |`);
  });

  it.each([
    "GET /projects",
    "GET /ums",
    "GET /notebooks",
    "GET /notebooks/{id}/history",
    "POST /projects",
    "PUT /projects/{id}",
    "POST /ums",
    "PUT /ums/{id}",
    "POST /notebooks",
    "POST /notebooks/batch",
    "POST /notebooks/import",
    "PUT /notebooks/{id}",
    "DELETE /notebooks/{id}",
    "POST /notebooks/bulk-delete",
    "DELETE /ums/{id}",
    "DELETE /projects/{id}",
  ])("documenta %s", (route) => {
    expect(guide).toContain(`\`${route}\``);
  });

  it("token só por variável de ambiente; nenhum token real", () => {
    expect(guide).toContain("Bearer $NOTESCAN_TOKEN");
    expect(guide).not.toMatch(/nsk_[A-Za-z0-9_-]{20,}/);
    expect(guide).not.toMatch(/[?&]token=/i);
  });

  it("ensina o agente a ler o próprio guia", () => {
    expect(guide).toContain('curl -s "$NOTESCAN_URL/agents/guide" -H "Authorization: Bearer $NOTESCAN_TOKEN"');
  });
});

describe("GET /api/agents/guide", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.mockResolvedValue({ user: { id: "m1", role: "MASTER" } });
  });

  it("MASTER recebe o guia em text/plain, no-store", async () => {
    const res = await GET(new Request("http://x/api/agents/guide"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.text()).toBe(guide);
  });

  it("ADMIN e USER → 403; sem sessão → 401", async () => {
    for (const role of ["ADMIN", "USER"]) {
      auth.mockResolvedValue({ user: { id: `h-${role}`, role } });
      expect((await GET(new Request("http://x/api/agents/guide"))).status).toBe(403);
    }
    auth.mockResolvedValue(null);
    expect((await GET(new Request("http://x/api/agents/guide"))).status).toBe(401);
  });

  it.each([[["read:catalog"]], [["destructive"]], [ALL_SCOPES]] as const)(
    "token com escopos %j lê o guia, sem consultar a sessão",
    async (scopes) => {
      db.apiToken.findUnique.mockResolvedValue(tokenRecord([...scopes]));
      const res = await GET(withBearer("http://x/api/agents/guide"));
      expect(res.status).toBe(200);
      expect(await res.text()).toBe(guide);
      expect(auth).not.toHaveBeenCalled();
    },
  );

  it.each(Object.entries(invalidTokens))("token %s → 401", async (_k, rec) => {
    db.apiToken.findUnique.mockResolvedValue(rec === null ? null : rec());
    auth.mockResolvedValue({ user: { id: "m1", role: "MASTER" } }); // nunca cai no cookie
    expect((await GET(withBearer("http://x/api/agents/guide"))).status).toBe(401);
  });

  it("token de agente desativado → 401", async () => {
    db.apiToken.findUnique.mockResolvedValue(
      tokenRecord(ALL_SCOPES, { user: { role: "AGENTE", desativadoEm: new Date() } }),
    );
    expect((await GET(withBearer("http://x/api/agents/guide"))).status).toBe(401);
  });

});
