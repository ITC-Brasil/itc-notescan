import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";

test.describe("Proteção de rotas por role", () => {
  test("USER acessando /dashboard é redirecionado para /inicio", async ({
    page,
  }) => {
    await loginAs(page, "tecnico");
    await page.goto("/dashboard");

    await page.waitForURL("**/inicio");
    expect(page.url()).toContain("/inicio");
  });

  test("USER acessando /usuarios é redirecionado", async ({ page }) => {
    await loginAs(page, "tecnico");
    await page.goto("/usuarios");

    await page.waitForURL("**/inicio");
    expect(page.url()).toContain("/inicio");
  });

  test("ADMIN acessando /usuarios é redirecionado (apenas MASTER)", async ({
    page,
  }) => {
    await loginAs(page, "admin");
    await page.goto("/usuarios");

    await page.waitForURL("**/inicio");
    expect(page.url()).toContain("/inicio");
  });

  test("MASTER acessa /usuarios sem redirecionamento", async ({ page }) => {
    await loginAs(page, "master");
    await page.goto("/usuarios");

    await page.waitForURL("**/usuarios");
    expect(page.url()).toContain("/usuarios");
  });

  test("ADMIN acessa /dashboard sem redirecionamento", async ({ page }) => {
    await loginAs(page, "admin");

    expect(page.url()).toContain("/dashboard");
  });
});
