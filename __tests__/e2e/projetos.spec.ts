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
    // The seeded "Projeto Teste" should be in the list
    await expect(page.getByText("Projeto Teste")).toBeVisible();

    // Click edit button next to "Projeto Teste"
    const row = page.locator("div").filter({ hasText: /^Projeto Teste/ }).first();
    await row.getByRole("button").first().click();

    const dialog = page.getByRole("dialog", { name: "Editar Projeto" });
    await expect(dialog).toBeVisible();

    // Name field should be pre-filled
    const nomeInput = dialog.getByLabel("Nome");
    await expect(nomeInput).toHaveValue("Projeto Teste");
  });

  test("excluir projeto — dialog de confirmação aparece", async ({ page }) => {
    // Create a temp project to delete
    const tempName = `Deletar E2E ${Date.now()}`;
    await page.getByRole("button", { name: "Novo Projeto" }).click();
    await page.getByRole("dialog").getByLabel("Nome").fill(tempName);
    await page.getByRole("dialog").getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText(tempName)).toBeVisible();

    // Click delete on the newly created project (no UMs, so button is enabled)
    const row = page.locator("div").filter({ hasText: tempName }).first();
    const buttons = row.getByRole("button");
    // Second button is delete (first is edit)
    await buttons.nth(1).click();

    await expect(
      page.getByRole("alertdialog").or(page.getByRole("dialog")),
    ).toBeVisible();
    await expect(page.getByText("Excluir Projeto")).toBeVisible();
  });

  test("excluir projeto — após confirmar, some da listagem", async ({
    page,
  }) => {
    const tempName = `Excluir Confirmado ${Date.now()}`;
    await page.getByRole("button", { name: "Novo Projeto" }).click();
    await page.getByRole("dialog").getByLabel("Nome").fill(tempName);
    await page.getByRole("dialog").getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText(tempName)).toBeVisible();

    const row = page.locator("div").filter({ hasText: tempName }).first();
    await row.getByRole("button").nth(1).click();

    await page.getByRole("button", { name: "Excluir" }).last().click();

    await expect(page.getByText(tempName)).not.toBeVisible();
  });

  test("tentar excluir projeto com UM associada — botão desabilitado", async ({
    page,
  }) => {
    // "Projeto Teste" has UM-TESTE associated — its delete button should be disabled
    await expect(page.getByText("Projeto Teste")).toBeVisible();

    const row = page.locator("div").filter({ hasText: /^Projeto Teste/ }).first();
    const deleteButton = row.getByRole("button").nth(1);

    await expect(deleteButton).toBeDisabled();
  });
});
