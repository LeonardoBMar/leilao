# Plano: Mercado — da pesquisa à decisão do lance

Status: **aprovado em 11/10/2026**, com todas as fases. Reestrutura a Pesquisa (`/mercado`, D-45, D-61, D-62, D-66, D-70). As decisões novas (§11) entram no `docs/ARCHITECTURE.md` §15 à medida que cada fase é entregue.

## 1. Problema

O produto existe para responder **"quanto posso pagar por este lote?"** (SPEC §1). A Pesquisa responde outra pergunta, "o que aconteceu no mercado", com cinco blocos de gráficos de mesmo peso. O usuário entra, lê e volta para a análise sem levar nada.

A crítica de 11/10/2026 achou nove problemas. Os quatro que orientam este plano:

1. **O comparável é largo demais.** O agrupamento usa a primeira palavra do modelo (`vehicleKey`), então "Onix" junta hatch, Onix Plus, 1.0 e 1.4 de 2013 a 2026. O lance mediano sai R$ 37,9 mil, com metade entre R$ 26,3 mil e R$ 65,4 mil. A mesma chave alimenta o **preço provável** (D-36) do lote e do dashboard, então o problema não fica só na Pesquisa.
2. **O "% do mercado" tem viés de idade.** O ranking por menor mediana abre com 206, Clio, Classic e Corsa: a FIPE de carro velho fica acima do preço real. Sem contexto, o ranking sugere carro velho.
3. **A segmentação principal é a mais suja, e a que importa não existe.** "Sem monta declarada" é o padrão, mas a condição só vem declarada em 23% das vendas. O que move o preço é **quem vende** (prefeitura, PRF, financeira, seguradora, frota, montadora), e a origem hoje só cobre 21% das vendas (§2).
4. **Tudo aparece sempre.** Com um modelo escolhido, a condição mostra "sem base" em 3 de 4 linhas, o mapa fica vazio e a curva do lance é a mesma para qualquer filtro. A barra fixa ocupa cerca de 170 px.

## 2. Medição (11/10/2026, só leitura)

**Base:** 7.266 vendas com lance final desde 31/07/2026. O volume real começa em setembro e cresce rápido: 593, 137, 480, 1.093, 1.911 e 2.972 vendas por semana, de 31/08 a 05/10. Hoje são 2.994 motos, 2.953 carros, 621 sucatas e 395 utilitários.

**Cobertura dos campos nas vendas:**

| Campo | Vendas | % | Observação |
| --- | ---: | ---: | --- |
| Valor de mercado | 5.970 | 82% | da fonte ou casado na FIPE (D-47) |
| Código FIPE da versão (fonte ou casado) | ~3.740 | 52% | Superbid 2.093, Leilo 897, Freire 490, Detran-MG 261 |
| Ano-modelo | 7.084 | 97% | |
| Comitente (`seller_name`) | 6.685 | 92% | Superbid, Leilo, Freire e Detran-MG; falta Pátio e Freitas |
| Condição declarada | 1.667 | 23% | |
| Origem (`recovery_type`) | 1.504 | 21% | **Superbid, 61% das vendas, não informa** |
| Quilometragem | 1.227 | 17% | Superbid informa em 176 de 4.450 |

**Comparável por versão é viável para metade da base.** 144 códigos FIPE têm 5 vendas ou mais (2.711 vendas) e 45 têm 15 ou mais. Por modelo base, 204 modelos têm 5 ou mais e 89 têm 15 ou mais.

**A família muda o preço por inteiro.** No Onix: Onix Plus, 41 vendas com mediana de R$ 65.000; Onix sem sufixo, 16 vendas a R$ 27.400; "10MT", 16 vendas a R$ 27.169; Joy, 7 vendas a R$ 26.200. Juntar esses grupos produz a faixa larga do §1.

**O comitente explica o preço.** Na Superbid, em % da FIPE:

| Comitente | Vendas | Mediana |
| --- | ---: | ---: |
| Prefeitura de São Bernardo do Campo | 1.319 | 45% |
| Prefeitura de Guarulhos | 960 | 44% |
| PRF de Santa Catarina | 612 | 9% |
| Detran/MS | 76 | 36% |
| GM (montadora) | 73 | 78% |
| Heineken (frota) | 32 | 39% |
| Jadlog (frota) | 29 | 22% |

