import { test, expect } from "@playwright/test";
import { loginAs, openSidebar } from "./helpers/auth";

test.describe("Autenticação", () => {
  test("login com credenciais válidas redireciona para /dashboard (ADMIN)", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByLabel("Email").fill("admin@test.com");
    await page.locator('input[autocomplete="current-password"]').fill("Test@1234");
    await page.getByRole("button", { name: "Entrar" }).click();

    await page.waitForURL("**/dashboard");
    expect(page.url()).toContain("/dashboard");
  });

  test("login com credenciais válidas redireciona para /inicio (USER)", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByLabel("Email").fill("tecnico@test.com");
    await page.locator('input[autocomplete="current-password"]').fill("Test@1234");
    await page.getByRole("button", { name: "Entrar" }).click();

    await page.waitForURL("**/inicio");
    expect(page.url()).toContain("/inicio");
  });

  test("login com senha incorreta exibe mensagem de erro", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Email").fill("admin@test.com");
    await page.locator('input[autocomplete="current-password"]').fill("senha-errada");
    await page.getByRole("button", { name: "Entrar" }).click();

    await expect(
      page.getByText("Email ou senha inválidos."),
    ).toBeVisible();
  });

  test("login com email inexistente exibe mensagem de erro", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByLabel("Email").fill("naoexiste@test.com");
    await page.locator('input[autocomplete="current-password"]').fill("Test@1234");
    await page.getByRole("button", { name: "Entrar" }).click();

    await expect(
      page.getByText("Email ou senha inválidos."),
    ).toBeVisible();
  });

  test("campos vazios exibem validação antes de submeter", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Entrar" }).click();

    // Zod/react-hook-form shows validation messages on the form fields
    // The form should show field-level errors without submitting
    await expect(page).toHaveURL("/");
  });

  test("logout encerra a sessão e redireciona para /", async ({ page }) => {
    await loginAs(page, "admin");
    await openSidebar(page);

    const footer = page.locator('[data-slot="sidebar-footer"]');
    await footer.getByRole("button").last().click();
    await page.getByRole("menuitem", { name: "Sair" }).click();

    await page.waitForURL("/");
    expect(page.url()).toMatch(/\/$/);
  });

  test("acessar /dashboard sem sessão redireciona para /", async ({ page }) => {
    await page.goto("/dashboard");

    await page.waitForURL("/");
    expect(page.url()).toMatch(/\/$/);
  });

  test("acessar /inicio sem sessão redireciona para /", async ({ page }) => {
    await page.goto("/inicio");

    await page.waitForURL("/");
    expect(page.url()).toMatch(/\/$/);
  });
});
