// @ts-check
"use strict";
// Standalone script — runs outside Playwright's ESM loader as a child process.
const { truncateDatabase } = require("./db");

(async () => {
  await truncateDatabase();
  console.log("[teardown] Database cleaned.");
})().catch((e) => {
  console.error("[teardown] Error:", e);
  process.exit(1);
});
