import { spawnSync } from "node:child_process";

const result = spawnSync(
  "npx",
  ["vitest", "run", "src/features/auctions/mutations.int.test.ts", "src/features/results/mutations.int.test.ts"],
  {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env, DB_INT_TESTS: "1" },
  },
);

process.exit(result.status ?? 1);
