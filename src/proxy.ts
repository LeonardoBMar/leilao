import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import { devAuthUserId } from "@/lib/dev-auth";
import { publicEnv } from "@/lib/public-env";

const PUBLIC_PATHS = ["/login"];
const HOME_PATH = "/dashboard";

/**
 * Renova a sessão do Supabase e faz o redirecionamento otimista (D-12).
 * Não é barreira de segurança: a autorização real está em `requireUser()` na DAL.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
          for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
        },
      },
    },
  );

  // Nada entre createServerClient e getClaims(): é aqui que o token expirado é renovado.
  const { data } = await supabase.auth.getClaims();
  const isAuthenticated = Boolean(data?.claims) || devAuthUserId(process.env, request.headers.get("host")) !== null;
  const { pathname, search } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));

  if (!isAuthenticated && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname + search)}`;
    return redirectKeepingSession(url, response);
  }

  if (isAuthenticated && isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = HOME_PATH;
    url.search = "";
    return redirectKeepingSession(url, response);
  }

  // Devolver exatamente a resposta montada em setAll; outra resposta perderia os cookies renovados.
  return response;
}

/** Redireciona sem perder os cookies renovados nem os cabeçalhos de cache definidos pelo Supabase. */
function redirectKeepingSession(url: URL, sessionResponse: NextResponse) {
  const redirect = NextResponse.redirect(url);
  for (const cookie of sessionResponse.cookies.getAll()) redirect.cookies.set(cookie);
  for (const header of ["cache-control", "expires", "pragma"]) {
    const value = sessionResponse.headers.get(header);
    if (value) redirect.headers.set(header, value);
  }
  return redirect;
}

export const config = {
  // Fora do proxy: assets do Next, arquivos estáticos e metadados públicos (robots.txt responde sem sessão).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
