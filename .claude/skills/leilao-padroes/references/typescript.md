# TypeScript e JavaScript

Configuração: `strict` + `noUncheckedIndexedAccess`, `noImplicitReturns`, `noImplicitOverride` e `noFallthroughCasesInSwitch` (`tsconfig.json`). O ESLint com informação de tipos cobre o resto (`eslint.config.mjs`).

## Tipos

- **Inferir o que é óbvio e anotar as fronteiras.** Funções exportadas declaram o tipo de retorno, sobretudo queries, mutations e actions. Variáveis locais são inferidas.
- **`type` em vez de `interface`**, que é o estilo do projeto. `interface` só para *declaration merging*.
- **Uniões discriminadas para estados** (`{ kind: "viable" } | { kind: "not_viable" }`, `ActionState`, `Result`), com `switch` exaustivo (o ESLint cobra).
  - Nada de flags booleanas combinadas (`isLoading && !isError && data`).
- **Uniões de literais em vez de `enum`:** `type Outcome = "sold" | "unsold" | "cancelled"`. A lista em runtime é um array `as const` e o tipo vem dela (`(typeof OUTCOMES)[number]`).
- **Tipos de marca** para valores que não podem se misturar: `Cents`. Crie a marca só pela função construtora.
- **`satisfies` para validar objetos sem perder o tipo literal:** `const MESSAGES = {...} satisfies Record<ErrorCode, string>`.
- **Proibido:** `any` (use `unknown` e estreite), `!` não nulo (trate o caso) e `as` para calar o compilador.
  - `as` é aceitável só em `as const`, `as Route` (typed routes) e dentro de funções construtoras de marca.
- **`@ts-ignore` é proibido.** `@ts-expect-error` só com comentário do motivo e em teste.
- **Tipos derivados em vez de duplicados:** `z.infer<typeof schema>`, `Pick`/`Omit`, `Awaited<ReturnType<typeof fn>>`.
- **`readonly` e `ReadonlyArray`** em parâmetros que a função não deve alterar, principalmente no domínio.
- **Acesso por índice retorna `T | undefined`** (`noUncheckedIndexedAccess`). Trate com guarda, `??` ou desestruturação com padrão.

## Imports e módulos

- **Named exports.** Default só nos arquivos especiais do Next e configs.
- **`import type` ou `type` inline para tipos** (o ESLint corrige com `--fix`).
- **Ordem** (o ESLint corrige): pacotes → `@/…` → relativos, com linha em branco entre grupos.
- **Alias `@/`** para outra camada. Caminho relativo **só dentro da mesma feature ou pasta**.
- **Sem barrels** novos (`index.ts` reexportando tudo), exceto o já existente `@/components/ui`. Barrels atrapalham o tree-shaking e a fronteira server/client.

## JavaScript moderno

- `const` por padrão. `let` só quando há reatribuição. Nunca `var`.
- `===` sempre (`== null` é permitido para `null | undefined`).
- `??` para padrão de ausência (não `||`, que engole `0` e `""`). `?.` para acesso opcional.
- Imutabilidade: `map`/`filter`/`toSorted`/`toSpliced`, *spread* e `structuredClone`, sem mutar argumentos.
- `async`/`await` com toda promise tratada: `await`, `return` ou `void` explícito em evento de UI. `Promise.all` para trabalho independente.
- Funções pequenas com nome que diz o efeito (`calculateMaxBid`, `fixAnalysis`). *Early return* em vez de `if` aninhado.
- Datas: `Date` em UTC internamente e `Intl` com `timeZone: "America/Sao_Paulo"` para exibir (`src/lib/format.ts`). Nada de biblioteca de data sem decisão registrada.
- Números monetários: nunca `parseFloat` em valor digitado. Use `parseBRL` e aritmética inteira em `Cents`.

## Comentários e nomes

- **Comentário explica o porquê** ou a regra de negócio (com referência ao SPEC, ex.: `// SPEC §7.2`). Não repete o código.
- **JSDoc curto em funções exportadas** de `domain`, `lib` e DAL quando o contrato não é óbvio.
- **Booleanos** com `is`/`has`/`can` (`isFollowed`, `hasResult`). **Handlers** com `handle…` e props de evento com `on…`.
- **Sem abreviações obscuras.** `auction`, não `auc`. `formData`, não `fd`.
