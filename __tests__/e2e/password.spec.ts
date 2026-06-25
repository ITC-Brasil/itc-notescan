import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";
import { resetUserPassword } from "./setup/db";

test.describe("Alteração de senha", () => {
  async function openPasswordModal(page: import("@playwright/test").Page) {
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

  test.afterAll(async () => {
    // Restore original password in case a test changed it
    await resetUserPassword("admin@test.com", "Test@1234");
  });

  test("modal de alteração abre ao clicar em 'Alterar senha' no perfil", async ({
    page,
  }) => {
    await openPasswordModal(page);

    await expect(page.getByLabel("Senha atual")).toBeVisible();
    await expect(page.getByLabel("Nova senha")).toBeVisible();
    await expect(page.getByLabel("Confirmar nova senha")).toBeVisible();
  });

  test("senha atual incorreta exibe erro", async ({ page }) => {
    await openPasswordModal(page);

    await page.getByLabel("Senha atual").fill("senha-errada");
    await page.getByLabel("Nova senha").fill("NovaSenha@123");
    await page.getByLabel("Confirmar nova senha").fill("NovaSenha@123");
    await page.getByRole("button", { name: "Salvar" }).click();

    // API returns error, toast should show
    await expect(page.locator("[data-sonner-toast]")).toBeVisible({
      timeout: 5000,
    });
  });

  test("nova senha e confirmação diferentes exibem erro de validação", async ({
    page,
  }) => {
    await openPasswordModal(page);

    await page.getByLabel("Senha atual").fill("Test@1234");
    await page.getByLabel("Nova senha").fill("NovaSenha@123");
    await page.getByLabel("Confirmar nova senha").fill("SenhaDiferente@456");
    await page.getByRole("button", { name: "Salvar" }).click();

    // Zod refine error: "As senhas não coincidem"
    await expect(page.getByText("As senhas não coincidem")).toBeVisible();
  });

  test("alteração bem-sucedida exibe toast de sucesso", async ({ page }) => {
    await openPasswordModal(page);

    await page.getByLabel("Senha atual").fill("Test@1234");
    await page.getByLabel("Nova senha").fill("NovaSenha@2026");
    await page.getByLabel("Confirmar nova senha").fill("NovaSenha@2026");
    await page.getByRole("button", { name: "Salvar" }).click();

    await expect(page.getByText("Senha alterada com sucesso.")).toBeVisible({
      timeout: 5000,
    });
  });

  test("login com a nova senha funciona", async ({ page }) => {
    // This test depends on the previous one having changed the password
    // We first reset the admin password to Test@1234 so this test is clean
    await resetUserPassword("admin@test.com", "Test@1234");

    // Change to new password via modal
    await openPasswordModal(page);
    await page.getByLabel("Senha atual").fill("Test@1234");
    await page.getByLabel("Nova senha").fill("SenhaNova@E2E");
    await page.getByLabel("Confirmar nova senha").fill("SenhaNova@E2E");
    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText("Senha alterada com sucesso.")).toBeVisible({
      timeout: 5000,
    });

    // Logout
    const footer = page.locator('[data-slot="sidebar-footer"]');
    await footer.getByRole("button").last().click();
    await page.getByRole("menuitem", { name: "Sair" }).click();
    await page.waitForURL("/");

    // Login with new password
    await page.getByLabel("Email").fill("admin@test.com");
    await page.getByLabel("Senha").fill("SenhaNova@E2E");
    await page.getByRole("button", { name: "Entrar" }).click();
    await page.waitForURL("**/dashboard");

    expect(page.url()).toContain("/dashboard");
  });
});
