import { Page } from "@playwright/test";

type Role = "master" | "admin" | "tecnico";

const credentials: Record<Role, { email: string; password: string }> = {
  master: { email: "master@test.com", password: "Test@1234" },
  admin: { email: "admin@test.com", password: "Test@1234" },
  tecnico: { email: "tecnico@test.com", password: "Test@1234" },
};

export async function loginAs(page: Page, role: Role) {
  const { email, password } = credentials[role];

  await page.goto("/");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();

  if (role === "tecnico") {
    await page.waitForURL("**/inicio");
  } else {
    await page.waitForURL("**/dashboard");
  }
}
