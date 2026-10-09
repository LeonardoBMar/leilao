# Plano: Pesquisa de preços do catálogo

Status: **aprovado em 2026-10-08**, com os ajustes da medição (§2). Decisão registrada em `docs/ARCHITECTURE.md` §15 (D-45).

## 1. Problema

O catálogo já guarda o que é preciso para entender o mercado de leilão: lance final das vendas, valor de mercado informado pela fonte (FIPE), condição declarada, UF e município do pátio, ano, km e a sequência de lances (`listing_observations`). Esses dados aparecem hoje só de forma indireta: o preço provável de um anúncio (D-36) e o filtro "% do mercado" (D-43).

O usuário não consegue responder perguntas como:

1. Quanto se paga, de verdade, por um carro de pequena monta?
2. Em que estado o mesmo tipo de veículo sai mais barato?
3. Quanto vale um Gol 2016 sem monta, por ano e km?
4. Quando o lance dispara nas horas finais?
5. Que modelos costumam sair mais abaixo do valor de mercado?

O menu novo **Pesquisa** responde a essas perguntas com gráficos. Ele é descritivo: mostra o que aconteceu nas vendas do catálogo, com amostra e período, e não recomenda compra.

## 2. Medição

Medido em 08/10/2026 no banco de produção, só leitura, com a mesma normalização de modelo das estimativas (`vehicleKey`).

**A base tem 10 dias.** São 1.506 vendas: Leilo 960, Pátio São Carlos 400 e Freitas 146, todas encerradas entre **28/09 e 08/10/2026**. Elas são a base de todos os gráficos. Não existe venda mais antiga, porque a coleta começou nessa data. Um filtro de 3, 6 ou 12 meses daria sempre o mesmo resultado. O volume cresce cerca de 150 vendas por dia.

**Valor de mercado:** 1.231 das 1.506 vendas. A Freitas não informa; as 146 vendas dela entram só nos gráficos em R$.

**Nenhum valor absurdo.** Todas as proporções ficam entre 1% e 200%: o P1 é 12% e o P99 é 78%. Nenhuma venda passou do valor de mercado. Abaixo de 5% há só duas sucatas.

**Mediana do % do valor de mercado por categoria e condição** (vendas com valor de mercado):

| Categoria | Sem monta declarada | Pequena | Média | Sucata |
| --- | ---: | ---: | ---: | ---: |
| Carros | 49% (737) | 50% (19) | 40% (48) | — |
| Motos | 60% (251) | 52% (9) | 43% (11) | — |
| Utilitários | 57% (70) | 51% (4) | 43% (15) | — |
| Sucatas | — | — | — | 17% (64) |

Nenhuma venda de grande monta. A sucata aparece só na categoria "Sucatas". Pequena monta (50%) e "sem monta declarada" (49%) quase empatam nos carros. Isso indica que "sem monta declarada" mistura veículos inteiros com avariados que a fonte não classificou: **o Pátio São Carlos não declara a condição em 399 das 400 vendas**.

**Estados com pelo menos 5 vendas** (com valor de mercado):

| Categoria | Sem monta declarada | Pequena | Média |
| --- | ---: | ---: | ---: |
| Carros | 10 de 12 com venda | 1 de 5 | 3 de 8 |
| Motos | 6 de 8 | 0 de 5 | 1 de 4 |
| Utilitários | 5 de 10 | 0 de 2 | 1 de 5 |

Carros sem monta declarada, por estado: SP 297 (mediana 43%), GO 233 (56%), CE 94 (51%), PA 24 (42%), AM 24 (47%), BA 15 (52%), PR 14 (35%), DF 11 (61%), RS 11 (50%) e MS 6 (37%). Ficam cinza ES (4), MT (2) e os outros 15 estados, que não têm venda.

**A diferença entre estados é também diferença entre fontes e comitentes.** Fora SP, cada estado vem de uma fonte só (Leilo). GO tem 233 vendas da Leilo, que provavelmente vêm de poucos comitentes. Em SP, a Leilo dá 40% (58 vendas) e o Pátio dá 43% (239). O mapa precisa mostrar quais fontes compõem cada estado.

