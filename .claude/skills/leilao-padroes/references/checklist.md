# Checklist de conclusão e revisão

Use antes de declarar uma tarefa concluída e ao revisar código. Item não aplicável: ignore. Item falhando: corrija ou explique ao usuário.

## Verificação automática

- [ ] `npm run check` passa (typecheck, lint, format, testes).
- [ ] `npm run build` passa, se tocou rotas, `next.config.ts`, proxy ou fronteira server/client.
- [ ] UI conferida no navegador (`npm run dev`), sem alerta no dev overlay (blocking route, hidratação) e sem erro no console.

## Arquitetura

- [ ] Cada arquivo está na camada certa (ARCHITECTURE §3/§4). Nenhum import no sentido proibido.
- [ ] Regra de negócio nova está em `src/domain`, pura e testada, e não duplicada em componente ou mutation.
- [ ] Nenhum padrão novo sem decisão registrada em ARCHITECTURE §15.

## Segurança e dados

- [ ] Toda query e mutation chama `requireUser()` e filtra por `ownerId`.
- [ ] Toda Server Action valida a entrada com Zod e não aceita dono, status ou valores calculados do cliente.
- [ ] Nenhum objeto do Prisma chega ao cliente ou ao retorno de action; DTOs com `select` explícito.
- [ ] Escritas compostas estão em transação. Análise fixada e revisão de resultado não são alteradas.
- [ ] Nenhum segredo fora de `src/server/env.ts`. Nenhuma variável sem `NEXT_PUBLIC_` usada no cliente.

## Next.js / React

- [ ] Acesso a sessão, dados, `params` e `searchParams` dentro de `<Suspense>` com fallback de `Skeleton`.
- [ ] `"use client"` só onde necessário. Nenhum Client Component `async`.
- [ ] `redirect`/`notFound` fora de `try/catch`. Depois da mutation, `redirect` ou `refresh`.
- [ ] Links internos com `<Link>` tipado. Sem `useMemo`/`useCallback`/`memo` manuais.

## Código

- [ ] Sem `any`, `!`, `as` indevido, `@ts-ignore` ou promise solta.
- [ ] Dinheiro em `Cents`, taxa em bps, datas UTC, formatação por `src/lib/format.ts`.
- [ ] Nomes em inglês, textos de UI em pt-BR, arquivos `kebab-case`, named exports.

## UI e acessibilidade (DESIGN.md)

- [ ] Só primitivas de `@/components/ui` e tokens. Sem cor literal ou espaçamento arbitrário.
- [ ] Todo campo com label e erro associado. Botão só com ícone tem `aria-label`.
- [ ] Estados vazio, carregando e erro cobertos. Layout funciona abaixo de `md`.

## Commits (quando o usuário pedir)

Conventional Commits em português, escopo = feature:

```text
feat(lotes): permite acompanhar lote pela lista
fix(analises): corrige arredondamento da comissão percentual
refactor(dal): extrai requireUser para server/auth
test(finance): cobre exemplo 7.4 do SPEC
docs(arquitetura): registra decisão D-13
chore(deps): fixa prisma 7.x
```

Um commit por mudança coerente, sem misturar refactor e feature.
