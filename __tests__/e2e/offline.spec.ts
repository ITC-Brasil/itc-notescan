import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";

async function setupConferenceAndGoToSummary(
  page: import("@playwright/test").Page,
) {
  await loginAs(page, "tecnico");
  await page.goto("/scanner");
  await page.waitForLoadState("networkidle");

  await page.getByRole("combobox").click();
  await page.getByRole("option", { name: /UM-TESTE/ }).click();
  await page.getByRole("button", { name: "Iniciar Conferência" }).click();
  await expect(page.getByText(/Pendentes/)).toBeVisible();

  // Proceed to summary without scanning
  await page.getByRole("button", { name: "Próximo" }).click();
  await expect(page.getByRole("button", { name: "Concluir e Enviar" })).toBeVisible();
}

test.describe("Fluxo offline", () => {
  test("com network desabilitado, conferência é salva no Dexie", async ({
    page,
  }) => {
    await setupConferenceAndGoToSummary(page);

    // Block the conferences API to simulate offline
    await page.route("**/api/conferences", (route) => route.abort());

    await page.getByRole("button", { name: "Concluir e Enviar" }).click();

    // Done phase should show offline message
    await expect(page.getByText("Conferência salva!")).toBeVisible({
      timeout: 10000,
    });
    await expect(
      page.getByText(/será sincronizada automaticamente/i),
    ).toBeVisible();
  });

  test("toast informa que será sincronizada quando houver conexão", async ({
    page,
  }) => {
    await setupConferenceAndGoToSummary(page);

    await page.route("**/api/conferences", (route) => route.abort());
    await page.getByRole("button", { name: "Concluir e Enviar" }).click();

    await expect(
      page.getByText(/será sincronizada automaticamente/i),
    ).toBeVisible({ timeout: 10000 });
  });

  test("ao reabilitar network, conferência é sincronizada", async ({
    page,
  }) => {
    await setupConferenceAndGoToSummary(page);

    // Go offline
    await page.route("**/api/conferences", (route) => route.abort());
    await page.getByRole("button", { name: "Concluir e Enviar" }).click();
    await expect(page.getByText("Conferência salva!")).toBeVisible({
      timeout: 10000,
    });

    // Re-enable network
    await page.unroute("**/api/conferences");

    // Navigate to /inicio — this triggers processOutbox() when online
    const syncRequest = page.waitForRequest("**/api/conferences");
    await page.goto("/inicio");
    await page.waitForLoadState("networkidle");

    // Wait for the sync request to happen
    await syncRequest;
  });

  test("conferência sincronizada aparece no dashboard", async ({
    page,
    browser,
  }) => {
    await setupConferenceAndGoToSummary(page);

    // Go offline, finalize
    await page.route("**/api/conferences", (route) => route.abort());
    await page.getByRole("button", { name: "Concluir e Enviar" }).click();
    await expect(page.getByText("Conferência salva!")).toBeVisible({
      timeout: 10000,
    });

    // Re-enable network
    await page.unroute("**/api/conferences");

    // Navigate to /inicio to trigger sync (wait for POST specifically)
    const syncResponse = page.waitForResponse(
      (r) => r.url().includes("/api/conferences") && r.request().method() === "POST",
      { timeout: 15000 },
    );
    await page.goto("/inicio");
    await page.waitForLoadState("networkidle");
    await syncResponse;

    // Verify on admin dashboard
    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    await loginAs(adminPage, "admin");
    await adminPage.goto("/dashboard");
    await adminPage.waitForLoadState("networkidle");

    await expect(adminPage.getByText("UM-TESTE").first()).toBeVisible({
      timeout: 10000,
    });

    await adminContext.close();
  });
});
