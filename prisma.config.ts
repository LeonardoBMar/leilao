import { loadEnvConfig } from "@next/env";
import { defineConfig } from "prisma/config";

// Mesmo carregamento de .env* que o Next usa (inclui .env.local).
loadEnvConfig(process.cwd());

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  // A CLI (migrate, introspect) usa a conexão de sessão. A aplicação usa o pooler de transação em src/server/db.ts.
  // Opcional aqui (não env()): `prisma generate`, que roda no npm ci do CI e da coleta, não conecta ao banco.
  // Comandos que conectam falham com erro claro se DIRECT_URL faltar.
  datasource: { url: process.env.DIRECT_URL },
});