**Modelo × estado ainda é raro.** Dos 49 modelos de carro com pelo menos 5 vendas sem monta declarada:

| Estados com ≥ 5 vendas do modelo | Modelos |
| ---: | ---: |
| 0 | 23 |
| 1 | 19 |
| 2 | 4 |
| 3 | 2 (Gol e Sandero) |
| 4 | 1 (Onix: GO 15, SP 11, CE 5, AM 5) |

Hoje, ao escolher um modelo, o mapa mostra mediana em no máximo 4 estados. O resto tem de 1 a 4 vendas. A tela deve mostrar essas vendas uma a uma, sem mediana (§4).

**Ranking de modelos:** 49 carros, 15 motos e 5 utilitários com pelo menos 5 vendas sem monta declarada. Nos carros, a mediana vai de 21% (Peugeot 207, 5 vendas) a 66% (Fiat Strada, 7). Os mais vendidos são Onix (43), Gol (41), Sandero (30), HB20 (22), Fiesta (20) e Palio (20).

**Curva do lance:** 1.022 vendas têm observação nas 72 h finais (2.848 observações). Vendas com lance observado em cada marca: 72 h, 17; 48 h, 251; 24 h, 371; 12 h, 426; 6 h, 433; 3 h, 433; 1 h, 466. A curva começa em 48 h.

**Ajustes ao plano pela medição:**

1. **Sem filtro de período.** A tela usa todas as vendas da janela das estimativas (12 meses) e diz "desde 28/09/2026". O filtro entra quando houver 3 meses de vendas.
2. **Padrão: carros, sem monta declarada.** São 737 das 1.231 vendas com valor de mercado.
3. **Modelo escolhido no mapa:** estado com 5 ou mais vendas recebe cor e mediana; estado com 1 a 4 vendas mostra só a contagem, sem cor, e as vendas aparecem uma a uma ao clicar.
4. **Fontes no detalhe do estado** ("Leilo 233"), porque a diferença entre estados é também diferença entre fontes.
5. **Curva do lance de 48 h a 1 h.**
6. **Corte de valores fora da faixa mantido como proteção**, embora hoje não exclua nenhuma venda.

## 3. Cuidados de leitura

Estas regras valem para todos os gráficos e evitam conclusões erradas:

1. **A condição pesa mais que o estado.** Um carro sem monta sai muito mais perto do valor de mercado do que uma sucata. Um estado com mais sucatas pareceria "mais barato" sem ser. O mapa, o ranking e a ficha do modelo **sempre filtram uma condição**; nunca misturam condições numa mesma cor ou mediana.
2. **"Sem monta declarada" não é "sem monta".** A fonte não declarou nada (`damage_level` nulo); o Pátio São Carlos quase nunca declara. O rótulo diz isso.
3. **O valor de mercado é o informado pela fonte** (D-30), rotulado como "FIPE informada pela fonte".
4. **A UF é a do pátio**, onde o veículo está, e não a do comitente nem a do comprador. Fora SP, cada estado vem de uma fonte só, então a diferença entre estados é também diferença entre fontes e comitentes.
5. **Amostra mínima de 5 vendas** por estado, linha ou ponto de resumo, o mesmo mínimo do preço provável (D-36). Abaixo disso, o estado fica cinza e mostra "sem base (n de 5)".
6. **Todo gráfico mostra `n` e período.** A base é a janela das estimativas (12 meses, `SALES_WINDOW_MS`), e o texto diz a data da venda mais antiga ("desde 28/09/2026").
7. **Sem julgamento por cor.** Verde e vermelho significam limite atendido ou estourado (DESIGN §3.1). Na Pesquisa, mais barato não é "bom": a escala é de um tom só.

## 4. Tela

Rota única **`/pesquisa`**, item **"Pesquisa"** no menu depois de "Monitores" e "Alertas", que andam juntos. Filtros na URL e aplicados na hora, como em "Leilões" (D-43).

