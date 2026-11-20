# Plano: catálogo de preços FIPE e correlação anúncio → FIPE

Status: **aprovado em 2026-10-09**, com o valor provisório do mês anterior (§5) e a correção por script (§4). Implementado; decisão D-49. Código da versão conferido estável entre as tabelas 320, 337 e 338.

> **Atualização (D-51, 10/10/2026):** a API da FIPE passou a recusar o GitHub Actions (HTTP 403). `fipe_prices` agora guarda a tabela inteira de cada mês, importada do dataset fipeX; a marca é o nome da FIPE e a versão é o código FIPE. Saem o cache como fonte do catálogo (`db:fipe-tables`), o ritmo de pedidos e o valor provisório (§5): sem tabela do mês, vale a anterior, e o anúncio volta à fila quando ela chega. A correlação (§4) continua igual.

## 1. Problema

O casamento do valor de mercado (D-47) guarda as respostas da FIPE em `fipe_responses`: um JSON por pedido, indexado pelo texto do pedido (`valor:338:1:59:2370:2008-1`). Isso basta para não repetir pedidos, mas tem três limites:

1. **Não dá para consultar.** "Quanto vale o Gol 1.0 2012 na FIPE de outubro?" ou "quanto a FIPE desse modelo mudou de setembro para outubro?" exigem abrir JSON e cruzar com outros pedidos (o nome da versão está na lista de modelos, o valor em outro pedido).
2. **O casamento se refaz a cada anúncio.** Dois anúncios "VW/GOL 1.0 2012" escolhem a versão de novo, cada um por conta própria. Um casamento errado não tem onde ser corrigido: a correção teria que ser feita anúncio por anúncio, e a próxima tentativa automática a desfaria.
3. **A virada de mês repete trabalho.** Com a tabela nova (339 em novembro), cada combinação pede de novo marcas, listas de modelos e valores, embora a versão escolhida seja a mesma.

Retrato em 09/10/2026: 3.853 anúncios de veículo, **1.634 combinações** de marca, modelo e ano; o cache tem 905 valores (904 da tabela 338), 740 listas de modelos (275 "não existe") e 6 listas de marcas.

Baixar a FIPE inteira não resolve: são da ordem de 40 a 45 mil valores por mês (estimativa), um pedido cada, e a FIPE recusou com HTTP 429 depois de ~1.500 pedidos a 1 por segundo. No ritmo atual (300 pedidos por coleta) seriam ~12 dias por tabela mensal, quase toda de veículos que não aparecem em leilão.

## 2. Proposta

Duas tabelas novas, alimentadas pelo que já é pedido. Nenhum pedido a mais à FIPE.

| Tabela | Guarda | Muda quando |
| --- | --- | --- |
| `fipe_prices` (catálogo) | Um preço por tabela do mês, versão, ano e combustível, em colunas | A FIPE responde um valor novo |
| `fipe_matches` (correlação) | Para cada veículo como o site escreve (marca, modelo, ano, combustível, categoria), a versão ou família da FIPE escolhida | O casamento roda pela primeira vez, a regra muda ou alguém corrige à mão |

`fipe_responses` continua como **cache bruto dos pedidos** (listas de marcas e modelos, respostas "não existe"). As duas tabelas novas são a parte consultável e a decisão de casamento.

## 3. `fipe_prices`: catálogo de preços

| Coluna | Tipo | Observação |
| --- | --- | --- |
| `id` | uuid | |
| `reference_table` | int | Código da tabela de referência da FIPE (338) |
| `reference_month` | date | Primeiro dia do mês (CHECK, como `market_value_ref_month`) |
| `vehicle_type` | smallint | 1 carros, 2 motos, 3 caminhões (CHECK 1..3) |
| `brand_code` / `brand_name` | text | Código e nome da FIPE ("59", "VW - VolksWagen") |
| `model_code` / `model_name` | text | Código e nome da versão ("2370", "Gol 1.0 Mi 8V") |
| `model_year` | smallint | Ano-modelo |
| `fuel_code` | smallint | 1 gasolina … 6 híbrido (CHECK 1..6) |
| `fipe_code` | text | Código FIPE da versão ("005205-1") |
| `value_cents` | int | CHECK > 0 |
| `fetched_at` | timestamptz | |

