// @ts-check
"use strict";
// Uses only Node.js built-ins to avoid Playwright's ESM resolve hook bug
// (context.conditions?.includes is not a function) on Node.js 22.
const { execSync } = require("node:child_process");
const path = require("node:path");

module.exports = async function globalTeardown() {
  execSync(
    `node "${path.join(__dirname, "run-teardown.js")}"`,
    { stdio: "inherit" },
  );
};
