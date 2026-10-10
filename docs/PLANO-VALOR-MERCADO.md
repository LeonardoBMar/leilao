# Plano: valor de mercado para anúncios sem FIPE, e quarta fonte (Detran-MG)

Status: **aprovado em 2026-10-09** (opção B, valor casado usado em estimativas, filtro e Pesquisa com rótulo). Muda D-28 e D-30 (ver §7). Catálogo de preços e correlações: `PLANO-FIPE-TABELAS.md` (D-49).

## 1. Problema

O valor de mercado (`listings.market_value_cents`) alimenta quatro coisas: a proporção lance ÷ mercado nas estimativas (D-36), as premissas padrão do limite (D-38), o filtro "% do mercado" (D-43) e a Pesquisa (D-45). Hoje ele vem só da fonte, e muitas fontes não o têm.

Retrato do catálogo em 09/10/2026:

| Fonte | Anúncios | Com valor de mercado | Observação |
| --- | --- | --- | --- |
| Leilo | 3.082 | 2.515 (82%) | Os sem valor são, na maioria, equipamentos e máquinas |
| Pátio São Carlos | 588 | 533 (91%) | "Valor FIPE" ausente na ficha de alguns lotes |
| Freitas | 650 | **0** | A fonte não informa |
| Detran-MG (nova) | ~2.900 abertos | **0** | A fonte não informa |

Sem valor de mercado, o anúncio fica sem "% do mercado", fora da Pesquisa e, sem 5 vendas comparáveis, sem preço provável nem limite. Na Freitas, que só tem o lance, nenhuma venda entra na proporção.

## 2. Opções avaliadas

| Opção | Como | Prós | Contras |
| --- | --- | --- | --- |
| A. Só o catálogo | Mediana do valor informado pela Leilo e pelo Pátio para a mesma marca, modelo base e ano | Nenhuma dependência externa; cabe em D-28 | Cobre só os modelos que já passaram pela Leilo/Pátio; mistura versões e meses; não ajuda a Detran-MG (motos antigas, carros dos anos 90) |
| **B. Tabela FIPE oficial (recomendada)** | O sistema encontra o veículo na tabela FIPE pela marca, modelo e ano do título e grava o valor com a origem | Cobre quase tudo que tem placa; é o mesmo número que a Leilo e o Pátio já mostram; tem histórico mensal (a venda antiga recebe a FIPE do mês da venda) | Casar título com versão erra às vezes; depende de um serviço externo sem termos de uso publicados (§6) |
| C. APIs de terceiros (Parallelum, BrasilAPI) | O mesmo que B, por um espelho | — | Parallelum limita a 1.000 pedidos/dia; BrasilAPI respondeu 500 ("fonte FIPE indisponível") em 09/10 |

**Recomendação: B**, com origem e precisão gravadas e visíveis. Quando o casamento não for seguro, o anúncio fica sem valor, como hoje: nunca se inventa um número.

Teste de acesso (09/10): `veiculos.fipe.org.br/api/veiculos/*` responde a `POST` simples com o `User-Agent` do coletor, sem desafio. Tabela de outubro/2026 = código 338; marcas, modelos por ano e valor são três chamadas distintas. Não há `robots.txt` (404) e não foram achados termos de uso no site.

## 3. Como o casamento funciona (regra pura, `src/domain/listings/fipe-match.ts`)

1. **Tipo:** categoria do anúncio → carros (1), motos (2) ou caminhões (3). Sem categoria de veículo (equipamentos, sucata inservível sem modelo) → não tenta.
2. **Marca:** normalizada como em `vehicleKey`, mais os prefixos de importação e montadora que as fontes usam (`I/HONDA`, `JTA/SUZUKI`, `Y/YAMAHA`, `GM`, `VW`, `MBENZ`). Marca sem correspondência na lista da FIPE → não tenta.
3. **Ano e combustível:** ano do modelo do anúncio; combustível diesel → código 3, senão 1 (a FIPE agrupa flex em gasolina).
4. **Candidatas:** modelos da marca naquele ano (`ConsultarModelosAtravesDoAno`) cujo **modelo base** é igual ao do anúncio (mesma regra de `vehicleKey`: "GOL 1000I" e "Gol 1.0 Mi Total Flex" são GOL).
5. **Versão:** pontua os demais sinais do título contra cada candidata: cilindrada (`1000I`, `10`, `1.0` → 1.0; `16SE` → 1.6; `GLI18` → 1.8), acabamento (`LTZ`, `FAN`, `ESI`, `SENSE`), câmbio (`AT`, `AUT`, `CVT`) e portas (`4P`). Uma candidata **isolada no topo** → origem `fipe_version`.
6. **Família:** sem vencedora clara, usa a **mediana** das candidatas empatadas no topo → origem `fipe_family`, mas só se forem parecidas (P75 ÷ P25 ≤ 1,35). Se o grupo for disperso (Gol 1.0 e Gol GTI), fica sem valor.
7. **Mês de referência:** anúncio aberto → mês da primeira coleta; anúncio já encerrado (backfill) → mês do fim. A FIPE mantém as tabelas antigas, então a venda de abril recebe a FIPE de abril.

