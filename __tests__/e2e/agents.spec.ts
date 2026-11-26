import { test, expect, request as pwRequest, type APIRequestContext } from "@playwright/test";
import { loginAs } from "./helpers/auth";

// m8-01 Etapa 1: fluxo real de agente, sem curl. Só desktop: a gestão é MASTER/desktop.
test.beforeEach(({}, info) => test.skip(info.project.name !== "chromium", "só chromium"));

const BASE = "http://localhost:3001";

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

    // Escrita ainda não migrada (3b, PR 2): sem cookie, o Bearer não autentica.
    expect((await agent.post("/api/projects", { data: { nome: "X", cor: "#000000" } })).status()).toBe(401);

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

    // Reemitir revoga o anterior.
    const reissued = await master.post(`/api/agents/${id}/token`, { data: { scopes: ["read:catalog"] } });
    const { token: token2 } = (await reissued.json()) as { token: string };
    expect((await agent.get("/api/projects")).status()).toBe(401);
    const agent2 = await agentApi(token2);
    expect((await agent2.get("/api/projects")).status()).toBe(200);

    // Revogar → 401.
    expect((await master.delete(`/api/agents/${id}/token`)).status()).toBe(204);
    expect((await agent2.get("/api/projects")).status()).toBe(401);

    // Agente com histórico não pode ser excluído.
    expect((await master.delete(`/api/agents/${id}`)).status()).toBe(409);

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
    await expect(row).toContainText(value.slice(0, 12));
    await expect(page.getByText(value)).toHaveCount(0);
    expect(await page.content()).not.toContain(value);
    await page.screenshot({ path: "test-results/agentes-lista.png" });
  });
});
