# Plano: dashboard orientado à próxima decisão

Status: **aprovado em 2026-10-08**. Decisão registrada em `docs/ARCHITECTURE.md` §15 (D-44).

## 1. Problema

O dashboard mostra só os registros do usuário: contagens ("11 leilões · 28 lotes · 16 acompanhados"), lotes acompanhados, os leilões que ele cadastrou, pendências e o indicador de decisões. O catálogo (1.101 anúncios abertos em 08/10/2026), o preço provável (D-36) e as premissas padrão (D-38) não aparecem. Para saber o que vale olhar hoje, o usuário precisa abrir "Leilões" e filtrar.

A home passa a responder, nesta ordem:

1. O que vale analisar agora?
2. Os lotes que acompanho ainda cabem no meu limite?
3. O que está pendente?
4. Minhas decisões têm acertado?

## 2. Medição (08/10/2026)

Medido com as mesmas regras puras do produto, sobre o banco de produção, só leitura.

**Base:** 1.506 vendas no último ano (base do preço provável), 1.101 anúncios abertos, 29 lotes com análise fixada, 2 monitores ligados ("Fox" e "Gol 1.6").

**Os monitores não sustentam a lista.** Só 4 anúncios abertos casam com algum monitor. Uma lista "para analisar" baseada só neles ficaria quase sempre vazia.

**O limite estimado pelas análises do usuário (D-36) quase nunca existe.** Ele exige 3 análises fixadas do mesmo modelo, ano ±1, e cobre 5 dos 1.101 abertos (0,5%). O **limite pelas premissas padrão** (D-38, a partir da FIPE do anúncio) cobre 99% dos carros, 96% das motos e 99% dos utilitários.

**Preço provável por categoria (abertos):**

| Categoria | Abertos | Por comparáveis | Pela proporção | Sem base |
| --- | ---: | ---: | ---: | ---: |
| Carros | 398 | 63 (16%) | 321 (81%) | 14 |
| Motos | 210 | 86 (41%) | 111 (53%) | 13 |
| Utilitários | 70 | 1 | 58 (83%) | 11 |
| Pesados, outros, sucatas | 423 | 0 | 21 | 402 |

Pela proporção, o preço provável é o valor de mercado vezes a proporção do grupo (categoria e condição). Ele diz pouco sobre o lote específico. Só os comparáveis olham para o veículo.

**Preço provável × limite pelas premissas padrão**, no filtro padrão do catálogo (até 150 km de São Carlos; carros, motos e utilitários): 86 anúncios.

| Situação | Por comparáveis | Pela proporção |
| --- | ---: | ---: |
| Cabe com folga (P75 ≤ limite) | 4 | 11 |
| No limite (mediana ≤ limite < P75) | 2 | 39 |
| Provável acima (mediana > limite) | 9 | 21 |

Isso dá uma lista de 6 lotes com sinal forte e mais 50 com sinal fraco, um tamanho bom para a home.

**As premissas padrão são pessimistas, como pretendido.** Nas vendas do último ano, o lance final coube no limite padrão em 47% dos carros, 27% dos utilitários e 20% das motos. Com essas premissas, quase nenhuma moto entra na lista. Isso é informação, não defeito: com reparo e margem padrão, a moto típica de leilão não deixa margem.

**O lance atual subestima o final.** Nas vendas com observação perto do fim, o lance observado ficou nesta proporção do lance final:

| Antes do fim | Vendas | P25 | Mediana | P75 |
| --- | ---: | ---: | ---: | ---: |
| 48 h | 245 | 81% | 90% | 95% |
| 24 h | 268 | 87% | 94% | 97% |
| 6 h | 318 | 94% | 98% | 99% |

Dois dias antes, um em cada quatro lotes ainda sobe mais de 19%. Por isso a home compara **preço provável com limite**, e não lance atual com histórico. O lance atual aparece como dado, não como sinal.

**Encerramentos são concentrados por leilão.** Em 08/10, 386 abertos encerravam em menos de 24 h (quatro leilões no dia 09) e nenhum entre 24 h e 5 dias. Um contador "encerram em 48 h" oscilaria entre 0 e centenas. A home mostra o próximo leilão, não uma janela fixa.

**Acompanhados:** 16 sem resultado, todos ligados a anúncio aberto e com análise fixada; 12 têm preço provável.

## 3. Tela

**Cabeçalho.** Título "Dashboard" e uma linha de contagens que levam a uma ação, no lugar das contagens de cadastro:

> 6 para analisar · próximo leilão na região: ter 13/10, 23 lotes · 16 acompanhados, 3 com provável acima do limite · 1 pendência

Cada trecho é link para o bloco ou a tela correspondente. A ação principal passa a ser **"Ver leilões"**; "Novo leilão" vira secundária.

**Alertas não lidos.** Como hoje, só quando há.

**Coluna principal:**

1. **Para analisar agora** (bloco novo). Até 6 cartões de anúncio (`ListingCard`, o mesmo de "Leilões"), com lance, preço provável (faixa e `n`), limite e a situação ("cabe com folga" ou "no limite"). Rodapé: "e mais N no filtro padrão · Ver leilões". Sem lote: "Nenhum lote da região cabe no limite agora", com o link.
2. **Lotes acompanhados.** Ordenados pelo encerramento do anúncio. Cada linha ganha o preço provável ao lado do limite fixado e a situação frente a ele. A frase que importa é "provável acima do seu limite".
3. **Próximos leilões na região.** Leilões do catálogo nos próximos 7 dias com anúncio no filtro padrão ou em algum monitor: data, fonte, lotes no filtro e quantos cabem no limite. Substitui a lista dos leilões cadastrados pelo usuário, que continua em "Minhas análises".

