<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Leilão Tracker — regras do projeto

Antes de criar, alterar ou revisar código, **carregue a skill `leilao-padroes`** (`.claude/skills/leilao-padroes/`). Ela traz o fluxo, as receitas e o checklist.

Documentos: [`SPEC.md`](SPEC.md) (produto) · [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) (system design e decisões) · [`DESIGN.md`](DESIGN.md) (visual) · [`docs/OPERACAO.md`](docs/OPERACAO.md) (deploy, backup e restauração) · [`docs/GUIA.md`](docs/GUIA.md) (guia de uso).

## Sempre

- Camadas: `app` → `features` → `domain`/`server`/`lib`/`components`. `src/domain` é puro. Prisma só em `src/server`, `queries.ts` e `mutations.ts`.
- Toda query e mutation chama `requireUser()` e filtra por `ownerId`. Server Actions validam com Zod e retornam `ActionState`.
- Cache Components ligado: sessão, dados, `params` e `searchParams` ficam dentro de `<Suspense>`. Sem `"use cache"` em dados de domínio sem decisão registrada.
- Dinheiro em `Cents` (inteiro), datas em UTC, exibição via `src/lib/format.ts`.
- Sem `any`, `!`, `@ts-ignore`, memoização manual ou default export fora dos arquivos especiais do Next.
- Código em inglês, UI e docs em pt-BR.
- Padrão novo ou dependência nova: proponha ao usuário e registre em `docs/ARCHITECTURE.md` §15.

## Comandos

- `npm run check`: typecheck + lint + format + testes. Obrigatório ao concluir.
- `npm run build`: obrigatório ao mexer em rotas, config ou fronteira server/client.
- `npm run lint:fix` / `npm run format`: correções automáticas.
