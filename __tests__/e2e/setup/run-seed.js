// @ts-check
"use strict";
// Standalone script — runs outside Playwright's ESM loader as a child process.
const { runMigrations, seedDatabase } = require("./db");

(async () => {
  await runMigrations();
  await seedDatabase();
  console.log("[seed] Database ready.");
})().catch((e) => {
  console.error("[seed] Error:", e);
  process.exit(1);
});
