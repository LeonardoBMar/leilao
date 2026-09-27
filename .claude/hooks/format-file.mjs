// Hook PostToolUse (Edit|Write): aplica `eslint --fix` e Prettier no arquivo que o Claude acabou de alterar.
// Nunca bloqueia: o que sobrar de erro aparece no `npm run check`.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

const projectDir = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const eslintBin = path.join(projectDir, "node_modules", "eslint", "bin", "eslint.js");
const prettierBin = path.join(projectDir, "node_modules", "prettier", "bin", "prettier.cjs");
const lintable = new Set([".ts", ".tsx", ".mts", ".js", ".mjs", ".cjs"]);

function run(bin, args) {
  try {
    execFileSync(process.execPath, [bin, ...args], { cwd: projectDir, stdio: "ignore", timeout: 30_000 });
  } catch {
    // Erro restante de lint ou arquivo que a ferramenta não entende: o `npm run check` reporta.
  }
}

const input = JSON.parse(readFileSync(0, "utf8"));
const filePath = input.tool_input?.file_path;

if (typeof filePath === "string") {
  const absolute = path.resolve(projectDir, filePath);
  const relative = path.relative(projectDir, absolute);
  const insideProject = relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);

  if (insideProject && !relative.startsWith("node_modules")) {
    if (lintable.has(path.extname(absolute))) run(eslintBin, ["--fix", "--no-warn-ignored", absolute]);
    run(prettierBin, ["--write", "--ignore-unknown", "--log-level", "silent", absolute]);
  }
}
