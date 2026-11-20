# Plano: filtros dos Leilões e de Minhas análises

Status: **aprovado em 2026-10-07**. Decisão registrada em `docs/ARCHITECTURE.md` §15 (D-43).

## 1. Problema

O formulário de "Leilões" tinha oito campos sempre visíveis e um botão "Filtrar". Para mudar uma coisa era preciso achar o campo, digitar e enviar. O usuário não via quantos lotes cada escolha deixava nem quais filtros estavam ligados sem reler o formulário. Faltavam critérios de compra: preço frente ao valor de mercado, quilometragem, origem, prazo e alertas da condição. No celular, os oito campos ocupavam a tela antes do primeiro lote.

Levantamento no banco (07/10/2026), com 3.589 anúncios:

- **Valor de mercado:** 2.390 (Leilo e Pátio; a Freitas não informa).
- **Quilometragem:** 2.033.
- **Origem (`recovery_type`):** texto livre com 18 grafias. Financiamento tem 2.574 (inclui "FINACIAMENTO"), seguradora 487, frota 8. O resto é "LEILOSHOP", "-" ou vazio.
- **Combustível:** 27 grafias. Viram flex, gasolina, diesel e elétrico/híbrido.
- **Chave:** informada em 2.959.
- **Alertas da condição:** circulação vedada 174, remarcado 57, airbag acionado 27, laudo reprovado 26.

## 2. Tela

**Barra superior (desktop):**

- Busca com sugestões de marca e modelo, cada uma com a contagem.
- Botões **Preço**, **Ano** e **Distância**, cada um abrindo um popover. O rótulo do botão mostra o valor escolhido, por exemplo "Até R$ 30 mil", "2015–2020" ou "150 km".
- Botão **Mais filtros (n)**.

**Mais filtros:** painel lateral com seções.

- **Veículo:** categoria (chips com ícone), combustível, quilometragem e "Só com chave".
- **Condição:** escala da monta e "Esconder": circulação vedada, remarcado, airbag acionado, laudo reprovado.
- **Leilão:** fonte, origem, encerra em, lances e "Só novos (24 h)".
- **Minhas análises:** já analisados (mostrar, esconder ou só eles).

O rodapé do painel tem "Limpar" e "Ver N lotes".

**Celular:** busca e o botão **Filtros (n)**, que abre uma gaveta inferior com todas as seções. Preço, ano e distância vêm primeiro.

**Linha de resultado:**

- Total ("128 lotes abertos"), com "Atualizando…" enquanto a tela recarrega.
- Seletor **Abertos | Encerrados**.
- **Ordenar:** encerra primeiro, menor lance, menor % do mercado, mais perto ou novos. Encerrados ordenam por "encerrados há menos tempo".

**Filtros ativos:**

- Um chip por filtro, com "×" para tirar, e "Limpar tudo".
- Os atalhos ainda desligados aparecem como sugestões: "+ Encerra em 48 h", "+ Sem monta", "+ Até 60% do mercado" e "+ Novos (24 h)".

**Comportamento:**

- Cada escolha aplica na hora e vai para a URL; a página volta para 1.
- A busca aplica 400 ms depois da última tecla.
- O preço aplica ao soltar o controle.
- Os padrões ficam fora da URL.

**Controles:**

- **Preço:** faixa com dois pontos sobre uma escala não linear (0 a R$ 200 mil, com "sem limite"), campos exatos de mínimo e máximo e "% do mercado" (qualquer, 40, 50, 60, 70, 80).
- **Ano:** grade de anos com escolha de faixa (primeiro clique: início; segundo: fim) e atalhos ("Até 5 anos", "Até 10 anos", "Qualquer").
- **Distância, quilometragem, encerra em, lances, condição e já analisados:** controle segmentado (rádio).
- **Categoria, fonte, origem e combustível:** chips de seleção múltipla com a contagem, contada com os demais filtros aplicados (faceta).
- **Ordenar:** select.

**Salvar como monitor:** um link leva a `/monitores/novo` com os critérios atuais já preenchidos.

**Por leilão (`/leiloes`):**

- Mesma barra, sem "Ordenar". O total é de leilões.

**Leilão do catálogo:**

- Mesma barra, sem o filtro de fonte, que não se aplica a um leilão só.

## 3. URL

