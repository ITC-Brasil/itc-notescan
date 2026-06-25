import { runMigrations, seedDatabase } from "./db";

export default async function globalSetup() {
  await runMigrations();
  await seedDatabase();
}
