import { UserLayout } from "@/components/layout/UserLayout";
import { AuthGuard } from "@/components/layout/AuthGuard";

export default function UserRouteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard requiredRole="USER">
      <UserLayout>{children}</UserLayout>
    </AuthGuard>
  );
}
