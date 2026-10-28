import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth/config";
import { HOME_BY_ROLE, isHumanRole } from "@/lib/auth/roles";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;

  // Sessão com role fora da allowlist humana: derruba a sessão apagando os
  // cookies (inclusive pedaços .0/.1) e cai no login. "/" nunca redireciona
  // sessão não humana, então não há loop.
  if (session && !isHumanRole(session.user.role)) {
    const res =
      pathname === "/"
        ? NextResponse.next()
        : NextResponse.redirect(new URL("/", req.url));
    for (const { name } of req.cookies.getAll()) {
      if (!name.includes("authjs.session-token")) continue;
      // __Secure- exige path e secure no Set-Cookie de remoção, senão o
      // navegador ignora (só quebra em HTTPS).
      res.cookies.set(name, "", {
        maxAge: 0,
        path: "/",
        secure: name.startsWith("__Secure-"),
      });
    }
    return res;
  }

  if (pathname === "/") {
    if (session) {
      return NextResponse.redirect(new URL(HOME_BY_ROLE[session.user.role], req.url));
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
    !["ADMIN", "MASTER"].includes(session.user.role)
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
