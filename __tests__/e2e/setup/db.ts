import { Pool } from "pg";
import bcrypt from "bcryptjs";
import { execSync } from "node:child_process";

const TEST_DB_URL =
  "postgresql://notescan:notescan_dev@localhost:5432/notescan_test";

async function ensureDatabaseExists() {
  const adminUrl = TEST_DB_URL.replace("/notescan_test", "/postgres");
  const pool = new Pool({ connectionString: adminUrl });
  try {
    await pool.query("CREATE DATABASE notescan_test");
  } catch {
    // Already exists — ignore
  } finally {
    await pool.end();
  }
}

export async function runMigrations() {
  await ensureDatabaseExists();
  execSync("npx prisma migrate deploy", {
    env: { ...process.env, DATABASE_URL: TEST_DB_URL },
    stdio: "inherit",
  });
}

export async function seedDatabase() {
  const pool = new Pool({ connectionString: TEST_DB_URL });

  try {
    const hash = await bcrypt.hash("Test@1234", 12);

    // Clear in dependency order
    await pool.query('DELETE FROM "ConferenceItem"');
    await pool.query('DELETE FROM "Conference"');
    await pool.query('DELETE FROM lifecycle_events');
    await pool.query('DELETE FROM "PushSubscription"');
    await pool.query('DELETE FROM "Notebook"');
    await pool.query('DELETE FROM "UM"');
    await pool.query('DELETE FROM "Project"');
    await pool.query('DELETE FROM "User"');

    // Users
    await pool.query(
      `INSERT INTO "User" (id, nome, email, "passwordHash", role, "metaDiaria", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, 'MASTER'::"Role", 2, now(), now())`,
      ["test-master-id", "Master Teste", "master@test.com", hash],
    );
    await pool.query(
      `INSERT INTO "User" (id, nome, email, "passwordHash", role, "metaDiaria", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, 'ADMIN'::"Role", 2, now(), now())`,
      ["test-admin-id", "Admin Teste", "admin@test.com", hash],
    );
    await pool.query(
      `INSERT INTO "User" (id, nome, email, "passwordHash", role, "metaDiaria", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, 'USER'::"Role", 2, now(), now())`,
      ["test-user-id", "Técnico Teste", "tecnico@test.com", hash],
    );

    // Project
    await pool.query(
      `INSERT INTO "Project" (id, nome, cor, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, now(), now())`,
      ["test-project-id", "Projeto Teste", "#008F95"],
    );

    // UM
    await pool.query(
      `INSERT INTO "UM" (id, nome, "projectId", "quantidadeEsperada",
         perifericos, mouses, carregadores, fones, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, false, false, false, false, now(), now())`,
      ["test-um-id", "UM-TESTE", "test-project-id", 5],
    );

    // Notebooks TESTE-EST01 to TESTE-EST05
    for (let i = 1; i <= 5; i++) {
      const num = i < 10 ? `0${i}` : `${i}`;
      await pool.query(
        `INSERT INTO "Notebook" (id, hostname, status, "umId", "createdAt", "updatedAt")
         VALUES ($1, $2, 'ATIVO'::"NotebookStatus", $3, now(), now())`,
        [`test-nb-${i}-id`, `TESTE-EST${num}`, "test-um-id"],
      );
    }
  } finally {
    await pool.end();
  }
}

export async function truncateDatabase() {
  const pool = new Pool({ connectionString: TEST_DB_URL });
  try {
    await pool.query('DELETE FROM "ConferenceItem"');
    await pool.query('DELETE FROM "Conference"');
    await pool.query('DELETE FROM lifecycle_events');
    await pool.query('DELETE FROM "PushSubscription"');
    await pool.query('DELETE FROM "Notebook"');
    await pool.query('DELETE FROM "UM"');
    await pool.query('DELETE FROM "Project"');
    await pool.query('DELETE FROM "User"');
  } finally {
    await pool.end();
  }
}

export async function resetUserPassword(email: string, password: string) {
  const pool = new Pool({ connectionString: TEST_DB_URL });
  try {
    const hash = await bcrypt.hash(password, 12);
    await pool.query(`UPDATE "User" SET "passwordHash" = $1 WHERE email = $2`, [
      hash,
      email,
    ]);
  } finally {
    await pool.end();
  }
}
