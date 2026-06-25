import { truncateDatabase } from "./db";

export default async function globalTeardown() {
  await truncateDatabase();
}
