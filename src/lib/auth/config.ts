import type { NextAuthConfig } from "next-auth";

// Edge-safe config — no Prisma, no bcrypt.
// Used by proxy.ts (middleware/Edge Runtime).
// The full Node.js config with adapter and providers lives in lib/auth/index.ts.
export const authConfig: NextAuthConfig = {
  trustHost: true,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/",
  },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role: string }).role;
        token.nome = (user as { nome: string }).nome;
        token.metaDiaria = (user as { metaDiaria: number }).metaDiaria;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id as string;
      session.user.role = token.role as string;
      session.user.nome = token.nome as string;
      session.user.metaDiaria = token.metaDiaria as number;
      return session;
    },
  },
};
