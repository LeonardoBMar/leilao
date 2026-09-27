import { loadEnvConfig } from "@next/env";
import { defineConfig, env } from "prisma/config";

// Mesmo carregamento de .env* que o Next usa (inclui .env.local).
loadEnvConfig(process.cwd());

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  // A CLI (migrate, introspect) usa a conexão de sessão. A aplicação usa o pooler de transação em src/server/db.ts.
  datasource: { url: env("DIRECT_URL") },
});
