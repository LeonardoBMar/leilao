# Next.js 16 neste projeto

Versão instalada: **16.3.x** com Turbopack, `cacheComponents`, `typedRoutes` e `reactCompiler` ligados (ver `next.config.ts`). O conhecimento prévio sobre Next 13–15 está **desatualizado**. Antes de usar uma API, leia o guia em `node_modules/next/dist/docs/01-app/`.

## O que mudou e mais causa erro

| Antes (errado aqui) | Agora (Next 16) |
| --- | --- |
| `middleware.ts` com `export function middleware` | `src/proxy.ts` com `export function proxy`. Runtime Node, sem edge. |
| `params.id` / `searchParams.x` síncronos | `params` e `searchParams` são **Promises**, tipadas com `PageProps<"/rota/[id]">`. |
| `cookies()` / `headers()` síncronos | `await cookies()`, sempre dentro de `<Suspense>`. |
| `export const dynamic = "force-dynamic"`, `revalidate = 60`, `fetchCache` | Não existem com Cache Components. Dinâmico é o padrão, e o cache é explícito com `"use cache"` + `cacheLife` + `cacheTag`. |
| `unstable_cache`, `unstable_noStore` | `"use cache"` e `connection()` |
| `revalidateTag("x")` | `updateTag("x")` em Server Action (read-your-writes) ou `revalidateTag("x", "max")` |
| `router.refresh()` depois de action | `refresh()` de `next/cache` dentro da própria action |
| `error.tsx` com `reset` | Prop **`retry`** (re-busca). `reset` só limpa o estado. |
| Error boundary de classe | `catchError(Fallback)` de `next/error` |
| `useFormState` | `useActionState` de `react` |
| `next lint` | `eslint .` (script `npm run lint`) |
| `experimental.ppr` | Removido; o PPR vem com `cacheComponents` |
| `Math.random()`, `Date.now()` e `new Date()` em render de Server Component | Precisam de `await connection()` antes (e `<Suspense>`), ou devem acontecer no cliente, na action ou vir como argumento |

## Mensagens do dev overlay

- **Blocking route / uncached data outside Suspense:** mova o acesso para um componente filho dentro de `<Suspense fallback={<Skeleton…/>}>`. **Não use** `export const instant = false` como atalho. Se for inevitável, registre a decisão.
- **Sync dynamic API / random value during prerender:** veja a tabela acima.
- **Hydration mismatch:** dado de tempo ou locale diferente entre servidor e cliente. Formate datas com `src/lib/format.ts`, que tem fuso fixo.

## Mapa da documentação (01-app/)

| Assunto | Arquivo |
| --- | --- |
| Server vs Client Components | `01-getting-started/05-server-and-client-components.md`, `02-guides/server-and-client-boundary.md` |
| Buscar dados / streaming | `01-getting-started/06-fetching-data.md`, `02-guides/streaming.md` |
| Mutações / Server Actions | `01-getting-started/07-mutating-data.md`, `02-guides/server-actions.md`, `02-guides/forms.md` |
| Cache Components | `01-getting-started/08-caching.md`, `03-api-reference/01-directives/use-cache*.md` |
| Revalidação | `01-getting-started/09-revalidating.md`, `03-api-reference/04-functions/{updateTag,refresh,revalidatePath}.md` |
| Erros | `01-getting-started/10-error-handling.md`, `03-api-reference/03-file-conventions/error.md`, `04-functions/catchError.md` |
| Autenticação | `02-guides/authentication.md`, `02-guides/authentication-with-cache-components.md` |
| Segurança de dados | `02-guides/data-security.md` |
| Proxy | `01-getting-started/16-proxy.md`, `03-api-reference/03-file-conventions/proxy.md` |
| Navegação instantânea | `02-guides/instant-navigation.md`, `02-guides/preserving-ui-state.md` |
| Variáveis de ambiente | `02-guides/environment-variables.md` |
| Links / typed routes | `03-api-reference/02-components/link.md`, `05-config/02-typescript.md` |
| Imagens | `01-getting-started/12-images.md` (Next 16 mudou `qualities`, `minimumCacheTTL`, `localPatterns`) |
| Metadata | `01-getting-started/14-metadata-and-og-images.md` |
| Testes | `02-guides/testing/vitest.md`, `02-guides/testing/playwright.md` |
| Upgrade 15 → 16 | `02-guides/upgrading/version-16.md` |
| Checklist de produção | `02-guides/production-checklist.md` |

## Regras de uso no projeto

- **Server Components por padrão.** `"use client"` fica na menor folha possível, e o Client Component recebe `children` de Server Components para não puxar a árvore para o bundle.
- **Props de Server para Client precisam ser serializáveis.** Funções só passam se forem Server Actions, e o nome da prop deve ser `action` ou terminar em `Action`.
- **Provider global** (`src/app/providers.tsx`) só para o que é realmente global (tooltip, toaster). Dados não vão em contexto global.
- **`<Link>` para navegação interna**, sem `<a href>`. `router.push` apenas em resposta a evento do cliente.
- **`next/image` para imagens** e `next/font` para fontes (já configurado no layout raiz).
- **Route Handlers** (`route.ts`) só para necessidade concreta: webhook, download de arquivo ou a API JSON. Seguem a mesma DAL e autenticação. A API JSON segue **exatamente** o contrato de `docs/ARCHITECTURE.md` §17 (envelope, códigos de erro, serialização). A tela nunca consome a própria API: ela usa a DAL direto (D-17).
- **Verificação em runtime:** o `next dev` escreve a URL em `.next/dev/lock` e encaminha erros do navegador para o terminal. O MCP de dev fica em `/_next/mcp`.
