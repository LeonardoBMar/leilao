# Receitas de arquivo

Formas canônicas de cada tipo de arquivo. O exemplo usa a feature `auctions` (leilões); troque nomes e campos e mantenha a estrutura. Os módulos de infraestrutura (`@/server/db`, `@/server/auth`) aparecem como serão criados na fundação (ARCHITECTURE §16).

Ordem de criação de uma feature: `schemas.ts` → `types.ts` → `mutations.ts`/`queries.ts` → `actions.ts` → `components/*` → rota em `src/app`.

---

## 1. `features/<f>/schemas.ts` — entrada validada

```ts
import { z } from "zod";

import { entityId, optionalText, requiredText } from "@/lib/schemas";

export const auctionInputSchema = z.object({
  name: requiredText("Informe o nome do leilão."),
  auctioneer: requiredText("Informe o leiloeiro."),
  startsAt: z.coerce.date({ error: "Informe uma data válida." }),
  city: optionalText(),
  noticeUrl: z.url("Informe um link válido.").optional().or(z.literal("").transform(() => undefined)),
});
export type AuctionInput = z.infer<typeof auctionInputSchema>;

export const auctionIdSchema = entityId();

// Filtros de URL: nunca lançam; valor inválido vira padrão.
export const auctionFiltersSchema = z.object({
  status: z.enum(["upcoming", "finished"]).optional().catch(undefined),
  page: z.coerce.number().int().min(1).catch(1),
});
```

- Campos monetários usam `brlAmount()`/`optionalBrlAmount()`/`optionalPositiveBrlAmount()` e já saem como `Cents`. Inteiros: `requiredInt`/`optionalInt`. Checkbox: `checkbox()`. URL: `optionalUrl()`. Data e hora: `zonedDateTime()`. Tudo em `@/lib/schemas`.
- **Zod 4: `.refine` no objeto roda mesmo se um campo já falhou.** A regra cruzada precisa se proteger de campo inválido (ex.: `!Number.isInteger(lot.modelYear) || …`), senão aparece um erro extra e enganoso.
- **Erro de unicidade vira erro do campo** (ex.: `fieldErrors: { lotNumber: [...] }`), não alerta genérico.
- O schema descreve a **entrada do usuário**. Dono, status e campos calculados nunca entram nele.

## 2. `features/<f>/types.ts` — DTOs

```ts
import type { Cents } from "@/domain/money";

export type AuctionListItem = {
  id: string;
  name: string;
  auctioneer: string;
  startsAt: Date;
  lotCount: number;
};

export type AuctionDetail = AuctionListItem & {
  city: string | null;
  noticeUrl: string | null;
  totalStartingBid: Cents;
};
```

DTO = exatamente o que a UI usa, com tipos serializáveis. Sem tipos do Prisma aqui.

## 3. `features/<f>/queries.ts` — leitura (DAL)

```ts
import "server-only";

import { requireUser } from "@/server/auth";
import { db } from "@/server/db";

import type { AuctionDetail, AuctionListItem } from "./types";

export async function listAuctions(filters: AuctionFilters): Promise<AuctionListItem[]> {
  const user = await requireUser();
  const rows = await db.auction.findMany({
    where: { ownerId: user.id, archivedAt: null /* + filtros */ },
    orderBy: { startsAt: "asc" },
    select: { id: true, name: true, auctioneer: true, startsAt: true, _count: { select: { lots: true } } },
  });
  return rows.map(({ _count, ...row }) => ({ ...row, lotCount: _count.lots }));
}

/** Devolve `null` para inexistente ou de outro dono; quem renderiza decide `notFound()`. */
export async function getAuction(id: string): Promise<AuctionDetail | null> {
  const user = await requireUser();
  const row = await db.auction.findFirst({ where: { id, ownerId: user.id }, select: { /* campos do DTO */ } });
  return row ? toAuctionDetail(row) : null;
}
```

- `requireUser()` na primeira linha de **toda** função exportada.
- `where` sempre com `ownerId: user.id`.
- `select` explícito e mapeamento para DTO.
- Consultas independentes com `Promise.all`.

## 4. `features/<f>/mutations.ts` — escrita (DAL)

```ts
import "server-only";

import { err, ok, type Result } from "@/lib/result";
import { requireUser } from "@/server/auth";
import { db, isUniqueViolation } from "@/server/db";

import type { AuctionInput } from "./schemas";

export type UpdateAuctionError = "not_found" | "duplicate_name";

export async function updateAuction(
  id: string,
  input: AuctionInput,
): Promise<Result<{ id: string }, UpdateAuctionError>> {
  const user = await requireUser();
  try {
    // updateMany com ownerId: autorização e escrita na mesma consulta.
    const { count } = await db.auction.updateMany({ where: { id, ownerId: user.id }, data: input });
    return count === 0 ? err("not_found") : ok({ id });
  } catch (error) {
    if (isUniqueViolation(error)) return err("duplicate_name");
    throw error;
  }
}
```

