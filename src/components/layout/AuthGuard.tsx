"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Skeleton } from "@/components/ui/Skeleton";
import type { HumanRole } from "@/lib/auth/roles";

interface AuthGuardProps {
  children: React.ReactNode;
  requiredRole?: HumanRole;
}

const roleHierarchy: Record<string, number> = { USER: 1, ADMIN: 2, MASTER: 3 };

// Role desconhecida = nível 0 = negada para qualquer requiredRole.
function hasAccess(role: string, requiredRole?: HumanRole): boolean {
  const userLevel = roleHierarchy[role] ?? 0;
  if (userLevel === 0) return false;
  return !requiredRole || userLevel >= roleHierarchy[requiredRole];
}

export function AuthGuard({ children, requiredRole }: AuthGuardProps) {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    // Only redirect on a CONFIRMED unauthenticated status — never on a transient
    // null/loading (e.g. right after returning from background). The server
    // (proxy.ts) is the real gate; this is the client-side belt.
    if (status === "unauthenticated") {
      router.replace("/");
      return;
    }

    if (status !== "authenticated" || !session) return;

    if (!hasAccess(session.user.role, requiredRole)) {
      router.replace("/inicio");
    }
  }, [session, status, router, requiredRole]);

  if (status === "loading") {
    return (
      <div className="flex flex-col gap-4 p-8">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (status !== "authenticated" || !hasAccess(session.user.role, requiredRole)) return null;

  return <>{children}</>;
}
