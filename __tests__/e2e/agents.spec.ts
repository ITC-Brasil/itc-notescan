import { test, expect, request as pwRequest, type APIRequestContext } from "@playwright/test";
import { loginAs } from "./helpers/auth";

// m8-01 Etapa 1: fluxo real de agente, sem curl. Só desktop: a gestão é MASTER/desktop.
test.beforeEach(({}, info) => test.skip(info.project.name !== "chromium", "só chromium"));

const BASE = "http://localhost:3001";

// AuditLog direto no banco de teste: a API não expõe a trilha.
async function auditCount(projectId: string, umId: string) {
  const { Pool } = await import("pg");
  const { TEST_DB_URL } = await import("./setup/db");
  const pool = new Pool({ connectionString: TEST_DB_URL });
  try {
    const q = (id: string) =>
      pool.query('SELECT count(*)::int AS n FROM "AuditLog" WHERE "entidadeId" = $1 AND "tokenId" IS NOT NULL', [id]);
    return { project: (await q(projectId)).rows[0].n, um: (await q(umId)).rows[0].n };
  } finally {
    await pool.end();
  }
}

// Contexto sem cookies: o agente só tem o Bearer.
async function agentApi(token: string): Promise<APIRequestContext> {
  return pwRequest.newContext({ baseURL: BASE, extraHTTPHeaders: { authorization: `Bearer ${token}` } });
}

