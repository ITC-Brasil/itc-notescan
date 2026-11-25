import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcrypt";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/db/prisma";
import { authConfig } from "./config";
import { isHumanRole } from "./roles";

// Exportada para teste unitário. Recusa qualquer role não humana: atores de
// serviço nunca fazem login interativo.
export async function authorizeCredentials(
  credentials: Partial<Record<string, unknown>> | undefined,
) {
  if (!credentials?.email || !credentials?.password) return null;

  const user = await prisma.user.findUnique({
    where: { email: credentials.email as string },
  });

  // Antes do bcrypt: agente (sem senha) é recusado sem custo e sem lançar
  // exceção com hash null.
  if (!user || !user.passwordHash || !isHumanRole(user.role)) return null;

  const valid = await bcrypt.compare(
    credentials.password as string,
    user.passwordHash,
  );

  if (!valid) return null;

  return {
    id: user.id,
    email: user.email,
    nome: user.nome,
    role: user.role,
    metaDiaria: user.metaDiaria,
  };
}

export const { auth, handlers, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  providers: [
    Credentials({
      authorize: authorizeCredentials,
    }),
  ],
});
