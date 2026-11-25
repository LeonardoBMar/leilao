import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // O pacote real lança erro fora do ambiente react-server; nos testes unitários ele é neutro.
      "server-only": fileURLToPath(new URL("./tests/stubs/server-only.ts", import.meta.url)),
      // `cacheLife`/`cacheTag` exigem o runtime de Cache Components do Next; no Vitest são neutros.
      "next/cache": fileURLToPath(new URL("./tests/stubs/next-cache.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    fsModuleCache: true,
    include: ["src/**/*.test.{ts,tsx}"],
    restoreMocks: true,
  },
});