test.describe("Agentes — API", () => {
  test("MASTER cria agente e emite token; token lê catálogo, é recusado fora do alcance e morre ao revogar", async ({
    page,
  }) => {
    await loginAs(page, "master");
    const master = page.request;

    const created = await master.post("/api/agents", { data: { nome: "E2E Bot API", descricao: "e2e" } });
    expect(created.status()).toBe(201);
    const { id } = (await created.json()) as { id: string };

    const issued = await master.post(`/api/agents/${id}/token`, { data: { scopes: ["read:catalog"] } });
    expect(issued.status()).toBe(201);
    expect(issued.headers()["cache-control"]).toBe("no-store");
    const { token } = (await issued.json()) as { token: string };
    expect(token).toMatch(/^nsk_/);

    const agent = await agentApi(token);
    for (const path of ["/api/projects", "/api/ums", "/api/notebooks"])
      expect((await agent.get(path)).status(), path).toBe(200);

    // Só leitura: escrita no catálogo → 403.
    expect((await agent.post("/api/projects", { data: { nome: "X", cor: "#000000" } })).status()).toBe(403);

    // Fora do alcance de agentes: 403 explícito.
    expect((await agent.get("/api/conferences")).status()).toBe(403);
    expect((await agent.post("/api/conferences", { data: {} })).status()).toBe(403);
    expect((await agent.get("/api/users")).status()).toBe(403);
    expect((await agent.get("/api/agents")).status()).toBe(403);
    expect((await agent.post(`/api/agents/${id}/token`, { data: { scopes: ["destructive"] } })).status()).toBe(403);

    // A lista do MASTER mostra o token só pelo prefixo.
    const list = (await (await master.get("/api/agents")).json()) as {
      id: string;
      situacao: string;
      token: Record<string, unknown>;
    }[];
    const row = list.find((a) => a.id === id)!;
    expect(row.situacao).toBe("ativo");
    expect(JSON.stringify(row)).not.toContain(token);
    expect(row.token).not.toHaveProperty("tokenHash");

    // Reemitir com write:catalog revoga o anterior; o novo escreve, e a escrita é auditada.
    const reissued = await master.post(`/api/agents/${id}/token`, {
      data: { scopes: ["read:catalog", "write:catalog"] },
    });
    const { token: token2 } = (await reissued.json()) as { token: string };
    expect((await agent.get("/api/projects")).status()).toBe(401);
    const agent2 = await agentApi(token2);
    expect((await agent2.get("/api/projects")).status()).toBe(200);

    const createdProject = await agent2.post("/api/projects", { data: { nome: "E2E Agente", cor: "#123456" } });
    expect(createdProject.status()).toBe(201);
    const { id: projectId } = (await createdProject.json()) as { id: string };
    const createdUm = await agent2.post("/api/ums", {
      data: { nome: "E2E UM Agente", projectId, quantidadeEsperada: 1 },
    });
    expect(createdUm.status()).toBe(201);
    const { id: umId } = (await createdUm.json()) as { id: string };
    expect((await agent2.put(`/api/projects/${projectId}`, { data: { nome: "E2E Agente 2", cor: "#123456" } })).status()).toBe(200);
    expect((await agent2.post("/api/notebooks", { data: { hostname: "E2E-AG01", umId } })).status()).toBe(201);
    expect(await auditCount(projectId, umId)).toEqual({ project: 2, um: 1 });

    const emptyProject = await agent2.post("/api/projects", { data: { nome: "E2E Vazio", cor: "#654321" } });
    const { id: emptyProjectId } = (await emptyProject.json()) as { id: string };
    const { id: nbId } = (await (await agent2.get(`/api/notebooks?umId=${umId}`)).json())[0] as { id: string };

    // Sem delete:catalog, nenhuma exclusão.
    expect((await agent2.delete(`/api/notebooks/${nbId}`)).status()).toBe(403);
    expect((await agent2.delete(`/api/projects/${emptyProjectId}`)).status()).toBe(403);

    // 3c: delete:catalog arquiva notebook, mas não libera as destrutivas.
    const t3 = await master.post(`/api/agents/${id}/token`, { data: { scopes: ["delete:catalog"] } });
    const agent3 = await agentApi(((await t3.json()) as { token: string }).token);
    expect((await agent3.delete(`/api/notebooks/${nbId}`)).status()).toBe(200);
    expect((await agent3.post("/api/notebooks/bulk-delete", { data: { umId } })).status()).toBe(403);
    expect((await agent3.delete(`/api/ums/${umId}`)).status()).toBe(403);
    expect((await agent3.delete(`/api/projects/${emptyProjectId}`)).status()).toBe(403);

    // 3d: delete:catalog + destructive.
    const t4 = await master.post(`/api/agents/${id}/token`, {
      data: { scopes: ["read:catalog", "delete:catalog", "destructive"] },
    });
    const { token: token4 } = (await t4.json()) as { token: string };
    const agent4 = await agentApi(token4);
    expect((await agent4.post("/api/notebooks/bulk-delete", { data: { umId } })).status()).toBe(200);
    // Projeto com UM → 409: a regra de negócio vale para agente também.
    expect((await agent4.delete(`/api/projects/${projectId}`)).status()).toBe(409);
    // O notebook arquivado não tinha conferência: o bulk-delete o remove e a UM fica vazia.
    expect((await agent4.delete(`/api/ums/${umId}`)).status()).toBe(204);
    expect((await agent4.delete(`/api/projects/${projectId}`)).status()).toBe(204);
    expect((await agent4.delete(`/api/projects/${emptyProjectId}`)).status()).toBe(204);
    // CRIADO + EXCLUIDO, todos por token.
    expect(await auditCount(emptyProjectId, umId)).toEqual({ project: 2, um: 2 });
    await agent3.dispose();

    // Revogar → 401.
    expect((await agent4.get("/api/projects")).status()).toBe(200);
    expect((await master.delete(`/api/agents/${id}/token`)).status()).toBe(204);
    expect((await agent4.get("/api/projects")).status()).toBe(401);
    await agent4.dispose();

    // Agente que agiu não pode ser excluído: a saída é desativar.
    expect((await master.delete(`/api/agents/${id}`)).status()).toBe(409);

    // Desativar revoga o token ativo e impede emitir; reativar não devolve o token.
    const t5 = await master.post(`/api/agents/${id}/token`, { data: { scopes: ["read:catalog"] } });
    const agent5 = await agentApi(((await t5.json()) as { token: string }).token);
    expect((await agent5.get("/api/projects")).status()).toBe(200);
    expect((await master.post(`/api/agents/${id}/deactivate`)).status()).toBe(204);
    expect((await agent5.get("/api/projects")).status()).toBe(401);
    const ids = async (q = "") =>
      ((await (await master.get(`/api/agents${q}`)).json()) as { id: string }[]).map((a) => a.id);
    expect(await ids()).not.toContain(id);
    expect(await ids("?includeInactive=1")).toContain(id);
    expect((await master.post(`/api/agents/${id}/token`, { data: { scopes: ["read:catalog"] } })).status()).toBe(409);
    expect((await master.post(`/api/agents/${id}/reactivate`)).status()).toBe(204);
    expect((await agent5.get("/api/projects")).status()).toBe(401);
    expect(await ids()).toContain(id);
    await agent5.dispose();

    // Token emitido e nunca usado não é histórico: o agente é excluído com o token.
    const unused = await master.post("/api/agents", { data: { nome: "E2E Bot Sem Uso" } });
    const { id: unusedId } = (await unused.json()) as { id: string };
    await master.post(`/api/agents/${unusedId}/token`, { data: { scopes: ["read:catalog"] } });
    expect((await master.delete(`/api/agents/${unusedId}`)).status()).toBe(204);
    expect(await ids("?includeInactive=1")).not.toContain(unusedId);

    // /api/users não lista nem cria agentes.
    const users = (await (await master.get("/api/users")).json()) as { role: string }[];
    expect(users.some((u) => u.role === "AGENTE")).toBe(false);
    expect((await master.post("/api/users", { data: { role: "AGENTE", nome: "Bot" } })).status()).toBe(400);

    await agent.dispose();
    await agent2.dispose();
  });

  test("ADMIN não gerencia agentes", async ({ page }) => {
    await loginAs(page, "admin");
    expect((await page.request.get("/api/agents")).status()).toBe(403);
    await page.goto("/agentes");
    await page.waitForURL("**/inicio");
  });
});