- **Sem falha de negócio possível** (ex.: criar leilão), a mutation devolve o valor direto, sem `Result<T, never>`.
- `try/catch` só para **traduzir** erro conhecido do banco. O resto é relançado.
- **No `update`, opcionais ausentes viram `null` explicitamente**, porque `undefined` faz o Prisma manter o valor antigo. Use uma função `to<Entity>Data(input)`.
- Operações com mais de uma escrita usam `db.$transaction(async (tx) => { ... })`.
- Regra de negócio (cálculo, elegibilidade) vem de `src/domain` e nunca é reimplementada aqui.

## 5. `features/<f>/actions.ts` — Server Actions

```ts
"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";

import { type ActionState, failure, validationError } from "@/lib/action-state";

import { createAuction, updateAuction, type UpdateAuctionError } from "./mutations";
import { auctionIdSchema, auctionInputSchema } from "./schemas";

const UPDATE_ERRORS = {
  not_found: "Leilão não encontrado.",
  duplicate_name: "Já existe um leilão com este nome.",
} satisfies Record<UpdateAuctionError, string>;

export async function createAuctionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = auctionInputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error, formData);

  const auction = await createAuction(parsed.data);
  redirect(`/leiloes/${auction.id}`); // fora de try/catch; encerra a action
}

// Recebe o id por .bind(null, id) no componente.
export async function updateAuctionAction(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsedId = auctionIdSchema.safeParse(id);
  const parsed = auctionInputSchema.safeParse(Object.fromEntries(formData));
  if (!parsedId.success) return failure(UPDATE_ERRORS.not_found);
  if (!parsed.success) return validationError(parsed.error, formData);

  const result = await updateAuction(parsedId.data, parsed.data);
  if (!result.ok) return failure(UPDATE_ERRORS[result.error], formData);

  refresh(); // mesma rota: re-renderiza com os dados novos na mesma resposta
  return { status: "success", message: "Leilão atualizado." };
}
```

- A action é um **adaptador fino**: parse → mutation → tradução do erro → `redirect`/`refresh`.
- Mapa de mensagens com `satisfies Record<ErrorUnion, string>`. Um erro novo sem mensagem quebra a compilação.
- Nunca retorne dados do banco. Retorne `ActionState`.

## 6. `features/<f>/components/<nome>-form.tsx` — formulário

```tsx
"use client";

import { useActionState } from "react";

import { Alert, AlertDescription, Button, Input } from "@/components/ui";
import { type ActionState, fieldError, fieldValue, idleState } from "@/lib/action-state";

import type { AuctionDetail } from "../types";

type AuctionFormProps = {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  auction?: AuctionDetail;
};

export function AuctionForm({ action, auction }: AuctionFormProps) {
  const [state, formAction, pending] = useActionState(action, idleState);

  return (
    <form action={formAction} className="grid gap-6">
      {state.status === "error" && !state.fieldErrors ? (
        <Alert variant="error">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}
      <Input
        name="name"
        label="Nome do leilão"
        required
        defaultValue={fieldValue(state, "name") ?? auction?.name}
        error={fieldError(state, "name")}
      />
      <Button type="submit" loading={pending} loadingLabel="Salvando…">
        Salvar leilão
      </Button>
    </form>
  );
}
```

Uso num Server Component: `<AuctionForm action={updateAuctionAction.bind(null, auction.id)} auction={auction} />`.

- **Dois botões no mesmo formulário** (ex.: "Salvar rascunho" e "Fixar análise"): `<Button type="submit" name="intent" value="draft">`. O React 19 inclui o botão acionado no `FormData`, e o schema lê `intent: z.enum([...]).catch("draft")`.
- **Confirmação irreversível em `Dialog`:** o diálogo é renderizado em portal, fora do `<form>`. O botão de confirmar usa `form={formId}` (com `useId()`) mais `name`/`value`, e o diálogo fecha no próprio `onClick`. **Não** feche diálogo com `setState` dentro de `useEffect`: o lint do React Compiler barra.
- **Prévia ao vivo sem controlar cada campo:** `onInput` no `<form>` → `new FormData(form)` → leitura leniente (inválido vira pendente) → função de `src/domain`. O servidor valida com Zod e recalcula (ex.: `features/analyses/read-inputs.ts`).

- `defaultValue` (não controlado) + `fieldValue` para restaurar o que foi digitado após erro.
- `loading={pending}` desde o primeiro render (contrato do `Button`).
- Um componente controlado com `useState` só se justifica quando há prévia em tempo real, como a calculadora. Nesse caso a prévia importa a função de `src/domain`, e o servidor recalcula ao salvar.

## 7. Componente de leitura (async Server Component)

```tsx
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/layout/page-header";
import { formatDateTime } from "@/lib/format";

import { getAuction } from "../queries";
import { auctionIdSchema } from "../schemas";

export async function AuctionDetailView({ params }: { params: Promise<{ id: string }> }) {
  const parsed = auctionIdSchema.safeParse((await params).id);
  if (!parsed.success) notFound();

  const auction = await getAuction(parsed.data);
  if (!auction) notFound();

  return (
    <>
      <PageHeader title={auction.name} description={formatDateTime(auction.startsAt)} />
      {/* ... */}
    </>
  );
}
```

