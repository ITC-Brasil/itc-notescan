import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";

test.describe("CRUD de Projetos", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/projetos");
    await page.waitForLoadState("networkidle");
  });

  test("criar projeto com nome e cor — aparece na listagem", async ({
    page,
  }) => {
    const nomeProjeto = `Projeto E2E ${Date.now()}`;

    await page.getByRole("button", { name: "Novo Projeto" }).click();

    await expect(
      page.getByRole("dialog", { name: "Novo Projeto" }),
    ).toBeVisible();

    await page.getByRole("dialog").getByLabel("Nome").fill(nomeProjeto);
    await page.getByRole("dialog").getByRole("button", { name: "Salvar" }).click();

    await expect(page.getByText(nomeProjeto)).toBeVisible();
  });

  test("editar projeto — modal abre com dados preenchidos", async ({
    page,
  }) => {
    await expect(page.getByText("Projeto Teste")).toBeVisible();

    const row = page.locator('[data-testid="project-row"]').filter({ hasText: "Projeto Teste" });
    await row.getByRole("button").first().click();

    const dialog = page.getByRole("dialog", { name: "Editar Projeto" });
    await expect(dialog).toBeVisible();

    const nomeInput = dialog.getByLabel("Nome");
    await expect(nomeInput).toHaveValue("Projeto Teste");
  });

  test("excluir projeto — dialog de confirmação aparece", async ({ page }, testInfo) => {
    const tempName = `Deletar E2E ${Date.now()}-${testInfo.workerIndex}`;
    await page.getByRole("button", { name: "Novo Projeto" }).click();
    await page.getByRole("dialog").getByLabel("Nome").fill(tempName);
    await page.getByRole("dialog").getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText(tempName)).toBeVisible();

    const row = page.locator('[data-testid="project-row"]').filter({ hasText: tempName });
    await row.getByRole("button").nth(1).click();

    await expect(page.getByRole("alertdialog")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Excluir Projeto")).toBeVisible();
  });

  test("excluir projeto — após confirmar, some da listagem", async ({
    page,
  }, testInfo) => {
    const tempName = `Excluir Confirmado ${Date.now()}-${testInfo.workerIndex}`;
    await page.getByRole("button", { name: "Novo Projeto" }).click();
    await page.getByRole("dialog").getByLabel("Nome").fill(tempName);
    await page.getByRole("dialog").getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText(tempName)).toBeVisible();

    const row = page.locator('[data-testid="project-row"]').filter({ hasText: tempName });
    await row.getByRole("button").nth(1).click();

    await expect(page.getByRole("alertdialog")).toBeVisible({ timeout: 5000 });
    const deleteResponse = page.waitForResponse(
      (r) => r.url().includes("/api/projects") && r.request().method() === "DELETE",
      { timeout: 10000 },
    );
    await page.getByRole("alertdialog").getByRole("button", { name: "Excluir" }).click();
    await deleteResponse;

    await expect(page.getByText(tempName)).not.toBeVisible();
  });

  test("tentar excluir projeto com UM associada — botão desabilitado", async ({
    page,
  }) => {
    await expect(page.getByText("Projeto Teste")).toBeVisible();

    const row = page.locator('[data-testid="project-row"]').filter({ hasText: "Projeto Teste" });
    const deleteButton = row.getByRole("button").nth(1);

    await expect(deleteButton).toBeDisabled();
  });
});