| Parâmetro | Valores | Padrão |
| --- | --- | --- |
| `busca` | texto | — |
| `anoDe`, `anoAte` | ano | — |
| `precoDe`, `precoAte` | reais inteiros | — |
| `mercado` | `40`, `50`, `60`, `70`, `80` (lance até X% do valor de mercado) | — |
| `kmAte` | `50000`, `100000`, `150000` | — |
| `distancia` | `50`, `100`, `150`, `300`, `todas` | `150` |
| `categoria` | lista: `carros,motos,utilitarios,pesados,sucatas,outros` ou `todas` | carros, motos e utilitários |
| `condicao` | `qualquer`, `sem-monta`, `ate-pequena`, `ate-media`, `com-monta` | `qualquer` |
| `ocultar` | lista: `impedido,remarcado,airbag,laudo-reprovado` | — |
| `fonte` | lista de ids de fonte | — |
| `origem` | lista: `financiamento,seguradora,frota,outros` | — |
| `combustivel` | lista: `flex,gasolina,diesel,eletrico` | — |
| `chave` | `1` | — |
| `lances` | `com`, `sem` | — |
| `encerra` | `24h`, `48h`, `7d` (só abertos) | — |
| `novos` | `1` (vistos pela primeira vez nas últimas 24 h) | — |
| `analisados` | `esconder`, `so` | mostrar |
| `situacao` | `abertos`, `encerrados` | `abertos` |
| `ordem` | `encerra`, `menor-lance`, `mercado`, `perto`, `novos` | `encerra` |

Listas são separadas por vírgula. As chaves antigas de categoria (`veiculos`, `carros`…) continuam valendo, então links antigos e monitores não quebram.

## 4. Decisões técnicas

- **Critérios comuns.** `ListingCriteria` (`src/domain/listings/criteria.ts`) ganha preço mínimo, % do mercado, km máxima, categorias múltiplas, esconder, fonte, origem, combustível e "só com chave". `matchesCriteria` cobre todos: os monitores usam os mesmos critérios. Prazo, lances, novos, já analisados e ordem são só da tela. Num monitor eles não fazem sentido, porque o alerta é de lote novo.
- **Origem e combustível normalizados no domínio.** `originOf(recoveryType)` e `fuelOf(fuel)` classificam o texto da fonte. No banco, o filtro lê as grafias existentes (`distinct`, poucas dezenas), classifica e filtra por `in`. O texto original não muda.
- **Preço e % do mercado no banco:** colunas geradas `price_cents` (lance atual ou, sem lance, o inicial) e `market_ratio_bps` (preço ÷ valor de mercado, em basis points), `STORED`. Filtram e ordenam sem que o coletor precise lembrar de mantê-las. O restore ignora colunas geradas.
- **Facetas e sugestões:** uma consulta leve traz os anúncios no filtro sem os critérios de faceta (busca, categoria, fonte, origem e combustível). A contagem de cada chip, com os outros chips aplicados, e as sugestões de busca saem dessa lista, em regra pura (`src/domain/listings/facets.ts`).
- **"Mais perto"** ordena pela distância calculada; usa o caminho de candidatos com teto (`MAX_CANDIDATES`), como o filtro por raio.
- **Monitores:**
  - Colunas novas em `watches`; `categories text[]` substitui `category`.
  - Expandir → migrar → contrair: `category` fica nula e sem uso nesta versão e sai num release seguinte.
  - O formulário do monitor usa os mesmos controles.
- **Novas primitivas em `@/components/ui`:** `Popover` (`@radix-ui/react-popover`), `Slider` (`@radix-ui/react-slider`), `SegmentedControl` (sobre o RadioGroup do Radix, já instalado), `ToggleChip`, `RemovableChip` e `DrawerContent` (Dialog lateral ou inferior).

## 5. Minhas análises

- **Lance × limite:** abaixo, no limite, acima, sem lance viável, sem comparação. É a mesma regra de `compareToFixedLimit`.
- **Leilão:** próximos ou já realizados.
- **Ordenar:** data do leilão (padrão), maior folga até o limite ou atualizados recentemente.
- **Mesma linguagem visual:** aplica na hora, chips ativos e total. A posição e a folga são calculadas fora do banco sobre os lotes do usuário (poucas centenas), com paginação depois do filtro.

## 6. Etapas

1. Documentos: este plano, D-43, SPEC, DESIGN e GUIA.
2. Domínio: critérios, origem, combustível, preço, facetas e sugestões (regras puras e testes).
3. Banco: migration (colunas geradas e monitores), consultas, restore.
4. Primitivas de UI.
5. Barra de filtros dos Leilões (desktop, celular, chips, atalhos, ordem, sugestões e "Salvar como monitor").
6. Monitores com os critérios novos.
7. Minhas análises.
8. Fechamento: E2E, `npm run check` e `npm run build`, conferência no navegador e revisão de usabilidade em ciclo até não haver achados.

## 7. Fora deste plano

- **Histograma de preços na faixa.**
- **"Novos desde a última visita":** precisa guardar a visita por usuário. Fica "novos nas últimas 24 h".
- **Remover a coluna `watches.category`:** fica para o release seguinte.