- **Único** em `(reference_table, vehicle_type, brand_code, model_code, model_year, fuel_code)`. Índices em `(fipe_code, reference_month)` (evolução de uma versão) e `(vehicle_type, brand_code, model_year)`.
- **Gravação no mesmo passo do cache.** Quando `client.value` recebe um valor novo, grava `fipe_responses` e `fipe_prices` na mesma transação. Nomes de marca e versão vêm das listas já pedidas (marcas e modelos por ano), que o cliente tem em mãos naquele momento.
- **Preenchimento inicial sem rede.** O script lê `fipe_responses` (valores, listas de modelos e marcas) e monta as linhas. Idempotente: pode reconstruir a tabela inteira a qualquer momento.
- Sem acesso pelo cliente: RLS ligada e `REVOKE` de `anon` e `authenticated`, como `fipe_responses` (D-14).

## 4. `fipe_matches`: correlação anúncio → FIPE

Uma linha por **veículo como a fonte escreve**, e não por anúncio.

| Coluna | Tipo | Observação |
| --- | --- | --- |
| `id` | uuid | |
| `vehicle_key` | text | Chave normalizada: marca, modelo, ano, combustível e categoria em maiúsculas e sem espaços duplicados. **Única** |
| `brand`, `model`, `model_year`, `fuel`, `category` | text, int | O que a chave resume, para leitura e correção |
| `kind` | enum `fipe_match_kind` | `version`, `family`, `none` |
| `reason` | text | Motivo do `none` (`no_brand`, `no_candidates`, `too_many`, `spread`, `no_value`) |
| `vehicle_type` / `brand_code` | smallint, text | Nulos no `none` sem marca |
| `models` | jsonb | `[{ code, fuel, label }]`: uma versão, ou as versões da família |
| `origin` | enum `fipe_match_origin` | `auto` ou `manual` |
| `matcher_version` | int | Versão da regra que escolheu (`MATCHER_VERSION` em `fipe-match.ts`) |
| `created_at` / `updated_at` | timestamptz | |

- **O casamento passa a ter duas etapas.** (1) *Escolha*: chave do anúncio → `fipe_matches`; se não existe, ou é `auto` de uma `matcher_version` antiga, roda a regra atual e grava. (2) *Valor*: versões escolhidas + tabela do mês → `fipe_prices`; o que faltar é pedido à FIPE. O cálculo da família (mediana, dispersão ≤ 1,35) continua no domínio (`settleFipeValue`).
- **`listings.fipe_match_id`** (FK opcional, `ON DELETE SET NULL`): diz de qual correlação veio o valor. O valor continua copiado em `listings.market_value_cents`, porque filtros, ordem e a coluna gerada `market_ratio_bps` dependem dele (D-43).
- **Correção à mão.** Gravar `origin = manual` com as versões certas (ou `none`) e recalcular os anúncios ligados a essa correlação que não têm valor da fonte. A regra automática nunca sobrescreve `manual`. Nesta etapa a correção é por script (`npm run db:fipe-match`: listar, ver, corrigir, voltar ao automático); uma tela fica para depois, se o volume pedir.
- **Mudança de regra sem SQL à mão.** Subir `MATCHER_VERSION` faz as correlações `auto` antigas serem refeitas na próxima execução e os anúncios ligados a elas recalculados. Substitui os `update … set market_value_checked_at = null` do OPERACAO.

## 5. Virada de mês

A versão escolhida não muda de um mês para outro. Com a correlação gravada, a tabela nova só precisa dos **valores** (sem marcas nem listas de modelos). Pelas contagens de hoje, isso dá ~900 a 1.000 pedidos por mês para as combinações já vistas, ou ~3 dias de coletas, contra ~1.600 a 2.000 sem a correlação.