Teste com títulos reais de cada fonte em fixtures (Freitas, Detran-MG, Pátio sem FIPE), incluindo os casos que devem **ficar sem valor**.

## 4. Modelo de dados (migration)

- `listings.market_value_origin` (enum `MarketValueOrigin`: `source`, `fipe_version`, `fipe_family`; nulo quando não há valor). A migration marca como `source` todo anúncio que já tem valor.
- `listings.market_value_fipe_code` e `listings.market_value_ref_month` (`date`, primeiro dia do mês): de onde veio o número, para mostrar e auditar.
- `listings.market_value_checked_at`: última tentativa de casamento. Nulo = pendente. Evita repetir a busca a cada execução; volta a nulo quando o título, o ano ou a categoria mudam.
- Tabela global `fipe_responses` (chave do pedido, resposta JSON, data): cache das respostas da FIPE. Tabela de mês passado não muda, então o cache não expira; a do mês corrente vale até a virada do mês. RLS ligado e sem acesso pela API de dados, como as demais tabelas do catálogo (D-14, D-25).
- `market_value_cents` continua sendo o número usado em todo lugar (inclusive na coluna gerada `market_ratio_bps`), agora com a origem ao lado.

**Preenchimento dos que estão sem valor.** O SQL da migration não chama a FIPE. Por isso o preenchimento é feito por código: `npm run db:market-values` processa todos os anúncios pendentes (~4.200 com a Detran-MG) e retoma de onde parou se for interrompido. Depois disso, o coletor casa os anúncios novos a cada execução, com um limite de pedidos.

**Volume estimado:** um pedido de modelos por (marca, ano, mês) e um de valor por versão candidata, com tudo guardado no cache. No backfill inicial, alguns milhares de pedidos, a 1 por segundo (~1 a 2 h, rodando no computador do usuário). Depois, dezenas por execução.

## 5. Onde aparece e como pesa

- **Cartão e detalhe do anúncio:** "Mercado R$ X" ganha o rótulo da origem: "da fonte", "FIPE out/2026" (versão casada) ou "FIPE out/2026 · versão aproximada" (família).
- **Rascunho de "Adicionar à análise" (D-30):** o valor entra no campo FIPE com a referência preenchida (mês e "FIPE, casada pelo sistema" ou "informada pela fonte"). O usuário revisa antes de fixar.
- **Estimativas, filtro e Pesquisa:** usam o valor seja qual for a origem. A proporção lance ÷ mercado ganha as vendas da Freitas e da Detran-MG, o que é o ganho principal. A Pesquisa mostra quantas vendas da amostra têm valor casado pelo sistema.

## 6. Riscos

| Risco | Mitigação |
| --- | --- |
| Termos de uso da FIPE não encontrados; uso em volume costuma ser licenciado | Uso privado, volume baixo e cache permanente (cada valor é pedido uma vez); `User-Agent` identificado; chave para desligar (`FIPE_LOOKUP_ENABLED`). Se a FIPE bloquear, nada quebra: os anúncios ficam sem valor, como hoje |
| Casamento errado de versão | Origem e código FIPE visíveis; regra de dispersão da família; fixtures com títulos reais; conferência manual de 50 casamentos antes de ligar no coletor (meta: ≥ 90% com o modelo base certo e a versão plausível) |
| Pedidos lentos travarem a coleta | Limite de tempo e de pedidos por execução, separado do das fontes (D-41) |

## 7. Decisões a registrar (ARCHITECTURE §15)

- **D-47 (refina D-28 e D-30):** o valor de mercado de anúncio sem FIPE da fonte é **casado pelo sistema na tabela FIPE oficial**, com origem, código e mês gravados e rotulados. É referência, não estimativa: as estimativas continuam saindo só de vendas observadas e análises fixadas. A FIPE externa passa de "alternativa rejeitada" (D-28) a referência de valor.
- **D-48:** quarta fonte, Detran-MG (levantamento em `PLANO-COLETA.md` §2.8).

## 8. Etapas

1. **Adaptador Detran-MG** (`src/sources/detran-mg/`), independente do resto: descoberta pela página inicial e pelas listas (8 por página), página do lote, consulta `PDO/updateCountdown.php` em lote para lance, fim e desfecho; revisita depois do fim pela consulta; arrematante e CPF no nome do pátio descartados. Fixtures e testes; `npm run check` e `npm run build`.
2. **Migration** com as colunas, o enum e o cache (§4); `market_value_origin = 'source'` nos que já têm valor.
3. **Casamento puro** (`fipe-match.ts`) com testes de fixtures das quatro fontes.
4. **Cliente FIPE** em `src/server/fipe/` (pedidos educados, cache em `fipe_responses`, Zod nas respostas) e **enriquecimento** no coletor, com limite por execução.
5. **Preenchimento**: `npm run db:market-values`; conferência manual de 50 casamentos.
6. **Interface**: rótulo da origem no cartão, no detalhe, no rascunho da análise e na Pesquisa.
7. **Documentos**: D-47 e D-48, GUIA (o que significa cada rótulo), OPERACAO (rodar o preenchimento).