**Cabeçalho.** Título "Pesquisa" e a linha "Preços de arremate do catálogo: 1.506 vendas desde 28/09/2026".

**Barra de filtros:**

- **Modelo:** busca com sugestões de marca e modelo e a contagem de vendas, como a busca de "Leilões". Vazio = todos os modelos.
- **Condição:** sem monta declarada, pequena, média, grande ou sucata. Sempre uma. Padrão: sem monta declarada. Condição sem venda na categoria fica desabilitada, com a contagem zero.
- **Categoria:** carros, motos, utilitários ou sucatas. Padrão: carros.
- **UF:** escolhida ao clicar no mapa, com chip para limpar.

Sem filtro de período enquanto a base tiver menos de 3 meses (§2).

**Blocos, nesta ordem:**

1. **Quanto se paga por condição.** Uma faixa por condição com o histograma das vendas, a faixa P25–P75 e a mediana marcada, num eixo de % do valor de mercado. A condição do filtro fica destacada. Responde à pergunta 1 e ensina o cuidado 1. Respeita modelo, categoria e UF, mas não a condição, que é o que ele compara. Condição com menos de 5 vendas aparece como linha "sem base (n de 5)", com os pontos e sem mediana. Texto de apoio quando pequena monta e "sem monta declarada" ficam próximas: "sem monta declarada inclui veículos que a fonte não classificou".

2. **Por estado.** Mapa do Brasil (D-46, no lugar do mapa de quadrados aprovado antes): cada estado pintado pela mediana, com a sigla e o valor escritos; estados pequenos com rótulo fora e linha guia; dica com mediana, faixa e `n` ao passar o mouse. Com 1 a 4 vendas, o estado fica cinza e mostra só a contagem; sem venda, só o contorno. Ao clicar num estado, o filtro de UF é aplicado e aparece o detalhe: a distribuição do estado comparada com a do Brasil, as fontes que o compõem ("Leilo 233") e, com menos de 5 vendas, as vendas uma a uma. Com um modelo escolhido, o mapa mostra só aquele modelo (hoje, no máximo 4 estados com mediana), e o usuário pode trocar a medida para **lance final em R$** (só faz sentido dentro de um modelo, e aí as vendas da Freitas também contam).

3. **Modelos que mais saem abaixo do valor de mercado** (sem modelo escolhido). Ranking dos modelos com pelo menos 5 vendas na condição e categoria do filtro: mediana, faixa P25–P75 em barra e `n`. Cada linha aplica o filtro de modelo. É a porta de entrada para quem não sabe que modelo olhar.

4. **Vendas do modelo** (com modelo escolhido). Dispersão de lance final (R$) por ano-modelo, com a mediana de cada ano, e a tabela das vendas: data, UF, ano, km, lance final, valor de mercado, % e link para o anúncio. Responde à pergunta 3.

5. **Como o lance sobe.** Curva do lance observado ÷ lance final nas 48 h antes do fim, com a faixa P25–P75, para as vendas do filtro. Responde à pergunta 4.

**Estados vazios.** Sem vendas no filtro: "Nenhuma venda com esses filtros desde 28/09/2026", com a sugestão de trocar a condição, a categoria ou o modelo.

**Celular.** A mesma ordem numa coluna. O mapa ocupa a largura do bloco, com os textos em tamanho fixo. A barra de filtros não usa a gaveta inferior de Leilões: com três controles, a busca ocupa uma linha e condição e categoria dividem a seguinte (decidido na etapa 4).

**Acessibilidade.** Cada gráfico tem `role="img"` com um resumo em texto ("SP: mediana 64% do valor de mercado, 312 vendas") e um "Ver dados em tabela" com a mesma informação. Os estados do mapa são links focáveis pelo teclado, com a mesma dica do mouse. Cor nunca carrega o valor sozinha: o número está escrito no quadrado.

## 5. Regras

