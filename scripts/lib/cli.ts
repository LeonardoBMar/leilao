import { loadEnvConfig } from "@next/env";

export function readFlag(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

export function readNumberFlag(name: string): number | undefined {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? Number(process.argv[index + 1]) : Number.NaN;
  return Number.isInteger(value) && value > 0 ? value : undefined;
}

export function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

interface RunCliOptions {
  messageOnly?: boolean;
}

export function runCli(main: () => Promise<void>, options: RunCliOptions = {}): void {
  // As variáveis precisam existir antes de importar o banco (src/server/env.ts valida ao carregar).
  loadEnvConfig(process.cwd(), false, { info: () => undefined, error: console.error });

  void main()
    .catch((error: unknown) => {
      console.error(options.messageOnly && error instanceof Error ? error.message : error);
      process.exitCode = 1;
    })
    .finally(async () => {
      try {
        const { disconnectDb } = await import("@/server/disconnect");
        await disconnectDb();
      } catch {
        // Ignora se o ambiente falhou antes da criação do cliente.
      }
    });
}