O `originOf` atual lê só o `recovery_type` e põe toda a Superbid em "outros". Classificar pelo comitente leva a origem de 21% para perto de 100%: Pátio São Carlos e Detran-MG são apreensão pela própria fonte.

**Dados do usuário:** 58 lotes (42 ligados a anúncio), 75 análises fixadas e 64 resultados. Já dá para uma primeira calibração (§7).

### Linha de base do preço provável (T0.1, 11/10/2026)

`npm run db:estimate-backtest`: cada venda desde 15/09 estimada só com as vendas de dias anteriores (6.404 alvos).

| Grupo | Alvos | Com estimativa | Dentro da P25–P75 | Erro mediano |
| --- | ---: | ---: | ---: | ---: |
| Total | 6.404 | 82,1% | 44,8% | 19,4% |
| Por comparáveis (`vehicleKey`, ano ±1) | 2.720 | — | 40,9% | 16,6% |
| Pela proporção da categoria | 2.535 | — | 49,0% | 23,3% |
| Carros | 2.817 | 91,4% | 44,4% | 24,9% |
| Motos | 2.433 | 93,3% | 45,5% | 14,5% |

**Origem inferida (T0.3):** com o comitente e a fonte, 96% das vendas ganham origem: órgão público 71,8%, financiamento 16,4%, frota 4,7%, seguradora 3,1% e outros 4,0% (leiloeiros, pessoa física e comitentes sem sinal).

Os comparáveis acertam a faixa menos que o esperado (41% contra 50%). Nos carros, a mediana erra um quarto do lance.

### Portão do motor v2 (T0.6, 11/10/2026)

`npm run db:estimate-backtest` compara as variantes nos mesmos 6.404 alvos:

| Variante | Dentro da faixa | Erro mediano | Erro nos comparáveis |
| --- | ---: | ---: | ---: |
| v1: só o modelo base | 44,8% | 19,4% | 16,6% |
| v2: versão → família → modelo | 42,0% | 19,3% | 16,6% |
| v2 + preferência por origem | 41,3% | 19,3% | 16,6% |
| Família → modelo | 43,6% | 19,1% | 16,2% |
| **v1 com a faixa corrigida (adotado)** | **48,0%** | **19,4%** | **16,6%** |

Lidos lado a lado, nos mesmos alvos: com a versão, o erro foi de 11,8% (v1, mediana de 55 vendas) para 12,4% (v2, 18 vendas); com a família, de 22,1% para 21,2%. Nos carros, a família piorou (24,0% → 24,9%); nas motos, ajudou pouco (13,4% → 13,1%). Também não ajudaram a proporção do valor de mercado por modelo nem por origem (erro igual ou maior).

**Conclusão.** A hipótese do T0.1 estava errada: a faixa não errava por misturar versões, e sim por ser a P25–P75 de amostras pequenas, que com 5 vendas contém só 1 em 3 das próximas. Estreitar o grupo diminui a amostra sem tirar ruído; o que sobra de erro vem do estado de cada veículo, que o catálogo não descreve. Decisão (D-72):

- O preço provável continua só com o modelo base. Versão, família e origem viram **recortes que o usuário escolhe** na tela Avaliar, com o nível dito na resposta.
- A faixa passa a ser a de metade das próximas vendas (`bandOf`: quantis `0,5 ± 0,25 × (n + 1) ÷ (n − 1)`): 48% dentro, erro igual.
- Confiança pelo número de vendas e pela largura da P25–P75, sem o nível: **alta** (20+ vendas, até 40%) erra 12,5% e acerta a faixa 50%; **média** erra 18,0%; **baixa** (inclui a proporção da categoria) erra 24,1%.

## 3. Princípios

1. **Resposta primeiro, evidência depois.** O topo diz a faixa de arremate em R$; os gráficos justificam.
2. **Um motor, três superfícies.** O mesmo cálculo de comparáveis alimenta o preço provável (lote, dashboard, Leilões), a tela Avaliar e a análise. O usuário sempre pode abrir o número e ver as vendas por trás.
3. **Comparável honesto.** Cada faixa diz de que nível veio (mesma versão, mesma família, mesmo modelo ou proporção da categoria), quantas vendas tem e de quando.
4. **Descritivo, sem recomendação** (D-45 continua). Faixa do que já aconteceu e posição do limite do usuário nessa faixa; nunca "compre" nem score.
5. **Só mostra o que tem base.** Bloco sem dado suficiente vira uma linha ou some, em vez de ocupar a tela com "sem base".

