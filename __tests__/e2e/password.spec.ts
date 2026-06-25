import { test, expect } from "@playwright/test";
import { execSync } from "node:child_process";
import path from "node:path";
import { loginAs, openSidebar } from "./helpers/auth";

const SETUP_DIR = path.join(__dirname, "setup");

function resetPassword(email: string, password: string) {
  execSync(
    `node "${path.join(SETUP_DIR, "run-reset-password.js")}" "${email}" "${password}"`,
    { stdio: "inherit" },
  );
}

test.describe("Alteração de senha", () => {
  async function openPasswordModal(page: import("@playwright/test").Page) {
    await openSidebar(page);
    const footer = page.locator('[data-slot="sidebar-footer"]');
    await footer.getByRole("button").last().click();
    await page.getByRole("menuitem", { name: "Alterar senha" }).click();
    await expect(
      page.getByRole("dialog", { name: "Alterar Senha" }),
    ).toBeVisible();
  }

  test.beforeEach(async ({ page }) => {
    await loginAs(page, "admin");
  });

  // Reset password after each test in case it was changed
  test.afterEach(() => {
    resetPassword("admin@test.com", "Test@1234");
  });

  test("modal de alteração abre ao clicar em 'Alterar senha' no perfil", async ({
    page,
  }) => {
    await openPasswordModal(page);

    await expect(page.getByLabel("Senha atual")).toBeVisible();
    await expect(page.getByLabel("Nova senha", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Confirmar nova senha")).toBeVisible();
  });

  test("senha atual incorreta exibe erro", async ({ page }) => {
    await openPasswordModal(page);

    await page.getByLabel("Senha atual").fill("senha-errada");
    await page.getByLabel("Nova senha", { exact: true }).fill("NovaSenha@123");
    await page.getByLabel("Confirmar nova senha").fill("NovaSenha@123");
    await page.getByRole("button", { name: "Salvar" }).click();

    await expect(page.locator("[data-sonner-toast]")).toBeVisible({
      timeout: 5000,
    });
  });

  test("nova senha e confirmação diferentes exibem erro de validação", async ({
    page,
  }) => {
    await openPasswordModal(page);

    await page.getByLabel("Senha atual").fill("Test@1234");
    await page.getByLabel("Nova senha", { exact: true }).fill("NovaSenha@123");
    await page.getByLabel("Confirmar nova senha").fill("SenhaDiferente@456");
    await page.getByRole("button", { name: "Salvar" }).click();

    await expect(page.getByText("As senhas não coincidem")).toBeVisible();
  });

  test("alteração bem-sucedida exibe toast de sucesso", async ({ page }) => {
    await openPasswordModal(page);

    await page.getByLabel("Senha atual").fill("Test@1234");
    await page.getByLabel("Nova senha", { exact: true }).fill("NovaSenha@2026");
    await page.getByLabel("Confirmar nova senha").fill("NovaSenha@2026");
    await page.getByRole("button", { name: "Salvar" }).click();

    await expect(page.getByText("Senha alterada com sucesso.")).toBeVisible({
      timeout: 5000,
    });
  });

  test("login com a nova senha funciona", async ({ page }) => {
    await openPasswordModal(page);
    await page.getByLabel("Senha atual").fill("Test@1234");
    await page.getByLabel("Nova senha", { exact: true }).fill("SenhaNova@E2E");
    await page.getByLabel("Confirmar nova senha").fill("SenhaNova@E2E");
    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText("Senha alterada com sucesso.")).toBeVisible({
      timeout: 5000,
    });

    // Logout
    await openSidebar(page);
    const footer = page.locator('[data-slot="sidebar-footer"]');
    await footer.getByRole("button").last().click();
    await page.getByRole("menuitem", { name: "Sair" }).click();
    await page.waitForURL("/");

    // Login com a nova senha
    await page.getByLabel("Email").fill("admin@test.com");
    await page.locator('input[autocomplete="current-password"]').fill("SenhaNova@E2E");
    await page.getByRole("button", { name: "Entrar" }).click();
    await page.waitForURL("**/dashboard");

    expect(page.url()).toContain("/dashboard");
  });
});
