# Testes

| Nível | Ferramenta | O que testar | Onde |
| --- | --- | --- | --- |
| Unitário | Vitest (`npm test`) | `src/domain` (obrigatório), `src/lib`, schemas Zod, componentes síncronos | `arquivo.test.ts(x)` ao lado do arquivo |
| Integração | Vitest + banco de teste | Mutations/queries: unicidade, versões imutáveis, isolamento por `ownerId`, transações | `arquivo.int.test.ts` (a configurar com o banco) |
| E2E | Playwright | Fluxo login → leilão → lote → análise fixada → resultado → dashboard. Async Server Components. | `tests/e2e/` (a configurar) |

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
- **Bug corrigido ganha um teste de regressão** que falha antes da correção.

## Comandos

```bash
npm test               # execução única
npm run test:watch     # modo watch
npx vitest run src/domain   # um diretório
```
