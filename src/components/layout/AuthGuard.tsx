"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Skeleton } from "@/components/ui/Skeleton";

interface AuthGuardProps {
  children: React.ReactNode;
  requiredRole?: "USER" | "ADMIN" | "MASTER";
}

export function AuthGuard({ children, requiredRole }: AuthGuardProps) {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "loading") return;

    if (!session) {
      router.replace("/");
      return;
    }

    if (!requiredRole) return;

    const role = session.user.role;
    const roleHierarchy: Record<string, number> = { USER: 1, ADMIN: 2, MASTER: 3 };
    const userLevel = roleHierarchy[role] ?? 0;
    const requiredLevel = roleHierarchy[requiredRole] ?? 0;

    if (userLevel < requiredLevel) {
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

  if (!session) return null;

  return <>{children}</>;
}
