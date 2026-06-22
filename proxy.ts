import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth/config";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;

  const publicRoutes = ["/"];
  if (publicRoutes.includes(pathname)) return;

  if (!session) {
    return Response.redirect(new URL("/", req.url));
  }

  const adminRoutes = [
    "/dashboard",
    "/notebooks",
    "/projetos",
    "/ums",
    "/notificacoes",
    "/relatorios",
  ];
  const masterRoutes = ["/usuarios"];

  if (
    masterRoutes.some((r) => pathname.startsWith(r)) &&
    session.user.role !== "MASTER"
  ) {
    return Response.redirect(new URL("/inicio", req.url));
  }

  if (
    adminRoutes.some((r) => pathname.startsWith(r)) &&
    !["ADMIN", "MASTER"].includes(session.user.role as string)
  ) {
    return Response.redirect(new URL("/inicio", req.url));
  }
});
