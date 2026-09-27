---
name: leilao-padroes
description: Padrão obrigatório de desenvolvimento do Leilão Tracker (Next.js 16 + Cache Components, React 19, TypeScript estrito, Zod, Prisma/Supabase). Use SEMPRE antes de criar ou alterar código neste repositório — páginas, layouts, componentes, Server Actions, queries/mutations, schemas, regras de domínio, testes, configs — e ao revisar código. Traz o fluxo de trabalho, as regras invioláveis, receitas de arquivo e o checklist de conclusão.
---

# Padrões do Leilão Tracker

Esta skill é o manual de execução do [`docs/ARCHITECTURE.md`](../../../docs/ARCHITECTURE.md), que é a fonte de verdade das decisões. Produto: [`SPEC.md`](../../../SPEC.md). Visual: [`DESIGN.md`](../../../DESIGN.md) e [`src/components/ui/README.md`](../../../src/components/ui/README.md).

## Fluxo de trabalho

1. **Entender.** Localize a seção do SPEC e as camadas afetadas no ARCHITECTURE (§3 camadas, §4 pastas).
2. **Consultar a doc do Next instalada**, e não a memória. Para cada API do Next que for usar, leia o guia correspondente em `node_modules/next/dist/docs/`. O mapa de páginas úteis está em [references/nextjs.md](references/nextjs.md).
3. **Planejar por camada:** `domain` (regra pura) → `schemas` → `mutations`/`queries` → `actions` → `components` → `app` (rota). Comece pelo que é puro e testável.
4. **Implementar com as receitas** em [references/receitas.md](references/receitas.md). Copie a forma e não invente variações.
5. **Aplicar as regras de TypeScript** de [references/typescript.md](references/typescript.md).
6. **Testar** conforme [references/testes.md](references/testes.md). Regra de domínio nova sem teste não está pronta.
7. **Verificar:** `npm run check` sempre, e `npm run build` quando tocar rotas, config ou fronteira server/client. Para UI, abra no navegador com `npm run dev` e confira o dev overlay: *blocking route* e erros de hidratação são falhas.
8. **Revisar** com [references/checklist.md](references/checklist.md) antes de declarar concluído.

## Regras invioláveis

1. **Camadas:** `app` → `features` → `domain`/`server`/`lib`/`components`, nunca o contrário. `src/domain` é TypeScript puro. Prisma só em `src/server`, `queries.ts` e `mutations.ts`. O ESLint verifica.
2. **Segurança na DAL.** Toda query e mutation chama `requireUser()` e filtra por `ownerId`. Server Actions são endpoints públicos: validam a entrada com Zod e nunca aceitam dono, status ou saídas calculadas vindas do cliente.
3. **DTOs mínimos.** `select` explícito. Nunca passar registro do Prisma para Client Component nem retorná-lo de action.
4. **Cache Components.** Leitura de sessão, dados, `params` ou `searchParams` fica dentro de `<Suspense>` com `Skeleton`. Nada de `await` de sessão no topo de layout. Sem `"use cache"` em dados de domínio (D-04) sem registrar decisão.
5. **Server first.** `"use client"` só na folha que precisa de estado, efeito, evento ou API do navegador. Client Components não são `async`.
6. **Erros:** falha esperada é valor (`ActionState`, `Result`), falha inesperada é exceção (`error.tsx`). `redirect()`/`notFound()` nunca dentro de `try/catch`.
7. **Dinheiro é `Cents`** (inteiro), taxa é basis points, data é `Date` UTC. Conversão e formatação só na borda (`parseBRL`, `formatBRL`, `formatDateTime`).
8. **Análise fixada e revisão de resultado são imutáveis.** Correção cria nova versão ou revisão, em transação.
9. **Sem memoização manual** (React Compiler), sem `any`, sem `!`, sem `as` para silenciar erro, sem promise solta.
10. **Named exports**, exceto onde o Next exige default. Código em inglês, textos de UI em pt-BR, arquivos em `kebab-case`.
11. **UI só com `@/components/ui`** e tokens do DESIGN.md. Sem cor literal ou espaçamento arbitrário. Todo campo tem label e erro associado.
12. **Não adicionar dependência** sem justificar no ARCHITECTURE (registro de decisões). Versões fixas (`--save-exact`).

## Skills de terceiros no projeto

Instaladas por `npx skills add` (versões em `skills-lock.json`; atualize com `npx skills update -p`). São referência de API e boas práticas; **em conflito, esta skill e o ARCHITECTURE prevalecem**.

| Skill | Use para | Ignore dela |
| --- | --- | --- |
| `prisma-cli` | Comandos `migrate`, `db`, `generate` e o protocolo de consentimento para comandos destrutivos | `dotenv` e `prisma init` (o projeto usa `@next/env` e já está configurado) |
| `prisma-client-api` | Filtros, relações, transações, `$queryRaw` seguro | `process.env` direto e cliente instanciado fora de `src/server/db.ts` |
| `prisma-database-setup` | Detalhes de conexão PostgreSQL e adapter | Caminhos de `output` (o nosso é `src/generated/prisma`) |
| `supabase` | Auth com `@supabase/ssr`, Storage, checklist de segurança, depuração | Fluxo de schema pela Supabase CLI ou MCP (`supabase migration`, `db pull`, `apply_migration`). **Schema só por migrations do Prisma.** |
| `supabase-postgres-best-practices` | Tipos de coluna, índices, constraints, locks, pooling | Políticas RLS por usuário (o acesso a dados é só pelo servidor, ver D-14) |

**Nunca** rode `migrate reset`, `db push --force-reset` ou `--accept-data-loss` sem consentimento explícito do usuário imediatamente antes, conforme `prisma-cli/references/agent-safety.md`.

## Quando o padrão não cobre o caso

Siga a documentação do Next instalada e o espírito do ARCHITECTURE. Se a solução criar um padrão novo (nova pasta, nova lib, novo tipo de cache, exceção a uma regra), **pare e proponha** a decisão ao usuário. Depois de aprovada, registre-a em `docs/ARCHITECTURE.md` §15 e atualize esta skill.