## 4. Arquitetura de informação

Menu **Mercado** (hoje "Pesquisa"), com três abas por rota:

| Rota | Aba | Pergunta |
| --- | --- | --- |
| `/mercado` | **Avaliar** (padrão) | Quanto este veículo costuma sair em leilão? |
| `/mercado/panorama` | **Panorama** | Onde, de quem e o que sai mais abaixo da FIPE? |
| `/mercado/calibracao` | **Calibração** | Meus limites batem com o que o mercado paga? |

Superfícies fora do menu:

- **Ficha do lote:** painel "Mercado deste lote", com a resposta compacta, 5 comparáveis e "Ver todos" (abre Avaliar com `?lote=<id>`).
- **Análise:** bloco "Concorrência" ao lado do lance máximo, com a posição do limite na faixa dos comparáveis. Ao fixar, a análise guarda uma cópia dos comparáveis (§8).
- **Dashboard e Leilões:** o preço provável vira link para os comparáveis dele.

## 5. A tela ideal: Avaliar (`/mercado`)

### 5.1 Desktop

```
Mercado   [Avaliar] [Panorama] [Calibração]
┌────────────────────────────────────────────────────────────────────────────┐
│ 🔍 Onix Plus 1.0 Turbo 2023                                   [Limpar]    │
│ [Chevrolet Onix ▾] [Família: Plus ▾] [Versão FIPE: LT 1.0T ▾] [2022–2024 ▾] │
│ [Km: até 60 mil ▾] [Origem: qualquer ▾] [Condição: qualquer ▾]           │
└────────────────────────────────────────────────────────────────────────────┘
┌─ Resposta ─────────────────────────────────────────────────────────────────┐
│ Faixa típica de arremate          R$ 61 mil – R$ 68 mil                     │
│ Mediana R$ 65 mil · 74% da FIPE · 18 vendas · 05/09 a 09/10 · Confiança média│
│ Base: mesma família, ano ±1  ⓘ Como calculamos                              │
│ [Acompanhar este veículo]  [Ver 6 lotes abertos ↓]                          │
└────────────────────────────────────────────────────────────────────────────┘
┌─ Vendas e lotes abertos ───────────────────────────── [R$ | % FIPE] [Ano | Data]┐
│   ●  vendido       ○→◆  aberto: lance atual → preço provável                 │
│   ░░░░ faixa típica (P25–P75)                                               │
└────────────────────────────────────────────────────────────────────────────┘
┌─ Comparáveis (18) ────────────────────────────────── Ordem: [semelhança ▾] ┐
│ [✓] 📷 09/10 · Onix Plus LT 1.0T 2023 · 41 mil km · Financeira · SP         │
│        R$ 64.500 · 73% FIPE         mesma versão · mesmo ano     [anúncio ↗] │
│ [ ] 📷 02/10 · Onix Plus Premier 2022 · — km · Prefeitura · SP              │
│        R$ 49.000 · 55% FIPE         mesma família · ano −1   [excluído]     │
│ … Ver todas                                                                 │
└────────────────────────────────────────────────────────────────────────────┘
┌─ Lotes abertos deste comparável (6) ────────────────────────────────────────┐
│ Encerra   Veículo              Lance atual  Preço provável  Na faixa?       │
│ 13/10 14h Onix Plus LT 2023    R$ 52.000    R$ 63–67 mil    abaixo da faixa │
│                                                    [Analisar] [anúncio ↗]   │
└────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Regras da tela

- **Entrada.**
  - Sem veículo, a tela mostra os **lotes acompanhados** e os **modelos recentes** (D-62) como atalhos.
  - Com `?lote=<id>`, o alvo vem preenchido do lote: modelo, família, versão FIPE, ano, km, condição e origem.
- **Busca única.** O texto livre ("onix plus 2023") vira chips. Cada chip é um `Select` com a contagem de vendas por opção, e opção sem venda fica desabilitada.
- **Nível do comparável:** o motor desce até achar 5 vendas, nesta ordem:
  1. mesma versão FIPE, ano ±1;
  2. mesma família, ano ±1;
  3. mesmo modelo base, ano ±1;
  4. proporção da FIPE na categoria, que é o fallback atual.
  O nível aparece escrito na resposta. O usuário pode forçar um nível mais largo pelos chips.
- **Confiança:** um rótulo em texto (alta, média ou baixa), calculado a partir do nível, do `n` e da largura da faixa. Os limiares saem do backtest (T0.1); nunca é uma cor sozinha.
- **Excluir comparável.** A caixa de cada linha tira a venda do cálculo (`fora=<id>,<id>` na URL), e a resposta é recalculada no servidor. A exclusão vale só para essa avaliação e é guardada no snapshot da análise.
- **Gráfico.**
  - Vendidos em ponto cheio, abertos em ponto vazado, com uma seta até o preço provável.
  - A faixa P25–P75 aparece sombreada.
  - Eixo horizontal em ano ou em data; data mostra tendência sem precisar de bloco próprio.
- **Lotes abertos:** posição do preço provável frente à faixa, em texto ("abaixo", "dentro" ou "acima da faixa"), mais "Analisar", que cria o lote a partir do anúncio pelo fluxo atual.
- **Insuficiente:** com menos de 5 vendas em qualquer nível, as vendas aparecem uma a uma (regra de D-45), com botões que afrouxam um filtro ("Ano ±2 (12 vendas)", "Sem filtro de km (9 vendas)").
- **Celular:** resposta primeiro; o gráfico vem depois da lista; a lista vira cartões.

## 6. Panorama (`/mercado/panorama`)

É a Pesquisa de hoje, enxuta, para explorar.

1. **Barra compacta:** busca de modelo, categoria e "Mais filtros" (gaveta com condição, origem, UF, fonte, km e período), com chips ativos. Fixa em uma linha.
2. **Ranking com contexto:**
   - Colunas novas: ano mediano, lance mediano em R$ e vendas por semana (liquidez).
   - Filtro por idade: até 5, de 6 a 10 e mais de 10 anos.
   - Ordem padrão: mais vendas.
   - Cada linha abre o Avaliar do modelo.
3. **De quem se compra:** a distribuição do % da FIPE por origem inferida (apreensão, financeira, seguradora, frota, montadora). A condição continua, mas só com as linhas que têm base.
4. **Tendência:** mediana semanal do % da FIPE com `n`. Aparece com 8 semanas e 50 vendas por semana no recorte. Junto vem o filtro de período (30, 90 dias ou tudo), revisando a regra de D-45 (§11).
5. **Onde:** tabela por UF e fonte, mais faixas de distância de São Carlos (até 100, até 300 e acima de 300 km). O mapa de D-46 fica atrás de "Ver no mapa".
6. **Como lemos os dados** (recolhido, no fim): a curva do lance, a cobertura da FIPE casada e as regras de amostra.

## 7. Calibração (`/mercado/calibracao`)

Usa o ativo exclusivo do produto: análises fixadas antes do resultado.

- **Topo:**
  - "Em N resultados, o arremate caiu dentro da faixa típica X vezes". O esperado é cerca de 50%; muito menos que isso indica comparável ruim.
  - "Seu limite ficou, na mediana, Y% abaixo do arremate".
- **Gráfico:** limite fixado × arremate, com a diagonal; ponto acima dela é limite abaixo do arremate.
- **Tabela por análise:** lote, data da fixação, faixa da época, limite, arremate e posição.
- **Sem vazamento:** a faixa da época usa só vendas encerradas **antes** da fixação (snapshot do §8 ou recálculo com `ate=<data>`).
- **Qualidade do motor:** o resultado do backtest (T0.1) em linguagem simples, atualizado pelo script.

## 8. Integração com a análise

**Correção da crítica de 11/10:** o valor de mercado da análise (`V`, SPEC §7) é o valor de **revenda** depois dos reparos, não o preço de arremate. Os comparáveis não preenchem `V`. Eles entram como **referência de concorrência**:

- **Bloco "Concorrência"** ao lado do lance máximo: "Seu limite de R$ 58 mil fica abaixo de 14 dos 18 comparáveis (P22)". É descritivo; a posição vem de uma função pura `limitPosition`.
- **"Usar FIPE casada"** preenche a referência FIPE da análise com o valor, o mês e a origem do anúncio, só se o campo estiver vazio.
- **Snapshot na fixação:** a análise fixada guarda nível, `n`, P25, mediana, P75, ids dos comparáveis incluídos e excluídos e a data do cálculo. É imutável como o resto da análise fixada (regra 8 da skill) e alimenta a Calibração.

## 9. Fora deste plano

- Preço de revenda (varejo) estimado pelo sistema: `V` continua informado pelo usuário (D-30).
- Score, "oportunidade" ou cor de bom/ruim.
- Comparar mais de dois grupos (D-61 continua no Panorama).
- Biblioteca de gráficos nova: os componentes de `src/components/charts/` bastam.
- Coletar km ou origem que a fonte não publica.

## 10. Riscos

| Risco | Mitigação |
| --- | --- |
| A família extraída do texto erra (ex.: "10MT" não é família) | Família por lista curta e testada por marca (PLUS, SEDAN, JOY, CROSS, HATCH…); o código FIPE manda quando existe |
| O motor novo piora o preço provável | Portão no backtest (T0.6): só troca se a taxa dentro da faixa ficar mais perto de 50% e o erro mediano cair |
| O comitente vira um filtro com 100 opções | Classe inferida (5 valores) na tela; o nome do comitente só no detalhe da venda |
| Superbid domina a base (61%) e enviesa as faixas | A fonte aparece no comparável; o Panorama mostra a composição por fonte |
| Exclusão manual vira "escolher o número que quero" | Exclusões ficam visíveis, contadas na resposta e guardadas no snapshot |

## 11. Decisões a registrar (após aprovação)

| Id proposto | Decisão |
| --- | --- |
| D-71 | Mercado em três abas por rota (Avaliar, Panorama, Calibração); Avaliar é a entrada; menu "Mercado" |
| D-72 | Motor de comparáveis v2: níveis versão FIPE, família e modelo, confiança e vendas usadas expostas, portão por backtest. Resultado do portão: o preço provável segue no modelo base com a faixa corrigida; os outros níveis viram recortes da tela Avaliar (§2) |
| D-73 | Origem inferida do veículo (`recovery_type` + comitente + fonte), coluna persistida com backfill, usada no catálogo e no Mercado |
| D-74 | Snapshot de mercado na análise fixada (migration) e bloco Concorrência |
| D-75 | Filtro de período e tendência semanal (revisa a regra "sem período até 3 meses" de D-45) |

## 12. Tarefas

Cada tarefa fecha com `npm run check`; as que mexem em rota, config ou fronteira server/client, também com `npm run build`. As de UI são conferidas no navegador em 375, 768, 1024 e 1440 px. O tamanho é aproximado: P (até meio dia), M (1 dia), G (2–3 dias).

### Fase 0 — Motor de comparáveis (base de tudo)

| # | Tarefa | Camadas | Aceite | Dep. | Tam. |
| --- | --- | --- | --- | --- | --- |
| T0.1 | **Backtest do preço provável atual.** Script `scripts/estimate-backtest.ts` (só leitura): para cada venda, estima com as vendas anteriores a ela; mede a taxa dentro da P25–P75, o erro mediano e a cobertura por nível e categoria | `scripts`, `domain` | Números registrados neste plano como linha de base | — | M |
| T0.2 | **Família do veículo.** `vehicleFamilyKey` puro: modelo base + carroceria ou linha (Plus, Sedan, Weekend, Mille, Joy, cabine de picape) e, nas motos, a cilindrada. Sem espelho em SQL: os comparáveis são escolhidos no domínio sobre as vendas já filtradas pelo banco | `domain/listings` | Onix Plus ≠ Onix ≠ Joy; CG 160 ≠ CG 150; testes com grafias reais | — | M |
| T0.3 | **Origem inferida.** `originOf` passa a receber `recoveryType`, comitente e fonte; classes: apreensão, financeira, seguradora, frota, montadora e desconhecida. Testes com os 30 comitentes mais frequentes | `domain/listings/criteria.ts` | Cobertura ≥ 90% nas vendas na medição; filtro de origem de Leilões continua passando nos testes | — | M |
| T0.4 | **Persistir a origem.** Migration com `origin_kind` (enum) e índice; coletor grava; backfill por script, como `db:reparse` | `prisma`, `server`, `scripts` | Backfill idempotente; consulta de cobertura bate com T0.3 | T0.3 | M |
| T0.5 | **Motor v2.** `estimatePrice` com nível (`fipe_version`, `family`, `model`, `category_ratio`), ids dos comparáveis, pontuação de semelhança e `confidenceOf` puro; mesma assinatura de saída mais os campos novos | `domain/listings/estimates.ts` | Testes por nível, fallback e confiança; sem quebra nos consumidores | T0.2 | G |
| T0.6 | **Portão do backtest.** Rodar T0.1 com o v2 e comparar; ajustar tolerâncias e os limiares de confiança | `scripts` | v2 com taxa na faixa mais perto de 50% e erro mediano menor; senão, volta a T0.5. **Feito:** o v2 não passou; adotada a faixa corrigida com o modelo base (§2) | T0.1, T0.5 | M |
| T0.7 | **Trocar os consumidores.** `features/lots` e `features/listings` usam o motor escolhido no T0.6; o preço provável mostra a confiança e de onde veio ("mesmo modelo", "proporção da categoria") | `features`, `components` | Dashboard, lote e Leilões exibem a confiança e a origem do número; E2E atuais passam | T0.6 | M |
| T0.8 | **Documentar** D-72 e D-73 no ARCHITECTURE e o motor no SPEC §10 | `docs` | Revisão do usuário | T0.7 | P |

### Fase 1 — Navegação

| # | Tarefa | Camadas | Aceite | Dep. | Tam. |
| --- | --- | --- | --- | --- | --- |
| T1.1 | Menu, título e metadados: "Pesquisa" → "Mercado" | `components/layout`, `app` | Nome único no menu, na URL e no `<title>` | — | P |
| T1.2 | Abas por rota: `layout.tsx` de `/mercado` com as abas (sem `await` de dados no layout), `/mercado/panorama` com a `ResearchView` atual e `/mercado/calibracao` vazia com estado "em breve" | `app` | `npm run build` sem *blocking route*; links antigos com filtros de Panorama redirecionam | — | M |
| T1.3 | Entradas apontam para Avaliar: `LotResearchLink` → `/mercado?lote=<id>`; o ranking → Avaliar | `features/research`, `app` | Links do lote e da análise abrem o veículo certo | T1.2 | P |

### Fase 2 — Avaliar

| # | Tarefa | Camadas | Aceite | Dep. | Tam. |
| --- | --- | --- | --- | --- | --- |
| T2.1 | **Schema da URL** do Avaliar (`marca`, `modelo`, `familia`, `versao`, `anode`, `anoate`, `kmate`, `condicao`, `origem`, `lote`, `fora`), Zod que nunca lança, e `evaluateParams` inverso | `features/research/schemas.ts` | Testes de ida e volta e de valores inválidos | T0.5 | P |
| T2.2 | **`getComparables(target)`**: SQL por nível com fallback (template marcado, linhas validadas por Zod), DTO mínimo com semelhança e motivo; `cache()` para dividir entre blocos | `features/research/queries.ts` | Teste de equivalência SQL × domínio no nível e na ordem | T0.5, T2.1 | G |
| T2.3 | **`getLotTarget(lotId)`** com `requireUser()` e `ownerId`; preenche o alvo a partir do lote e do anúncio ligado | `features/research/queries.ts` | Lote de outro dono → nulo; teste | T2.1 | P |
| T2.4 | **`getOpenListingsFor(target)`** com o preço provável v2 e a posição frente à faixa | `features/research/queries.ts` | Só anúncios abertos; ordem por encerramento | T2.2 | M |
| T2.5 | **Seletor do veículo**: busca única que vira chips (reaproveita `ModelPicker`), `Select` de família e versão com contagens, `/` foca | `features/research/components` | Teclado completo; opção sem venda desabilitada | T2.1 | G |
| T2.6 | **Cartão da resposta**: faixa, mediana, % FIPE, `n`, período, nível, confiança e "Como calculamos" | `features/research/components` | Estados: suficiente, amostra pequena, só proporção, insuficiente | T2.2 | M |
| T2.7 | **Gráfico de vendas e abertos**: evolui `ModelSalesScatter` com faixa sombreada, ponto vazado e seta até o preço provável, eixo em ano ou data | `components/charts`, `features/research/components` | Tabela equivalente; `role="img"` com resumo; confere em `/componentes` | T2.2, T2.4 | G |
| T2.8 | **Lista de comparáveis** com incluir/excluir (`fora` na URL), motivo, miniatura e link; o recálculo é no servidor | `features/research/components` | Excluir e reincluir mantém a URL compartilhável; contagem de excluídas na resposta | T2.2 | M |
| T2.9 | **Lotes abertos** com "Analisar" (fluxo atual de criar lote a partir do anúncio) e "anúncio ↗" | `features/research/components`, `app/(private)/mercado` (composição com Leilões) | Composição pela rota, sem importação entre features | T2.4 | M |
| T2.10 | **Estados vazios e de entrada**: sem veículo (lotes acompanhados e recentes), insuficiente (botões que afrouxam com contagem) | `features/research` | Os três estados vistos no navegador | T2.6 | M |
| T2.11 | **Ações**: "Acompanhar este veículo" (monitor com família e versão) e "Ver no catálogo" | `app/(private)/mercado` | O monitor criado reproduz o recorte | T2.5 | P |
| T2.12 | **Fechamento**: celular, skeletons por bloco, a11y, E2E do Avaliar (abrir pelo lote, excluir comparável, abrir lote aberto) | `e2e`, `features` | `npm run check`, `npm run build`, E2E verde | T2.1–T2.11 | M |

### Fase 3 — Lote e análise

| # | Tarefa | Camadas | Aceite | Dep. | Tam. |
| --- | --- | --- | --- | --- | --- |
| T3.1 | **Painel "Mercado deste lote"** na ficha: resposta compacta e 5 comparáveis, composto pela rota | `app/(private)/lotes`, `features/research` | Aparece com e sem anúncio ligado; lote manual usa marca, modelo e ano | T2.6 | M |
| T3.2 | **`limitPosition`** puro: posição de um valor na distribuição dos comparáveis | `domain` | Testes de borda (abaixo de todos, acima de todos, empate) | T0.5 | P |
| T3.3 | **Bloco "Concorrência"** na análise, ao lado do lance máximo, atualizado ao simular | `features/analyses` | Texto descritivo; sem cor de bom/ruim | T3.2 | M |
| T3.4 | **"Usar FIPE casada"** na análise: preenche valor, mês e origem só se o campo estiver vazio | `features/analyses` | Não sobrescreve valor digitado; teste da action | T0.7 | P |
| T3.5 | **Snapshot na fixação** (D-74): migration com a coluna `market_snapshot` (jsonb validado por Zod na leitura) gravada na transação de fixar | `prisma`, `features/analyses/mutations.ts` | Análise fixada mostra a faixa da época; sem snapshot em análises antigas (nulo) | T2.2 | M |
| T3.6 | **Curva do lance no lote**: "com H h para o fim, o lance ainda sobe ~X% na mediana" | `features/lots` | Só com `n` ≥ 5 na marca de horas mais próxima | — | P |

### Fase 4 — Panorama

| # | Tarefa | Camadas | Aceite | Dep. | Tam. |
| --- | --- | --- | --- | --- | --- |
| T4.1 | **Barra compacta** com "Mais filtros" em gaveta e chips; fixa em uma linha | `features/research/components` | ≤ 64 px fixos no desktop | T1.2 | M |
| T4.2 | **Vocabulário único "% da FIPE"**; remove "Vendas no %" quando igual ao total; marca amostra pequena no cartão do lance | `features/research` | Sem número dito duas vezes no resumo | — | P |
| T4.3 | **Ranking com contexto**: ano mediano, lance mediano, vendas por semana, filtro de idade, ordem padrão por vendas | `queries`, `ranking-explorer` | 206, Clio e Classic deixam de abrir a lista sem filtro de idade | T1.3 | M |
| T4.4 | **De quem se compra**: distribuição por origem inferida; a condição mostra só as linhas com base | `queries`, `components` | Um bloco com o `DistributionChart` atual | T0.4 | M |
| T4.5 | **Onde**: tabela por UF e fonte e faixas de distância de São Carlos; mapa atrás de "Ver no mapa" | `queries`, `components` | Mapa de D-46 intacto, só rebaixado | — | M |
| T4.6 | **Tendência e período** (D-75): mediana semanal com `n`; período 30, 90 dias ou tudo | `queries`, `components/charts` | Só aparece com 8 semanas e 50 vendas por semana no recorte | — | M |
| T4.7 | **"Como lemos os dados"** recolhido no fim: curva do lance, cobertura da FIPE casada, regras de amostra | `features/research/components` | O cabeçalho deixa de citar a FIPE casada | — | P |

### Fase 5 — Calibração

| # | Tarefa | Camadas | Aceite | Dep. | Tam. |
| --- | --- | --- | --- | --- | --- |
| T5.1 | **Consulta das análises com resultado**: limite, arremate e faixa da época (snapshot ou recálculo só com vendas anteriores à fixação) | `features/research/queries.ts` | `requireUser` + `ownerId`; teste de que vendas posteriores não entram | T3.5 | M |
| T5.2 | **Métricas puras**: taxa dentro da faixa, desvio do limite × arremate, quebra por categoria | `domain/research` | Testes com casos montados | T5.1 | P |
| T5.3 | **Tela `/mercado/calibracao`**: frases do topo, gráfico limite × arremate, tabela | `features/research/components`, `app` | Estado "poucos resultados" com menos de 10 | T5.2 | M |
| T5.4 | **Qualidade do motor**: o resumo do backtest (T0.1) na aba, com a data | `features/research` | Decisão sobre onde guardar o resultado do script (tabela ou arquivo) registrada antes | T0.6 | P |

### Fase 6 — Fechamento

| # | Tarefa | Aceite | Tam. |
| --- | --- | --- | --- |
| T6.1 | SPEC §5 (`/mercado` reescrito, painel do lote, Concorrência), DESIGN §15.8 (Avaliar, Panorama, Calibração), GUIA e ARCHITECTURE (D-71 a D-75) | Documentos coerentes com a tela | M |
| T6.2 | Remover o código morto dos blocos substituídos | `npm run check` sem exportação órfã | P |
| T6.3 | Revisão pelo `leilao-reviewer`, `npm run build`, E2E completo, conferência em 375, 768, 1024 e 1440 px, ciclo até não haver achados | Sem achados abertos | M |
| T6.4 | Revisão de resultado após duas semanas de uso: backtest de novo, taxa de análises com snapshot, tempo do lote ao limite fixado | Números registrados neste plano | P |

### Ordem e entregas

1. **Fase 0** — tudo depende dela, e ela já melhora o preço provável do dashboard e do lote sem mexer na tela.
2. **Fase 1 + Fase 2** — o Avaliar entra no ar como a nova `/mercado`.
3. **Fase 3** — a pesquisa passa a chegar na decisão.
4. **Fase 4** — pode correr em paralelo com a 3.
5. **Fase 5** — depende do snapshot (T3.5) e de resultados novos.
6. **Fase 6** — fechamento.

Cada fase termina num estado publicável.

## 13. Como saber se deu certo

- **Precisão do motor:** a taxa de arremates dentro da faixa típica fica perto de 50% no backtest e na Calibração.
- **Uso na decisão:** mais de 80% das análises fixadas novas com snapshot de mercado.
- **Tempo:** o tempo do lote aberto ao limite fixado cai.
- **Clareza:** o preço provável do lote nunca aparece sem o nível e o `n`.

### Medição no fechamento (T6.4, 11/10/2026)

O plano foi entregue inteiro em 11/10/2026; a revisão de resultado de T6.4 pede duas semanas de uso e fica para **25/10/2026**. Linha de base para ela:

| Métrica | Hoje | Como medir em 25/10 |
| --- | --- | --- |
| Arremate dentro da faixa (backtest, motor das telas) | 48,0% de 5.255 vendas estimadas (6.404 alvos desde 15/09); alta 50,3%, média 43,2%, baixa 49,3% | `npm run db:estimate-backtest -- --variant v1 --write`; a Calibração mostra o novo número |
| Erro mediano da mediana (backtest) | 19,4% (alta 12,5%, média 18,0%, baixa 24,1%) | o mesmo comando |
| Análises fixadas com snapshot de mercado | 0 de 75 (todas fixadas antes da migration de D-74; a última em 11/10 00:40 UTC) | fixadas depois de 11/10 com `market_snapshot` não nulo ÷ fixadas depois de 11/10; meta acima de 80% |
| Tempo do lote ao limite fixado | mediana de 29 s, dominada pelos lotes dos testes E2E, que nascem e são fixados no mesmo minuto | mediana de `fixed_at − lots.created_at` sem os lotes dos testes E2E; a base de hoje não serve de comparação |
| Calibração | 10 resultados `prior` do usuário de desenvolvimento, todos de lotes E2E e sem faixa da época | resultados reais registrados depois de 11/10, com a faixa do snapshot |
