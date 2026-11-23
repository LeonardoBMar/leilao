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
  ...(isDev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]),
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Modelo de renderização atual: dinâmico por padrão, cache explícito com "use cache" e streaming com <Suspense>.
  cacheComponents: true,
  // Partial Prefetching habilitado após auditoria de links e limites de Suspense (D-87).
  partialPrefetching: true,
  // Bases do catálogo global entre requisições (D-78): a coleta roda a cada 12 h, então 15 min de atraso não mudam nada.
  cacheLife: {
    catalog: { stale: 300, revalidate: 900, expire: 7200 },
  },
  // Links e router.push validados contra as rotas existentes.
  typedRoutes: true,
  // Memoização automática; não escrever useMemo/useCallback/memo por desempenho.
  reactCompiler: true,
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
  // Rotas antigas (D-42, D-71): favoritos e links já enviados continuam funcionando; a query vai junto.
  async redirects() {
    const uuid = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
    // A Pesquisa (D-45) virou o Panorama: filtros que só ele entende levam para lá. Marca, modelo, ano, km e condição
    // também servem ao Avaliar e ficam em /mercado.
    const panoramaOnly = ["uf", "categoria", "medida", "fonte", "venda", "vsmarca", "vsmodelo", "vsuf"];
    return [
      ...panoramaOnly.map((key) => ({
        source: "/mercado",
        has: [{ type: "query" as const, key }],
        destination: "/mercado/panorama",
        permanent: false,
      })),
      { source: "/descobertos", destination: "/leiloes/veiculos", permanent: false },
      { source: "/lotes", destination: "/minhas-analises", permanent: false },
      { source: "/leiloes/novo", destination: "/minhas-analises/leiloes/novo", permanent: false },
      { source: `/leiloes/:id(${uuid})/:rest*`, destination: "/minhas-analises/leiloes/:id/:rest*", permanent: false },
    ];
  },
};

export default nextConfig;
