// Hook PreToolUse (Edit|Write|NotebookEdit): impede o Claude de alterar segredos, dados reais,
// arquivos gerados e migrations já versionadas. Sai com código 2 para bloquear e explicar o motivo.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

const projectDir = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();

const rules = [
  {
    test: (p) => /^\.env(\..+)?$/.test(p) && p !== ".env.example",
    reason: "arquivos .env guardam segredos reais. Altere .env.example ou peça ao usuário para editar.",
  },
  { test: (p) => p.startsWith("backups/"), reason: "backups/ contém dados reais de produção." },
  { test: (p) => p.startsWith("src/generated/"), reason: "src/generated/ é gerado pelo `prisma generate`." },
  {
    test: (p) => p === "package-lock.json",
    reason: "package-lock.json é gerado pelo npm. Use `npm install --save-exact`.",
  },
  {
    test: (p) => p === "next-env.d.ts" || p.endsWith(".tsbuildinfo"),
    reason: "arquivo gerado pelo Next/TypeScript.",
  },
  {
    test: (p) => p === "prisma/migrations/migration_lock.toml",
    reason: "migration_lock.toml é mantido pelo Prisma.",
  },
  {
    // Migration recém-criada (`migrate dev --create-only`) ainda pode receber SQL manual (D-16).
    // Depois de versionada, já foi aplicada em algum banco e não pode mudar: crie outra migration.
    test: (p) => p.startsWith("prisma/migrations/") && isTracked(p),
    reason: "migration versionada é imutável. Crie uma nova com `npx prisma migrate dev --create-only`.",
  },
];

function isTracked(relativePath) {
  try {
    execFileSync("git", ["ls-files", "--error-unmatch", relativePath], { cwd: projectDir, stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

const input = JSON.parse(readFileSync(0, "utf8"));
const filePath = input.tool_input?.file_path ?? input.tool_input?.notebook_path;

if (typeof filePath === "string") {
  const relative = path.relative(projectDir, path.resolve(projectDir, filePath)).split(path.sep).join("/");
  const blocked = rules.find((rule) => rule.test(relative));

  if (blocked) {
    process.stderr.write(`Bloqueado pelo hook protect-files: ${relative} — ${blocked.reason}\n`);
    process.exit(2);
  }
}