**Coluna lateral:** pendências, indicador de decisões e coleta, sem mudança. O indicador "X de Y dentro do limite" fica visível: é a medida do principal ativo do produto (SPEC §1).

**Celular:** a mesma ordem numa coluna, com "Para analisar agora" logo depois dos alertas.

## 4. Regras

**Situação do preço provável frente ao limite** (regra pura nova):

- **Cabe com folga:** P75 do preço provável ≤ limite.
- **No limite:** mediana ≤ limite < P75.
- **Provável acima:** mediana > limite.
- **Sem base:** sem preço provável, sem limite ou limite inviável.

**Limite usado no cartão.** Primeiro o limite estimado pelas análises do usuário (D-36), quando existe. Senão, o **limite pelas premissas padrão** (D-38) calculado do anúncio. O rótulo diz qual é: "limite pelo seu histórico (n análises)" ou "limite pelas premissas padrão". Nos acompanhados, o limite é sempre o fixado pelo usuário.

**Base da lista "Para analisar agora":**

- Anúncios abertos no **filtro padrão do catálogo** (`DEFAULT_CRITERIA`: até 150 km de São Carlos; carros, motos e utilitários) **ou** em algum monitor ligado.
- Fora: os que o usuário já adicionou à análise.
- Só "cabe com folga" ou "no limite".
- Ordem: comparáveis antes de proporção, folga antes de "no limite" e, depois, encerra primeiro.

**Nada vira decisão.** A situação é uma estimativa rotulada (D-28). Ela não fixa análise, não usa FIPE fora do anúncio e mostra amostra e método. Sem score, sem "lucro potencial" e sem "economia" (SPEC §5).

## 5. Decisões técnicas

- **Domínio:**
  - `defaultMaxBid(input: DefaultsInput): MaxBidOutcome` em `src/domain/finance/defaults.ts` junta `defaultAssumptions` e `calculateMaxBid`, a mesma conta do rascunho padrão.
  - `limitFit(price: PriceEstimate, limit: Cents | null)` em `src/domain/listings/estimates.ts` devolve a situação e o método.
  - Ambas com testes.
- **Limite do cartão:** `LimitEstimate` ganha o caso `{ kind: "defaults"; maxBid }`. Vale também nos cartões de "Leilões" e dos alertas, para o mesmo anúncio mostrar o mesmo limite em toda tela. `listingCardSelect` passa a trazer os campos de `listingForDefaultsSelect`.
- **Consultas** em `src/features/dashboard/queries.ts`:
  - `getToAnalyze()`: candidatos pelo filtro padrão e pelos monitores, com o caminho de candidatos com teto que o filtro por raio já usa. São cerca de 90 anúncios.
  - Os acompanhados ganham o preço provável e o encerramento do anúncio ligado.
  - Os próximos leilões reaproveitam `listCatalogAuctions`.
  - O contexto de estimativas (`loadEstimateContext`) é carregado uma vez por requisição. Sem `"use cache"` (D-04).
- **Componentes:** cada bloco no seu `<Suspense>` com `Skeleton`, como hoje. Nenhum Client Component novo.
- **Sem dependência nova, sem migration.**

## 6. Aprovado em 08/10/2026

1. **Limite pelas premissas padrão nos cartões** quando não há 3 análises comparáveis. Amplia D-36: hoje o cartão mostra "sem base (x de 3)" em 99,5% dos anúncios.
2. **Filtro padrão do catálogo como base da home**, além dos monitores. Hoje os monitores sozinhos dão 4 anúncios.
3. **"Próximos leilões" passa a ser do catálogo**, e os leilões cadastrados pelo usuário saem da home.
4. **"Ver leilões" como ação principal** e "Novo leilão" como secundária.

## 7. Etapas

1. Documentos: este plano, D-44, SPEC §5, DESIGN §15.1 e GUIA.
2. Domínio: `defaultMaxBid`, `limitFit` e o caso `defaults` do limite estimado, com testes.
3. Consultas: lista "para analisar", acompanhados com preço provável e próximos leilões do catálogo.
4. Tela: cabeçalho, bloco novo, acompanhados, próximos leilões e estados vazios; cartões de "Leilões" e alertas com o limite padrão.
5. Fechamento: E2E do dashboard, `npm run check` e `npm run build`, conferência no navegador (desktop e celular) e revisão de usabilidade em ciclo até não haver achados.

## 8. Fora deste plano

- **Filtro e ordem "cabe no limite" em "Leilões".** O "Ver leilões" do bloco abre o filtro padrão sem esse corte.
- **Calibração das premissas padrão pelos resultados** (47% dos carros e 20% das motos couberam no limite). Pertence à Fase 2 (SPEC §15), junto com a precisão das estimativas.
- **Perfil do comprador separado dos monitores.** O filtro padrão e os monitores cobrem o caso de um usuário só.
- **Score de oportunidade, busca em linguagem natural, análise de fotos, liquidez e comparador de leiloeiros** (SPEC §3, fora do MVP).
- **Pesados, sucatas e outros.** Não têm preço provável nem FIPE suficiente (0 comparáveis em 423 abertos).
