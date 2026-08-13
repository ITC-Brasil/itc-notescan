import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth/config";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;

  if (pathname === "/") {
    if (session) {
      const dest = session.user.role === "USER" ? "/inicio" : "/dashboard";
      return NextResponse.redirect(new URL(dest, req.url));
    }
    return;
  }

  if (!session) {
    return NextResponse.redirect(new URL("/", req.url));
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
    return NextResponse.redirect(new URL("/inicio", req.url));
  }

  if (
    adminRoutes.some((r) => pathname.startsWith(r)) &&
    !["ADMIN", "MASTER"].includes(session.user.role as string)
  ) {
    return NextResponse.redirect(new URL("/inicio", req.url));
  }
});

// Listar explicitamente as rotas protegidas em vez de excluir /api/*.
// O regex negativo com lookahead pode falhar no Turbopack em dev mode,
// fazendo o proxy interceptar /api/auth/session e redirecionar para "/",
// o que retorna HTML em vez de JSON e quebra o NextAuth no cliente.
// Com a lista explícita, qualquer rota não listada (incluindo /api/*) nunca
// passa pelo proxy — cada API Route já faz seu próprio auth().
export const config = {
  matcher: [
    "/",
    "/dashboard/:path*",
    "/relatorios/:path*",
    "/projetos/:path*",
    "/ums/:path*",
    "/notebooks/:path*",
    "/notificacoes/:path*",
    "/usuarios/:path*",
    "/inicio/:path*",
    "/scanner/:path*",
    "/alterar-senha",
  ],
};
