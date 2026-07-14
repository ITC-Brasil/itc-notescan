import { UserLayout } from "@/components/layout/UserLayout";
import { AuthGuard } from "@/components/layout/AuthGuard";
import { PermissionsGate } from "@/components/PermissionsGate";

export default function UserRouteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard requiredRole="USER">
      <PermissionsGate>
        <UserLayout>{children}</UserLayout>
      </PermissionsGate>
    </AuthGuard>
  );
}
