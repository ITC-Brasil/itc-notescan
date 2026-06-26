import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

function createExtendedClient() {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
  });

  return new PrismaClient({ adapter }).$extends({
    query: {
      lifecycleEvent: {
        async update(): Promise<never> {
          throw new Error("LifecycleEvent é imutável");
        },
        async updateMany(): Promise<never> {
          throw new Error("LifecycleEvent é imutável");
        },
        async delete(): Promise<never> {
          throw new Error("LifecycleEvent é imutável");
        },
        async deleteMany(): Promise<never> {
          throw new Error("LifecycleEvent é imutável");
        },
      },
    },
  });
}

type ExtendedPrismaClient = ReturnType<typeof createExtendedClient>;

const globalForPrisma = globalThis as unknown as {
  prisma: ExtendedPrismaClient | undefined;
};

export const prisma: ExtendedPrismaClient =
  globalForPrisma.prisma ?? createExtendedClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
