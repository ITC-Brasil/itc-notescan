import { defineConfig, devices } from "@playwright/test";
import { TEST_DB_URL } from "./__tests__/e2e/setup/db";

export default defineConfig({
  testDir: "./__tests__/e2e",
  tsconfig: "./tsconfig.playwright.json",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [["html", { outputFolder: "playwright-report" }], ["line"]],
  use: {
    baseURL: "http://localhost:3001",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 7"] },
    },
  ],
  globalSetup: "./__tests__/e2e/setup/global-setup.js",
  globalTeardown: "./__tests__/e2e/setup/global-teardown.js",
  webServer: {
    command: "npm run dev -- -p 3001",
    url: "http://localhost:3001",
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      DATABASE_URL: TEST_DB_URL,
      NEXTAUTH_SECRET: "test-secret-notescan-playwright",
      NEXTAUTH_URL: "http://localhost:3001",
      NEXT_PUBLIC_E2E_TESTING: "true",
    },
  },
});
