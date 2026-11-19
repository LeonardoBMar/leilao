import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";

import { Prisma, PrismaClient } from "@/generated/prisma/client";

import { env } from "./env";

function createClient() {
  return new PrismaClient({
    adapter: new PrismaPg({
      connectionString: env.DATABASE_URL,
      max: env.DB_POOL_MAX ?? 5,
      connectionTimeoutMillis: 10_000,
      idleTimeoutMillis: 20_000,
    }),
  });
}

// Reaproveita o cliente entre recargas do HMR em desenvolvimento.
const globalForPrisma = globalThis as typeof globalThis & { prisma?: PrismaClient };

export const db = globalForPrisma.prisma ?? createClient();

if (env.NODE_ENV !== "production") globalForPrisma.prisma = db;

/** Violação de restrição UNIQUE (ex.: número de lote repetido no mesmo leilão). */
export function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/** Violação de chave estrangeira (ex.: excluir leilão que ainda tem lotes). */
export function isForeignKeyViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003";
}
