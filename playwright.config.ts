import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./__tests__/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [["html", { outputFolder: "playwright-report" }], ["line"]],
  use: {
    baseURL: "http://localhost:3000",
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
  globalSetup: "./__tests__/e2e/setup/global-setup.ts",
  globalTeardown: "./__tests__/e2e/setup/global-teardown.ts",
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      DATABASE_URL:
        "postgresql://notescan:notescan_dev@localhost:5432/notescan_test",
      NEXTAUTH_SECRET: "test-secret-notescan-playwright",
      NEXTAUTH_URL: "http://localhost:3000",
      NEXT_PUBLIC_E2E_TESTING: "true",
    },
  },
});
