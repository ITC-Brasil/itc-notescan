import { AuthGuard } from "@/components/layout/AuthGuard";

export default function UsuariosLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthGuard requiredRole="MASTER">{children}</AuthGuard>;
}
