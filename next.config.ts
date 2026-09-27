import type { NextConfig } from "next";

// Decisões registradas em docs/ARCHITECTURE.md (seção "Registro de decisões").
const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Modelo de renderização atual: dinâmico por padrão, cache explícito com "use cache" e streaming com <Suspense>.
  cacheComponents: true,
  // Links e router.push validados contra as rotas existentes.
  typedRoutes: true,
  // Memoização automática; não escrever useMemo/useCallback/memo por desempenho.
  reactCompiler: true,
};

export default nextConfig;
