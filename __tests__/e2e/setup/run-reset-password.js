// @ts-check
"use strict";
// Usage: node run-reset-password.js <email> <password>
const { resetUserPassword } = require("./db");

const [email, password] = process.argv.slice(2);
if (!email || !password) {
  console.error("Usage: node run-reset-password.js <email> <password>");
  process.exit(1);
}

resetUserPassword(email, password)
  .then(() => console.log(`[reset-password] ${email} updated.`))
  .catch((e) => {
    console.error("[reset-password] Error:", e);
    process.exit(1);
  });