- **Venda:** anúncio com situação vendido, lance final positivo e fim nos últimos 12 meses. É o mesmo critério da base do preço provável.
- **% do valor de mercado:** lance final ÷ valor de mercado da fonte. É a mesma medida do filtro "% do mercado" (D-43), então um número visto na Pesquisa pode ir direto para um filtro ou monitor. O texto de apoio diz "X% abaixo da FIPE informada".
- **Fora da faixa:** proporções abaixo de 1% ou acima de 200% ficam fora das estatísticas e são contadas à parte ("3 vendas com valor de mercado inconsistente"). Em 08/10/2026 nenhuma venda caiu fora (P1 12%, P99 78%): o corte é proteção contra erro futuro da fonte.
- **Mediana e P25–P75:** `percentile` de `src/domain/listings/estimates.ts`, a mesma interpolação do Postgres.
- **Modelo:** `vehicleKey(brand, model)`, a mesma normalização das estimativas. A Pesquisa e o preço provável agrupam igual.
- **Curva do lance:** para cada venda com observações, a razão lance observado ÷ lance final no último instante antes de cada marca (48, 24, 12, 6, 3 e 1 h), considerando só observações nas 24 h anteriores à marca. Cada marca só entra com pelo menos 5 vendas. A marca de 72 h fica de fora até haver base (17 vendas em 08/10/2026).

## 6. Decisões técnicas

- **Agregação no Postgres.** No ritmo medido (cerca de 150 vendas por dia), a janela de 12 meses chega a uns 55 mil vendas. Trazer todas para o servidor a cada visita não escala. As consultas devolvem só os grupos: mediana, P25 e P75 com `percentile_cont`, histograma com `width_bucket` e contagens por UF, fonte, condição e modelo. Elas usam `$queryRaw` com template marcado (parâmetros sempre ligados, nunca concatenados) e validam cada linha com Zod antes de virar DTO. É o primeiro `$queryRaw` do projeto, por isso padrão novo (§7). Linhas individuais só onde o conjunto é pequeno: vendas de um modelo e de um estado com menos de 5 vendas.
- **Mesma regra nos dois lados.** A normalização de modelo (`vehicleKey`: marca por extenso, primeira palavra do modelo) é reproduzida numa expressão SQL. Um teste com os mesmos casos de `estimates.test.ts` garante que SQL e TypeScript agrupam igual. Os limites de amostra e de valores fora da faixa ficam em constantes do domínio, passadas como parâmetro.
- **Domínio** em `src/domain/research/`, puro e testado: da linha agregada ao que a tela mostra (situação "sem base", faixa de cor, ordem do ranking, texto de apoio), resumo por estado e marcas da curva do lance.
- **Consultas** em `src/features/research/queries.ts`, com `requireUser()`, embora o catálogo seja global (D-25).
- **Gráficos em SVG próprio, renderizados no servidor**, em `src/components/charts/`: `DistributionChart` (histograma de 2 em 2 pontos percentuais com mediana e P25–P75, que funciona com 20 ou 20 mil vendas), `BrazilMap` (D-46: Client Component, por causa da dica), `RangeBars`, `ScatterPlot` e `LineBand`. São formas simples e sem animação; só o mapa roda no navegador. As escalas (linear, faixas de cor) ficam em `src/lib/charts.ts`. Dependência nova só o contorno dos estados (`@svg-maps/brazil`, D-46). Uma biblioteca (Recharts, visx) só entra se faltar interação, como zoom ou tooltip complexa, com decisão registrada.
- **Interação pela URL.** Clique no estado e na linha do ranking são `Link` com o filtro. Os Client Components novos são o mapa (pela dica) e a barra de filtros, reaproveitando as peças de `FilterBar` (D-43).
- **Tokens de dados no DESIGN.md:** escala sequencial de um tom (`data-1` a `data-5`), `data-empty` para "sem base" e regra de cor do texto sobre cada passo, conferidos para contraste (≥ 3:1 com a superfície nos passos escuros e texto ≥ 4,5:1). Sem verde e vermelho.
- **Cache Components:** cada bloco no seu `<Suspense>` com `Skeleton`. Sem `"use cache"` (D-04), embora o catálogo seja global (D-25). Revisitar só se a tela ficar lenta.
- **Sem migration agora.** O índice `(status, ends_at)` já cobre o recorte das vendas. Na etapa 3, conferir o plano de execução (`EXPLAIN ANALYZE`) com o volume real. Se pesar, o índice entra numa etapa própria.

