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
    // Isolamento padrão mantido: suítes com `vi.mock("@/server/db")` vazam entre si com `isolate: false` em 1 worker.
    include: ["src/**/*.test.{ts,tsx}"],
    restoreMocks: true,
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/generated/**", "src/**/*.test.{ts,tsx}", "src/**/*.int.test.{ts,tsx}", "src/types/**"],
      reporter: ["text", "html", "json-summary"],
      thresholds: {
        // Domínio puro já supera 98%; meta de `src/server/**` (70%) entra após a onda estrutural de testes.
        "src/domain/**": { lines: 95, functions: 95 },
      },
    },
  },
});
