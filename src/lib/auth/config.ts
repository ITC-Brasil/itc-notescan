import type { NextAuthConfig } from "next-auth";

// Edge-safe config — no Prisma, no bcrypt.
// Used by proxy.ts (middleware/Edge Runtime).
// The full Node.js config with adapter and providers lives in lib/auth/index.ts.
// Technicians stay logged in for 7 days without re-authenticating.
// The session cookie's Expires and the JWT's exp are both derived from this;
// activity within the window refreshes the expiry.
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days in seconds

export const authConfig: NextAuthConfig = {
  trustHost: true,
  session: { strategy: "jwt", maxAge: SESSION_MAX_AGE },
  jwt: { maxAge: SESSION_MAX_AGE },
  pages: {
    signIn: "/",
  },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        // authorizeCredentials sempre devolve id; o tipo do core o deixa opcional.
        token.id = user.id as string;
        token.role = user.role;
        token.nome = user.nome;
        token.metaDiaria = user.metaDiaria;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id;
      session.user.role = token.role;
      session.user.nome = token.nome;
      session.user.metaDiaria = token.metaDiaria;
      return session;
    },
  },
};