test.describe("Agentes — página MCP e Agentes", () => {
  test("MASTER cria agente, emite token, vê o valor uma vez e o prefixo na lista", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await loginAs(page, "master");
    await page.getByRole("link", { name: "MCP e Agentes" }).click();
    await page.waitForURL("**/agentes");

    await page.getByRole("button", { name: "Novo agente" }).first().click();
    await page.getByLabel("Nome").fill("E2E Bot UI");
    await page.getByLabel("Descrição").fill("Criado pela página");
    await page.getByRole("button", { name: "Criar agente" }).click();
    const row = page.getByRole("row", { name: /E2E Bot UI/ });
    await expect(row).toContainText("Sem token");

    await row.getByRole("button", { name: "Emitir token" }).click();
    await page.getByLabel(/Escrita no catálogo/).check();
    await page.getByLabel(/Operações destrutivas/).check();
    await expect(page.getByRole("alert")).toContainText("excluir UMs");
    await page.getByLabel(/Operações destrutivas/).uncheck();
    await expect(page.getByRole("alert")).toHaveCount(0);
    await page.getByRole("button", { name: "Emitir token" }).click();

    const value = await page.getByLabel("Token", { exact: true }).inputValue();
    expect(value).toMatch(/^nsk_/);
    await page.getByRole("button", { name: "Copiar token" }).click();
    await expect(page.getByText("Token copiado.")).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(value);
    await page.screenshot({ path: "test-results/agentes-token.png" });
    await page.getByRole("button", { name: "Já copiei, fechar" }).click();

    await expect(row).toContainText("Ativo");
    await expect(page.getByText(value)).toHaveCount(0);

    // Token emitido e não usado: sem histórico, a ação é "Excluir".
    await expect(row.getByRole("button", { name: "Excluir agente" })).toBeVisible();
    await expect(row.getByRole("button", { name: "Desativar agente" })).toHaveCount(0);
    await expect(row).toContainText(value.slice(0, 12));
    expect(await page.content()).not.toContain(value);

    // Agente que agiu (teste de API): "Desativar", com tooltip.
    const used = page.getByRole("row", { name: /E2E Bot API/ });
    const deactivate = used.getByRole("button", { name: "Desativar agente" });
    await deactivate.hover();
    await expect(page.getByRole("tooltip", { name: "Desativar agente" })).toBeVisible();
    await expect(used.getByRole("button", { name: "Excluir agente" })).toHaveCount(0);
    await deactivate.click();
    await page.getByRole("button", { name: "Desativar", exact: true }).click();
    await expect(page.getByText("Agente desativado.")).toBeVisible();
    await expect(used).toHaveCount(0);

    await page.getByLabel("Mostrar desativados").check();
    await expect(used).toContainText("Desativado");
    await expect(used.getByRole("button", { name: "Emitir token" })).toHaveCount(0);
    await used.getByRole("button", { name: "Reativar" }).click();
    await expect(page.getByText(/Agente reativado/)).toBeVisible();
    await expect(used).not.toContainText("Desativado");

    // Exclusão do agente sem histórico (token não usado vai junto).
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await row.getByRole("button", { name: "Excluir agente" }).click();
    await page.getByRole("button", { name: "Excluir", exact: true }).click();
    await expect(page.getByText("Agente excluído.")).toBeVisible();
    await expect(row).toHaveCount(0);
    await page.screenshot({ path: "test-results/agentes-lista.png" });
  });

  test("Como conectar: URL base, guia só para MASTER e instruções sem token", async ({ page }) => {
    await loginAs(page, "master");
    await page.goto("/agentes");
    await page.getByRole("tab", { name: "Como conectar" }).click();

    await expect(page.getByLabel("URL base da API")).toHaveValue(`${BASE}/api`);
    const instructions = page.getByLabel("Instruções para o agente");
    await expect(instructions).toContainText("export NOTESCAN_TOKEN=<cole o token>");
    await expect(instructions).toContainText(`URL base: ${BASE}/api`);
    expect(await page.content()).not.toMatch(/nsk_[A-Za-z0-9_-]{20,}/);
    await expect(page.getByRole("link", { name: "Abrir guia" })).toHaveAttribute("href", "/api/agents/guide");

    const guide = await page.request.get("/api/agents/guide");
    expect(guide.status()).toBe(200);
    expect(guide.headers()["content-type"]).toContain("text/plain");
    expect(await guide.text()).toContain("# NoteScan — Guia da API para agentes");
    await page.screenshot({ path: "test-results/agentes-conectar.png", fullPage: true });
  });
});
