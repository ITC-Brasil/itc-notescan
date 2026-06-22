import { AdminLayout } from "@/components/layout/AdminLayout";
import { AuthGuard } from "@/components/layout/AuthGuard";

export default function AdminRouteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard requiredRole="ADMIN">
      <AdminLayout>{children}</AdminLayout>
    </AuthGuard>
  );
}