## 7. Aprovado em 08/10/2026

1. **Menu "Pesquisa"** depois de "Monitores" (e de "Alertas", que andam juntos), com rota única `/pesquisa` e filtros na URL.
2. **Condição sempre filtrada** no mapa, no ranking e na ficha do modelo. Padrão: sem monta declarada.
3. **Unidade "% do valor de mercado"**, a mesma do filtro D-43, com "X% abaixo da FIPE informada" como apoio.
4. **Mapa de quadrados** no lugar do mapa geográfico. Todos os estados têm o mesmo peso, e não é preciso arquivo de fronteiras nem biblioteca de mapas. *Revisto na etapa 4: o usuário pediu mapa geográfico interativo (D-46).*
5. **Gráficos em SVG próprio no servidor** (`src/components/charts/`, padrão novo) e sem biblioteca de gráficos.
6. **Etapa 0 com leitura do banco de produção** antes do domínio, como nas medições do dashboard e dos filtros.

**Confirmados depois da medição:**

7. **Agregação no Postgres com `$queryRaw` validado por Zod** (§6), padrão novo. Carregar as vendas e agregar no domínio, como as estimativas fazem hoje, seria mais simples agora, mas não escala no ritmo de 150 vendas por dia.
8. **Ajustes do §2:** sem filtro de período por enquanto, estados e modelos com 1 a 4 vendas mostrados venda a venda, fontes no detalhe do estado e curva do lance a partir de 48 h.

## 8. Etapas

0. **Medição** (§2), só leitura. Feita em 08/10/2026: o mapa fica, com os ajustes do §2.
1. **Documentos:** este plano com os números, D-45, SPEC §5 (`/pesquisa`), DESIGN (tokens de dados e §15 Pesquisa) e GUIA.
2. **Domínio:** `src/domain/research/` e as escalas de `src/lib/charts.ts`, com testes.
3. **Consultas e gráficos:** `queries.ts` e os componentes de `src/components/charts/`, conferidos em `/componentes`.
4. **Tela, primeira parte:** menu, filtros, "Quanto se paga por condição", mapa por estado e ranking de modelos.
5. **Tela, segunda parte:** vendas do modelo e curva do lance.
6. **Fechamento:** E2E da Pesquisa, `npm run check` e `npm run build`, conferência no navegador (desktop e celular) e revisão de usabilidade em ciclo até não haver achados.

## 9. Fora deste plano

- **Precisão das estimativas** (preço provável × lance final). O provável não é guardado no momento da venda. Medir exige recalculá-lo só com as vendas anteriores a cada uma. Pertence à Fase 2 (SPEC §15), junto com a calibração das premissas padrão.
- **Mapa por município.** O ponto por município (já há coordenadas) só faz sentido com mais volume fora de SP.
- **Filtro de período e tendência mensal** do % do valor de mercado. A base começa em 28/09/2026. O filtro entra com 3 meses de vendas e a tendência com 12.
- **Comparação entre fontes e leiloeiros**, taxa de venda (vendido × não vendido: a Leilo tem 961 vendidos e 625 não vendidos) e lance inicial × final.
- **Pesados e outros** como categoria do filtro. Quase não têm valor de mercado: 2 de 9 pesados vendidos e nenhum equipamento.
- **Carga das estimativas.** `loadEstimateContext` traz todas as vendas dos últimos 12 meses a cada tela com cartões. No ritmo atual, são uns 55 mil registros em um ano. Merece o mesmo tratamento da Pesquisa (agregar ou indexar no banco) num plano próprio.
- **Exportar os dados** dos gráficos (CSV): Fase 3.