**Decisão sua (opcional):** enquanto o valor da tabela nova não chega, um anúncio aberto pode usar o valor do mês anterior que já está em `fipe_prices`, com o mês de referência verdadeiro gravado (o rótulo mostra "FIPE out/2026") e trocado pelo novo quando ele chegar. Sem isso, o anúncio fica sem valor até ser casado. Recomendo usar o mês anterior: o rótulo continua dizendo a verdade, e um mês muda pouco o valor.

**A verificar antes de implementar:** se o código da versão (`model_code`) é estável entre tabelas mensais. A correlação depende disso. São uns 10 pedidos: a mesma marca e o mesmo ano nas tabelas 337 e 338. Se o código mudar, a correlação guarda o `fipe_code` (que é estável por definição) e reencontra o `model_code` de cada mês pela lista de modelos.

## 6. O que não muda

- Valor da fonte sempre prevalece (D-47).
- Os rótulos da tela ("da fonte", "FIPE out/2026", "versão aproximada") e o rascunho da análise.
- O ritmo da FIPE (1 pedido a cada 3 s, 300 por coleta) e a parada no primeiro erro.
- `fipe_responses` como cache dos pedidos.

## 7. Migration e preenchimento

Só expansão (D-22): tabelas novas, enums novos, `listings.fipe_match_id` opcional. Nada é apagado.

1. Backup (`npm run backup`), depois `npm run db:release`.
2. `npm run db:fipe-tables`, **sem rede**: monta `fipe_prices` a partir de `fipe_responses` e `fipe_matches` refazendo a escolha dos anúncios já casados sobre o cache. Liga `listings.fipe_match_id`. Confere que o valor recalculado é igual ao gravado e lista as diferenças em vez de gravar por cima.
3. Na mesma release entra o CHECK adiado de D-47: "origem nula ⇔ sem valor de mercado" (etapa de contração).

## 8. Decisão a registrar

**D-49 — Catálogo de preços e correlação da FIPE** (refina D-47): preços em colunas (`fipe_prices`), escolha de versão por veículo como a fonte escreve (`fipe_matches`) com correção manual que prevalece e versão da regra; `fipe_responses` fica como cache bruto. Recusados: baixar a FIPE inteira (volume e 429), guardar a escolha em cada anúncio (correção anúncio por anúncio) e substituir `fipe_responses` (perderia as listas e os "não existe").

## 9. Etapas

1. Verificar a estabilidade do código da versão entre 337 e 338 (§5).
2. Schema e migration (tabelas, enums, FK, CHECKs, RLS e `REVOKE`).
3. Domínio (`src/domain/listings/fipe-match.ts`): `fipeVehicleIdentity`, `MATCHER_VERSION` e regra de qual valor usar no mês, com testes.
4. Servidor (`src/server/fipe/`): gravação de `fipe_prices` junto com o cache, leitura e gravação de `fipe_matches`, e enriquecimento em duas etapas.
5. Scripts: `db:fipe-tables` (preenchimento sem rede) e `db:fipe-match` (listar e corrigir).
6. Docs: ARCHITECTURE (§4 e D-49), OPERACAO (scripts e correção; sai o SQL à mão), PLANO-VALOR-MERCADO (aponta para este).
7. `npm run check` e `npm run build`; backup; `db:release`; `db:fipe-tables`.

## 10. Riscos

- **Código da versão instável entre meses:** coberto pela verificação da etapa 1 e pelo `fipe_code` como reserva.
- **Chave do veículo larga demais:** dois anúncios com o mesmo texto e veículos diferentes recebem a mesma versão. Já acontece hoje, porque o casamento só olha esse texto; a correção manual passa a valer para os dois.
- **Correção manual errada** se espalha por todos os anúncios da chave. O script mostra quantos anúncios serão afetados antes de gravar.
