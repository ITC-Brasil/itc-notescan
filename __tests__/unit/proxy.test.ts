import { describe, expect, it, vi } from "vitest";

// auth(handler) devolve o próprio handler: testamos a lógica do proxy direto.
vi.mock("next-auth", () => ({
  default: () => ({ auth: (handler: unknown) => handler }),
}));

import proxy from "@/proxy";

type Req = Parameters<typeof proxy>[0];

function run(pathname: string, role?: string, cookies: string[] = []) {
  const req = {
    nextUrl: { pathname },
    url: `https://notescan.test${pathname}`,
    auth: role ? { user: { role } } : null,
    cookies: { getAll: () => cookies.map((name) => ({ name, value: "x" })) },
  } as unknown as Req;
  return (proxy as unknown as (r: Req) => Response | undefined)(req);
}

const location = (res?: Response) => res?.headers.get("location") ?? null;

describe("proxy — allowlist de roles", () => {
  it.each([
    ["USER", "/inicio"],
    ["ADMIN", "/dashboard"],
    ["MASTER", "/dashboard"],
  ])("'/' redireciona %s para %s", (role, dest) => {
    expect(location(run("/", role))).toBe(`https://notescan.test${dest}`);
  });

  it("USER em rota admin vai para /inicio", () => {
    expect(location(run("/dashboard", "USER"))).toBe("https://notescan.test/inicio");
  });

  it("role não humana em rota protegida: redireciona para / e apaga cookies de sessão", () => {
    const res = run("/inicio", "AGENTE", [
      "__Secure-authjs.session-token.0",
      "__Secure-authjs.session-token.1",
      "authjs.session-token",
      "authjs.csrf-token",
    ]);
    expect(location(res)).toBe("https://notescan.test/");
    const setCookie = res!.headers.getSetCookie();
    expect(setCookie).toHaveLength(3);
    const secure = setCookie.filter((c) => c.startsWith("__Secure-"));
    expect(secure).toHaveLength(2);
    for (const c of secure) expect(c).toMatch(/Path=\/.*Secure|Secure.*Path=\//i);
    for (const c of setCookie) expect(c).toMatch(/Max-Age=0/i);
    expect(setCookie.some((c) => c.startsWith("authjs.csrf-token"))).toBe(false);
  });

  it("role não humana em '/': não redireciona (sem loop), só apaga cookie", () => {
    const res = run("/", "AGENTE", ["authjs.session-token"]);
    expect(location(res)).toBeNull();
    expect(res!.headers.getSetCookie()).toHaveLength(1);
  });
});
