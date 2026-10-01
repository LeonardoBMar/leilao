import type { NextConfig } from "next";

import { LISTING_IMAGE_ORIGINS } from "./src/sources/image-origins";

// Decisões registradas em docs/ARCHITECTURE.md (seção "Registro de decisões").

const isDev = process.env.NODE_ENV === "development";
// Login desligado é só para `npm run dev:local` (D-31). Na Vercel a variável só pode estar lá por engano: o build falha.
if (process.env.VERCEL && process.env.DEV_AUTH_BYPASS) {
  throw new Error("DEV_AUTH_BYPASS não pode existir na Vercel (D-31). Remova a variável do projeto.");
}
const supabaseOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin : "";
// Fotos dos anúncios coletados vêm direto da fonte, sem cópia no Storage (D-29). Uma origem por fonte.
const listingImageOrigins = LISTING_IMAGE_ORIGINS.join(" ");

/**
 * CSP sem nonce (D-21): nonce exige renderização dinâmica e é incompatível com o Partial Prerendering do
 * Cache Components. `'unsafe-inline'` em scripts cobre o payload RSC inline do Next; o resto é restrito à própria
 * origem e ao Supabase (fotos assinadas e envio direto ao Storage).
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' blob: data: ${supabaseOrigin} ${listingImageOrigins}`,
  "font-src 'self'",
  `connect-src 'self' ${supabaseOrigin}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Modelo de renderização atual: dinâmico por padrão, cache explícito com "use cache" e streaming com <Suspense>.
  cacheComponents: true,
  // Links e router.push validados contra as rotas existentes.
  typedRoutes: true,
  // Memoização automática; não escrever useMemo/useCallback/memo por desempenho.
  reactCompiler: true,
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