## 8. Rota — `src/app/(private)/leiloes/[id]/page.tsx`

```tsx
import { Suspense } from "react";

import { AuctionDetailSkeleton } from "@/features/auctions/components/auction-detail-skeleton";
import { AuctionDetailView } from "@/features/auctions/components/auction-detail-view";

export default function AuctionPage({ params }: PageProps<"/leiloes/[id]">) {
  return (
    <Suspense fallback={<AuctionDetailSkeleton />}>
      <AuctionDetailView params={params} />
    </Suspense>
  );
}
```

- A página **não é `async`** e não faz `await params`. Ela passa a Promise para dentro do `<Suspense>`.
- Conteúdo estático (títulos fixos, botões de navegação) fica fora do Suspense para entrar na shell.
- `metadata` estático por `export const metadata`. `generateMetadata` só se o título depender de dado.

## 9. `loading.tsx`, `error.tsx`, `not-found.tsx`

```tsx
// error.tsx: Client Component obrigatório; `retry` re-busca e re-renderiza o segmento.
"use client";

import { useEffect } from "react";

import { Alert, AlertDescription, AlertTitle, Button } from "@/components/ui";

export default function PrivateError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Alert variant="error">
      <AlertTitle>Algo deu errado</AlertTitle>
      <AlertDescription>
        Não foi possível carregar esta página. {error.digest ? `Código: ${error.digest}` : null}
      </AlertDescription>
      <Button variant="secondary" onClick={() => retry()}>
        Tentar novamente
      </Button>
    </Alert>
  );
}
```

- `loading.tsx` só quando a página inteira depende de dados. Prefira `<Suspense>` granular.
- Para boundary em trecho específico, use `catchError` de `next/error`.

## 10. Regra de domínio — `src/domain/<area>/<regra>.ts`

```ts
import { type Cents, cents } from "@/domain/money";

export const FORMULA_VERSION = 1;

export type MaxBidInput = { marketValue: Cents; fixedCosts: Cents /* ... */ };
export type MaxBidOutcome =
  | { kind: "viable"; maxBid: Cents; totalAtMaxBid: Cents; marginAtMaxBid: Cents }
  | { kind: "not_viable" }
  | { kind: "incomplete"; missing: (keyof MaxBidInput)[] };

export function calculateMaxBid(input: Partial<MaxBidInput>): MaxBidOutcome {
  // puro: sem Date.now(), sem I/O, sem exceção para caso esperado
}
```

Com `<regra>.test.ts` ao lado, cobrindo os exemplos do SPEC e as bordas.

## 11. Infraestrutura e sessão — `src/server/*.ts`

Já implementados; use, não recrie:

| Módulo | Uso |
| --- | --- |
| `@/server/auth` | `requireUser()` na primeira linha de toda query/mutation; `getCurrentUser()` quando a ausência de sessão não deve redirecionar |
| `@/server/db` | `db` (Prisma) e `isUniqueViolation(error)`; só em `queries.ts`/`mutations.ts` |
| `@/server/supabase` | `createSupabaseServerClient()` para Auth/Storage; criar por chamada, nunca em variável de módulo |
| `@/server/env` | Variáveis secretas validadas |
| `@/lib/public-env` | `NEXT_PUBLIC_*` validadas (seguro no cliente) |

- Todo arquivo de `src/server` começa com `import "server-only"`.
- Identidade só por `getClaims()`. **Nunca** use `supabase.auth.getSession()` no servidor para decidir acesso.
- Componente que lê a sessão (direta ou indiretamente) fica dentro de `<Suspense>`.

## 12. Mudança de schema (migration)

1. Edite `prisma/schema.prisma` seguindo as convenções do topo do arquivo: `@@map`/`@map` snake_case, `@db.Uuid`, `@db.Timestamptz(3)`, centavos `Int`, `owner_id` + FK composta `(id, owner_id)` com o pai.
2. `npx prisma migrate dev --create-only --name <verbo_objeto>` para gerar o SQL **sem aplicar**.
3. Revise o SQL e anexe o que o Prisma não modela:
   - CHECKs das regras do SPEC;
   - triggers;
   - para **toda tabela nova**: `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;` e `REVOKE ALL ON TABLE ... FROM anon, authenticated;` (D-14).
4. `npm run db:migrate` para aplicar e gerar o client (no Prisma 7, `migrate dev` sozinho **não** roda `generate`).
5. Verifique drift: `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code` deve sair com 0.
6. Rode `npm run check` e atualize DTOs, queries e mutations afetados.

- **Nunca edite migration já aplicada.** Correção é uma nova migration.
- **Nunca rode `migrate reset` ou `db push`** no banco do Supabase sem consentimento explícito do usuário (veja `prisma-cli/references/agent-safety.md`).
- **Regras que o banco garante** também são validadas na aplicação (Zod e mutation), para gerar mensagem amigável. O banco é a última barreira.
