import { Page } from "@playwright/test";

type Role = "master" | "admin" | "tecnico";

const credentials: Record<Role, { email: string; password: string }> = {
  master: { email: "master@test.com", password: "Test@1234" },
  admin: { email: "admin@test.com", password: "Test@1234" },
  tecnico: { email: "tecnico@test.com", password: "Test@1234" },
};

export async function loginAs(page: Page, role: Role) {
  const { email, password } = credentials[role];

  // O overlay de dev do Next (<nextjs-portal>) fica sobre o rodapé da sidebar e
  // intercepta cliques. Oculto em toda navegação desta página; só afeta o teste.
  await page.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => {
      const style = document.createElement("style");
      style.textContent = "nextjs-portal { display: none !important; }";
      document.head.appendChild(style);
    });
  });

  // networkidle: o submit antes da hidratação vira POST nativo e recarrega a página sem logar
  await page.goto("/", { waitUntil: "networkidle" });
  await page.getByLabel("E-mail").fill(email);
  await page.locator('input[autocomplete="current-password"]').fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();

  if (role === "tecnico") {
    await page.waitForURL("**/inicio");
  } else {
    await page.waitForURL("**/dashboard");
  }
}

/**
 * Ensures the sidebar is open. On mobile viewports, the sidebar is a Sheet
 * and must be opened via the SidebarTrigger before accessing footer content.
 */
export async function openSidebar(page: Page) {
  const viewport = page.viewportSize();
  if (viewport && viewport.width < 768) {
    const footer = page.locator('[data-slot="sidebar-footer"]');
    const isAlreadyOpen = await footer.isVisible().catch(() => false);
    if (!isAlreadyOpen) {
      const trigger = page.locator('[data-slot="sidebar-trigger"]');
      await trigger.click();
      await footer.waitFor({ state: "visible" });
    }
  }
}
