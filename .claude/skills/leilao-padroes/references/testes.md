# Testes

| Nível | Ferramenta | O que testar | Onde |
| --- | --- | --- | --- |
| Unitário | Vitest (`npm test`) | `src/domain` (obrigatório), `src/lib`, schemas Zod, componentes síncronos | `arquivo.test.ts(x)` ao lado do arquivo |
| Integração | Vitest + banco de teste | Mutations/queries: unicidade, versões imutáveis, isolamento por `ownerId`, transações | `arquivo.int.test.ts` (a configurar com o banco) |
| E2E | Playwright (`@playwright/test` + `@next/playwright`) | Fluxo login → leilão → lote → análise fixada → resultado → dashboard, critérios de aceite de interface, casca estática com `instant()` | `tests/e2e/*.spec.ts` |

## Regras

- **Todo código novo em `src/domain` nasce com teste.**
  - Casos do SPEC como exemplos nomeados.
  - Bordas: zero, arredondamento de centavo, entrada incompleta e "sem lance viável".
- **Teste comportamento público**, não detalhe interno. Um teste falha por um motivo.
- **Nomes de teste em português**, descrevendo a regra: `it("não sugere lance quando custos superam o valor de mercado")`.
- `it.each` para tabelas de casos, que é o formato natural das regras financeiras.
- **Sem rede, relógio real ou aleatoriedade.** Datas entram como argumento. Se precisar, use `vi.useFakeTimers()`.
- **Componentes:**
  - `renderToStaticMarkup` para marcação e acessibilidade estática;
  - Testing Library + jsdom (`// @vitest-environment jsdom` no arquivo) quando houver interação. Instalar na primeira necessidade e registrar.
- **Async Server Components** não são testados com Vitest (limitação documentada pelo Next): cobrir com E2E.
- `server-only` é substituído por um stub nos testes (`tests/stubs/server-only.ts`), então queries e mutations podem ser importadas em testes de integração.
- **Teste com banco, só leitura (D-45):** consulta com SQL próprio (`$queryRaw`) ganha um teste que roda contra o banco só com `DB_TESTS=1` (`describe.skipIf(process.env.DB_TESTS !== "1")`), carregando o `.env.local` com `process.loadEnvFile` (o Next não o carrega com `NODE_ENV=test`). Nada de escrita: só `SELECT`. Rode com `DB_TESTS=1 npx vitest run <pasta>` ao mexer no SQL; o `npm run check` pula esses testes. Exemplos: `src/server/vehicle-key-sql.test.ts` e `src/features/research/queries.test.ts`.
- **Bug corrigido ganha um teste de regressão** que falha antes da correção.

## E2E (Playwright)

- **Projetos** (`playwright.config.ts`): `public` (sem sessão), `setup` (login único, sessão salva em `tests/e2e/.auth/`, fora do Git) e `authenticated` (fluxo e acesso).
- **Usuário de testes dedicado:** `E2E_EMAIL`/`E2E_PASSWORD` no `.env.local`. Sem eles, os testes autenticados são pulados. **O agente não roda o projeto autenticado**, porque exigiria digitar credenciais enviadas ao Supabase. Quem roda é o usuário.
- **Dados reais:** cada execução cria um leilão `E2E <data>` e o arquiva no final. Análises fixadas e resultados são imutáveis, então ficam no usuário de testes.
- **Seletores por papel e rótulo** (`getByRole`, `getByLabel` com `exact`), nunca por classe CSS. Select do Radix: helper `choose()`. Valores em reais: helper `brl()` (o Intl usa espaço não separável).
- **Casca estática** de rotas: `instant()` de `@next/playwright`, com `baseURL` quando `page.goto` é a primeira navegação.

## Comandos

```bash
npm test               # execução única
npm run test:watch     # modo watch
npx vitest run src/domain   # um diretório
npm run test:e2e:public     # E2E sem sessão
npm run test:e2e            # E2E completo (precisa de E2E_EMAIL/E2E_PASSWORD)
```
