import { spawnSync } from "node:child_process";

const result = spawnSync(
  "npx",
  ["vitest", "run", "src/server/fipe/catalog.test.ts", "src/features/research/queries.test.ts"],
  {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env, DB_TESTS: "1" },
  },
);

process.exit(result.status ?? 1);
