import { UserLayout } from "@/components/layout/UserLayout";
import { AuthGuard } from "@/components/layout/AuthGuard";
import { PermissionsGate } from "@/components/PermissionsGate";
import { BiometricGate } from "@/components/BiometricGate";

export default function UserRouteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard requiredRole="USER">
      <BiometricGate>
        <PermissionsGate>
          <UserLayout>{children}</UserLayout>
        </PermissionsGate>
      </BiometricGate>
    </AuthGuard>
  );
}
