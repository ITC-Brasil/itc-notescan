/**
 * Script para criar o primeiro usuário MASTER.
 * Uso: npx tsx scripts/create-admin.ts
 *
 * Requer DATABASE_URL configurada em .env.local
 */

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import bcrypt from "bcryptjs";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@itcbrasil.com.br";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "Senha@123";
const ADMIN_NAME = process.env.ADMIN_NAME ?? "Administrador";

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL não configurada.");
    process.exit(1);
  }

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  try {
    const existing = await prisma.user.findUnique({
      where: { email: ADMIN_EMAIL },
    });

    if (existing) {
      console.log(`Usuário já existe: ${ADMIN_EMAIL}`);
      return;
    }

    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);

    const user = await prisma.user.create({
      data: {
        nome: ADMIN_NAME,
        email: ADMIN_EMAIL,
        passwordHash,
        role: "MASTER",
        metaDiaria: 2,
      },
    });

    console.log(`Usuário MASTER criado: ${user.email} (id: ${user.id})`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
