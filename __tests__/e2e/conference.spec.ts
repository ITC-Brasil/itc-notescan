import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";

async function selectUMAndStart(page: import("@playwright/test").Page) {
  await page.goto("/scanner");
  await page.waitForLoadState("networkidle");

  await page.getByRole("combobox").click();
  await page.getByRole("option", { name: /UM-TESTE/ }).click();
  await page.getByRole("button", { name: "Iniciar" }).click();

  await expect(page.getByText(/Pendentes/)).toBeVisible();
}

async function simulateScan(
  page: import("@playwright/test").Page,
  hostname: string,
) {
  const input = page.getByTestId("scan-test-input");
  await input.fill(hostname);
  await input.press("Enter");
}

test.describe("Fluxo de conferência", () => {
  test("técnico vê botão INICIAR em mobile", async ({ page }) => {
    // Pixel 7 viewport — button is visible (< sm breakpoint of 640px)
    await page.setViewportSize({ width: 412, height: 915 });
    await loginAs(page, "tecnico");
    await page.goto("/inicio");

    const button = page.getByRole("link", { name: "Iniciar Conferência" });
    await expect(button).toBeVisible();
  });

  test("técnico não vê botão INICIAR em desktop", async ({ page }) => {
    await loginAs(page, "tecnico");
    await page.goto("/inicio");

    // Desktop viewport triggers sm breakpoint (640px+) which hides the button
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.waitForTimeout(200);

    const button = page.getByRole("link", { name: "Iniciar Conferência" });
    await expect(button).not.toBeVisible();
  });

  test("selecionar UM carrega lista de notebooks pendentes", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 412, height: 915 });
    await loginAs(page, "tecnico");
    await page.goto("/scanner");
    await page.waitForLoadState("networkidle");

    await page.getByRole("combobox").click();
    await page.getByRole("option", { name: /UM-TESTE/ }).click();
    await page.getByRole("button", { name: "Iniciar" }).click();

    await expect(page.getByText(/Pendentes \(5\)/)).toBeVisible();
    await expect(page.getByText("TESTE-EST01")).toBeVisible();
  });

  test("simular scan de TESTE-EST01 — move para escaneados", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 412, height: 915 });
    await loginAs(page, "tecnico");
    await selectUMAndStart(page);

    await simulateScan(page, "TESTE-EST01");

    await expect(page.getByText(/Escaneados \(1\)/)).toBeVisible();
    await expect(page.getByText(/Pendentes \(4\)/)).toBeVisible();
  });

  test("simular scan duplicado de TESTE-EST01 — exibe erro", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 412, height: 915 });
    await loginAs(page, "tecnico");
    await selectUMAndStart(page);

    await simulateScan(page, "TESTE-EST01");
    await simulateScan(page, "TESTE-EST01");

    await expect(page.getByText(/já foi escaneado/i)).toBeVisible();
    await expect(page.getByText(/Escaneados \(1\)/)).toBeVisible();
  });

  test("finalizar com notebooks pendentes — status CONCLUIDO_FALTANTES", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 412, height: 915 });
    await loginAs(page, "tecnico");
    await selectUMAndStart(page);

    await page.getByRole("button", { name: /Finalizar/ }).click();

    // Summary phase — shows faltantes
    await expect(page.getByText(/Faltante/)).toBeVisible();
    await page.getByRole("button", { name: "Confirmar" }).click();

    await expect(page.getByText("Conferência salva!")).toBeVisible({
      timeout: 10000,
    });
  });

  test("conferência aparece no histórico pessoal do técnico", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 412, height: 915 });
    await loginAs(page, "tecnico");
    await selectUMAndStart(page);

    await page.getByRole("button", { name: /Finalizar/ }).click();
    await page.getByRole("button", { name: "Confirmar" }).click();
    await expect(page.getByText("Conferência salva!")).toBeVisible({
      timeout: 10000,
    });

    await page.goto("/inicio");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("UM-TESTE")).toBeVisible({ timeout: 10000 });
  });

  test("conferência aparece no dashboard do admin", async ({
    page,
    browser,
  }) => {
    await page.setViewportSize({ width: 412, height: 915 });
    await loginAs(page, "tecnico");
    await selectUMAndStart(page);

    await page.getByRole("button", { name: /Finalizar/ }).click();
    await page.getByRole("button", { name: "Confirmar" }).click();
    await expect(page.getByText("Conferência salva!")).toBeVisible({
      timeout: 10000,
    });

    // Verify on admin dashboard in a separate browser context
    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    await loginAs(adminPage, "admin");
    await adminPage.goto("/dashboard");
    await adminPage.waitForLoadState("networkidle");

    await expect(adminPage.getByText("UM-TESTE")).toBeVisible({
      timeout: 10000,
    });

    await adminContext.close();
  });
});
