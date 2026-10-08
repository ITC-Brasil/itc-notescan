import type { HumanRole } from "@/lib/auth/roles";
import type { DefaultSession } from "next-auth";

// role tipada pela allowlist humana; o valor em runtime vem do JWT e não é
// validado aqui — guardas de servidor seguem usando isHumanRole().
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      nome: string;
      role: HumanRole;
      metaDiaria: number;
    } & DefaultSession["user"];
  }

  interface User {
    nome: string;
    role: HumanRole;
    metaDiaria: number;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    nome: string;
    role: HumanRole;
    metaDiaria: number;
  }
}
