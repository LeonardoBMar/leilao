// `npm run dev:local`: servidor de desenvolvimento só neste computador (127.0.0.1:3100), com o login
// desligado se o .env.local tiver DEV_AUTH_BYPASS=true e DEV_AUTH_USER_ID (D-31, src/lib/dev-auth.ts).
// Porta própria: o E2E reaproveita o servidor da 3000 e precisa do login de verdade.
import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const nextBin = createRequire(import.meta.url).resolve("next/dist/bin/next");
const child = spawn(process.execPath, [nextBin, "dev", "--hostname", "127.0.0.1", "--port", "3100"], {
  stdio: "inherit",
  env: { ...process.env, DEV_AUTH_LOOPBACK: "1" },
});

for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("exit", (code) => process.exit(code ?? 1));
