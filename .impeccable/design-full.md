---
name: Leilão Tracker
description: Ferramenta privada de análise financeira e acompanhamento de leilões de veículos (Cirúrgico & Monocromático v3.0).
colors:
  primary: "#111318"
  primary-hover: "#252932"
  primary-active: "#000000"
  primary-subtle: "#eef0f3"
  accent: "#1d4ed8"
  accent-hover: "#1e40af"
  accent-subtle: "#eff4ff"
  background: "#fafafb"
  surface: "#ffffff"
  surface-subtle: "#f3f4f6"
  foreground: "#111318"
  foreground-secondary: "#3e434d"
  muted: "#626773"
  muted-subtle: "#8b909b"
  border: "#eaecef"
  border-strong: "#dadde3"
  control-border: "#878c98"
  success: "#047857"
  success-subtle: "#ecfdf5"
  warning: "#92400e"
  warning-subtle: "#fffbeb"
  error: "#be123c"
  error-subtle: "#fff1f2"
  info: "#1d4ed8"
  info-subtle: "#eff4ff"
typography:
  display:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "2.625rem"
    fontWeight: 600
    lineHeight: 1.08
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 500
    lineHeight: 1.35
  mono:
    fontFamily: "JetBrains Mono, ui-monospace, SFMono-Regular, monospace"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.35
rounded:
  sm: "4px"
  md: "6px"
  lg: "10px"
  xl: "14px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: "8px 14px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: "8px 14px"
  card-default:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
    padding: "24px"
  card-summary:
    backgroundColor: "{colors.surface-subtle}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
    padding: "24px"
---

# Leilão Tracker — Design System

> Versão: 3.0 • Data: 21/11/2026 • Status: fonte de verdade visual. Direção **Cirúrgico & Monocromático** (Linear Light / Precision Workbench).
>
> Este documento complementa o [`SPEC.md`](./SPEC.md). O `SPEC.md` define produto, domínio e comportamento; este arquivo define apresentação, composição e interação.

## Estado atual e origem das decisões

O projeto possui a fundação em Next.js 16, Tailwind CSS 4, Radix UI, `motion` e biblioteca reutilizável em `src/components/ui`. Portanto:

- Em 21/11/2026 o usuário escolheu a direção **v3.0 — "Cirúrgico & Monocromático"** (Precision Workbench claro estilo Linear Light), substituindo a antiga Direção A (papel quente `#F7F7F4`, Hanken Grotesk e sidebar fixa de `296px`).
- Fontes obrigatórias: **Inter** (`cv02`, `cv03`, `cv04`, `cv11`) na interface e **JetBrains Mono** em códigos (número do lote, atalhos `⌘K`, identificadores).
- Casca arquitetônica de borda a borda: **Sidebar colapsável** (`264px` expandida ↔ `56px` só ícones, atalho `Ctrl+B`) em `#FAFAFB` com topo próprio de `48px` (marca e botão de recolher/expandir), gatilho de busca rápida `⌘K` integrado no topo da sidebar e dock da conta ancorado no rodapé, e **Header fixo de `48px` à direita da sidebar** sobre o canvas branco puro (`#FFFFFF`) com breadcrumb clicável à esquerda e central de notificações (+ busca e conta abaixo de `lg`) à direita, separados por linhas hairline (`#EAECEF`).
- Paleta acromática cirúrgica: ação principal em **tinta** (`#111318`). Cor aparece apenas no **veredicto financeiro** (`#047857` esmeralda / `#BE123C` carmesim / `#92400E` âmbar), em foco/links (`#1D4ED8`) e na escala sequencial dos gráficos de Mercado.
- Acabamento guiado pelo combo de skills do projeto (`impeccable`, `emil-design-eng`, skills de Jakub Krehel, `web-design-guidelines`, `frontend-design` e `modern-web-guidance`): curvas customizadas (`--ease-out`, `--ease-drawer`), `active:scale-[0.97]`, popovers orientados pelo gatilho, zero animação em ações de teclado (`⌘K`, `Ctrl+B`), `text-wrap: balance/pretty`, `line-height` sem unidade, `overscroll-behavior: contain` em overlays e inputs em `16px` no mobile (`text-base sm:text-body`).

Alterar uma decisão deste arquivo exige atualizar primeiro o token ou contrato correspondente e depois aplicar a mudança ao código.

---

## 1. Design System Overview

O Leilão Tracker é uma ferramenta privada de análise financeira e acompanhamento de leilões. Sua interface deve transmitir organização, precisão e prudência. O produto não deve parecer uma plataforma de apostas, uma loja de carros ou um painel de negociação em tempo real.

### Personalidade visual

- **Sóbria:** superfícies claras, cores controladas e pouca decoração.
- **Analítica:** números, unidades, datas e comparações têm leitura imediata.
- **Confiável:** estados e resultados usam texto explícito e não dependem apenas de cor.
- **Prática:** ações frequentes ficam próximas do conteúdo ao qual se aplicam.
- **Calma:** alertas visuais aparecem somente quando existe uma condição que pede atenção.

### Objetivos de UX

1. Permitir que o usuário entenda a situação de um lote em poucos segundos.
2. Deixar clara a diferença entre lance observado, lance simulado, lance máximo e preço final.
3. Reduzir erros na entrada de valores financeiros.
4. Preservar o contexto de análises fixadas e resultados históricos.
5. Manter formulários longos previsíveis e fáceis de revisar.
6. Funcionar em telas pequenas sem esconder informação essencial.

---

## 2. Design Principles

### 2.1 Clareza antes de decoração

Cada elemento deve ajudar a identificar, comparar, editar ou confirmar informação. Gradientes, texturas, vidro fosco, brilhos e efeitos automotivos decorativos não fazem parte do sistema.

### 2.2 Números com contexto

Todo valor monetário deve ter rótulo, moeda e significado. Não mostrar `R$ 33.200` isoladamente quando pode haver dúvida entre lance, custo ou margem.

### 2.3 Decisões explícitas

Estados como “Abaixo do limite”, “Acima do limite” e “Análise retrospectiva” devem aparecer por escrito. Cor e ícone reforçam o estado, mas não carregam o significado sozinhos.

### 2.4 Hierarquia estável

Título da página, contexto, ações e conteúdo devem aparecer sempre na mesma ordem. Uma nova página deve reutilizar a composição definida em “UI Patterns”.

### 2.5 Consistência por tokens

Cores, tamanhos, espaçamentos, raios e sombras devem vir das escalas deste arquivo. Valores arbitrários só são aceitáveis quando representam uma dimensão intrínseca do conteúdo, como a proporção de uma foto.

### 2.6 Densidade confortável

A interface deve comportar dados suficientes para análise sem comprimir controles ou reduzir legibilidade. Tabelas podem ser mais densas que formulários, mantendo alvo interativo mínimo de 40 px.

### 2.7 Acessibilidade desde o componente

Contraste, foco, teclado, semântica, mensagens e áreas clicáveis são requisitos do componente, não ajustes posteriores.

### 2.8 Mobile preserva a tarefa

Em telas pequenas, conteúdo pode mudar de posição ou formato. Informações financeiras, estado do lote e ação principal continuam disponíveis.

---

## 3. Design Tokens

Os nomes semânticos são a API visual do projeto. O código deve consumir `background`, `foreground`, `primary` e demais papéis, evitando cores literais dentro de componentes.

## Colors

### 3.1 Paleta e papéis semânticos

#### Tokens base

| Token | Valor | Uso | Não usar para |
| --- | --- | --- | --- |
| `background` | `#FAFAFB` | Chrome cirúrgico: fundo do header fixo (`48px`) e da sidebar colapsável. | Fundo de campos. |
| `surface` | `#FFFFFF` | Canvas principal de conteúdo, cards, tabelas e formulários. | Criar camadas sem necessidade. |
| `surface-subtle` | `#F3F4F6` | Superfície rebaixada: painéis de resumo/cálculo, campos readonly e grupos secundários. | Estados selecionados ou alertas. |
| `surface-elevated` | `#FFFFFF` | Dialogs, menus, popovers e `CommandPalette` com sombra em camadas. | Cards comuns que não flutuam. |
| `foreground` | `#111318` | Tinta: texto principal, títulos e os números que decidem. | Texto sobre fundos escuros sem verificar contraste. |
| `foreground-secondary` | `#3E434D` | Descrições, itens da navegação e informação complementar. | Placeholder ou texto desabilitado. |
| `muted` | `#626773` | Metadados, captions, rótulos de dado e cabeçalhos de tabela. Mantém ≥ 4,7:1 até sobre `surface-subtle`. | Corpo de texto longo. |
| `muted-subtle` | `#8B909B` | Ícones da navegação em repouso e conteúdo desabilitado. | Informação necessária para completar uma tarefa. |
| `placeholder` | `#626773` | Sugestão de preenchimento, com contraste de texto normal. | Substituir o label. |
| `border` | `#EAECEF` | Linhas hairline: header, sidebar, divisores, linhas de tabela e borda de cards. | Identificar controles, erro ou foco. |
| `border-strong` | `#DADDE3` | Divisores marcados e contorno do botão Secondary. | Identificar limites de campos. |
| `control-border` | `#878C98` | Inputs, selects, checkbox e radio (≥ 3:1 sobre `surface`). | Contornar todos os cards. |
| `overlay` | `rgba(17, 19, 24, 0.42)` | Fundo atrás de dialogs e drawers. | Superfícies permanentes. |

#### Tinta, acento e interação

| Token | Valor | Uso | Não usar para |
| --- | --- | --- | --- |
| `primary` | `#111318` | Tinta: botão principal, checkbox, radio e switch marcados, marca. | Links e foco (use `accent`). |
| `primary-hover` | `#252932` | Hover do botão principal. | Estado permanente. |
| `primary-active` | `#000000` | Pressionado. | Item apenas selecionado. |
| `primary-subtle` | `#EEF0F3` | Fundo do item ativo da navegação e badges neutros. | Botão principal. |
| `primary-subtle-hover` | `#E3E6EB` | Hover sobre fundo neutro. | Alertas. |
| `primary-disabled` | `#A8ADB8` | Fundo de ação principal desabilitada. | Estado de carregamento ativo. |
| `accent` | `#1D4ED8` | Link inline, anel de foco, borda de campo em foco, seleção e contador de alertas. | Botão principal, decoração e ícones em geral. |
| `accent-hover` | `#1E40AF` | Hover de link e texto selecionado. | Estado permanente. |
| `accent-subtle` | `#EFF4FF` | Linha selecionada, seleção de texto e hover do botão Outline. | Alertas informativos genéricos. |

Texto sobre `primary`, `primary-hover` e `primary-active` deve ser `#FFFFFF`. O item ativo da navegação usa fundo `primary-subtle` com contorno hairline `border` e texto/ícone em tinta.

Ações destrutivas usam `error-hover: #9F1239` e `error-active: #881337`; não reduzir opacidade do fundo, pois isso reduz o contraste do texto branco. `control-border` mantém pelo menos 3:1 contra `surface` e `surface-subtle`; `placeholder` mantém pelo menos 4,5:1 nessas superfícies.

#### Estados semânticos

| Papel | Base | Fundo suave | Borda suave | Finalidade |
| --- | --- | --- | --- | --- |
| `success` | `#047857` | `#ECFDF5` | `#A7F3D0` | Operação concluída, valor abaixo do limite e folga positiva. |
| `warning` | `#92400E` | `#FFFBEB` | `#FDE68A` | Atenção, dado incompleto ou proximidade do limite. |
| `error` | `#BE123C` | `#FFF1F2` | `#FECDD3` | Falha, validação inválida e valor acima do limite. |
| `info` | `#1D4ED8` | `#EFF4FF` | `#BFDBFE` | Informação contextual e orientação neutra. |

Regras:

- Use a cor base para texto e ícones. Badges e alerts usam fundo e borda suaves do estado (ou contorno `border` na variante neutra).
- “Abaixo do limite” usa `success`; “No limite” e “Sem lance viável” usam `warning`; “Acima do limite” usa `error`.
- Status de domínio como “Agendado”, “Encerrado” ou “Rascunho” não deve herdar automaticamente sucesso ou erro. Use aparência neutra, salvo quando o estado exigir ação.
- `success` significa que uma condição foi atendida; não significa compra segura, lucro garantido ou recomendação.
- Não usar vermelho em ações de arquivar. Vermelho é reservado para erro e destruição irreversível.

#### Dados (gráficos)

Escala sequencial de um tom (petróleo), para magnitude em mapa, histograma e barras de faixa (D-45). Validada com o verificador de paletas (ordinal: um tom, luminosidade crescente, passos distinguíveis, passo claro ≥ 2:1 contra `surface`). Gráficos ficam sobre `surface`, nunca sobre `background`, onde o passo claro não chega a 2:1.

| Token | Valor | Texto sobre o passo | Contraste do texto |
| --- | --- | --- | --- |
| `data-1` | `#84BCD1` | `foreground` | 8,6:1 |
| `data-2` | `#4F9CBA` | `foreground` | 5,8:1 |
| `data-3` | `#2A7696` | branco | 5,1:1 |
| `data-4` | `#195C7A` | branco | 7,4:1 |
| `data-5` | `#0D3F58` | branco | 11,2:1 |

Regras:

- **Um tom só, do claro ao escuro.** Mais escuro = valor maior. Sem verde e vermelho: no Mercado, mais barato não é "bom" (§3.1, estados semânticos).
- **Sem base não tem cor.** Grupo com 1 a 4 casos usa `surface-subtle` com o número em `muted`; sem caso nenhum, só o contorno `border-strong`.
- **O valor está escrito.** Cor reforça; o número aparece no estado, na barra ou na tabela equivalente.
- **Marcas de referência em tinta.** Mediana em `foreground`, faixa P25–P75 em `data-1`, eixos e grade em `border` e rótulos em `muted`. Texto nunca usa a cor da série.
- **Seleção usa `accent`.** O estado escolhido no mapa recebe anel de 2 px em `accent`, como o foco.

#### Valores financeiros

- Valores comuns usam `foreground`.
- O lance máximo e a folga até o limite são "o número que decide": `display` em tinta (a folga pode usar `success` ou `error`), no máximo um por tela.
- Margem positiva usa `success` apenas quando acompanhada do rótulo “Margem estimada”.
- Margem negativa usa `error` e sinal negativo explícito.
- Valores desconhecidos usam travessão `—` com `muted`, nunca `R$ 0,00`.

## Typography

### 3.2 Famílias e escala tipográfica

#### Famílias

```css
--font-sans: var(--font-inter);          /* Inter via next/font/google, pesos 400–700 */
--font-mono: var(--font-jetbrains-mono); /* JetBrains Mono via next/font/google, pesos 400 e 500 */
```

- Use **Inter** (`cv02`, `cv03`, `cv04`, `cv11`) em toda a interface.
- Use **JetBrains Mono** em códigos: a linha de contexto acima do título ("LOTE 0152 · DETRAN · 14/10"), número de lote, atalhos (`⌘K`, `Ctrl K`), versão e identificadores técnicos.
- Valores monetários ficam em Inter com numerais tabulares (`tabular-nums`); não usar monospace como estilo decorativo.
- Não introduzir outras famílias sem atualizar este documento.

#### Pesos

| Peso | Nome | Uso |
| ---: | --- | --- |
| `400` | Regular | Corpo, descrição, helper e valor comum. |
| `500` | Medium | Labels, navegação, tabs e ênfase secundária. |
| `600` | Semibold | Títulos, botões, valores-chave e cabeçalhos de tabela. |
| `700` | Bold | Título principal de destaque; usar com moderação. |

#### Escala

| Token | Tamanho / linha | Peso padrão | Uso |
| --- | --- | ---: | --- |
| `display` | `46px / 50px` | `600` | O número que decide (lance máximo, folga até o limite). No máximo um por tela. Espaçamento `-0.035em`. |
| `heading-1` | `32px / 38px` | `600` | Título da página. Espaçamento `-0.02em`. |
| `heading-2` | `24px / 30px` | `500` | Valores de apoio (lance atual, meu limite) e título de dialog. Espaçamento `-0.02em`. |
| `heading-3` | `15px / 22px` | `600` | Título de seção, card e grupo de formulário. |
| `body-lg` | `16px / 24px` | `400` | Introdução e descrição importante. |
| `body` | `14px / 20px` | `400` | Texto padrão, controles, células e navegação (500). |
| `label` | `13px / 18px` | `500` | Labels de campo e tabs. |
| `caption` | `12px / 16px` | `400` | Metadado, helper, timestamp e cabeçalho de tabela (500). |
| `overline` | `12px / 16px` | `400` | Linha de contexto em `font-mono`, caixa alta, `0.02em`, cor `muted`. |

Regras:

- Não usar texto menor que 12 px.
- Abaixo de `md` (768 px), `display` usa `36px / 42px` e `heading-1` usa `26px / 32px`. Os demais tokens permanecem.
- A escala é implementada em `@theme inline`: use `text-heading-1`, `text-heading-2`, `text-heading-3`, `text-body-lg`, `text-body`, `text-label`, `text-caption` e `text-overline`. Cada classe aplica tamanho e linha; títulos, label e overline também aplicam seu peso semântico. Botões aplicam `font-semibold`.
- `cn()` reconhece esses nomes como tamanhos tipográficos, permitindo combinar `text-heading-2` e `text-foreground` sem apagar nenhuma classe.
- Corpo de texto não usa peso 500 para compensar contraste insuficiente.
- Valores financeiros usam `font-variant-numeric: tabular-nums`.
- Evitar caixa alta, exceto em overlines curtas. Não usar em frases, botões ou mensagens.
- Truncamento só é permitido quando o valor completo estiver acessível por tooltip ou contexto expandido.

### 3.3 Spacing

O sistema usa uma base de 4 px.

| Token | Valor | Uso típico |
| --- | ---: | --- |
| `space-0` | `0` | Remover espaço por regra explícita. |
| `space-1` | `4px` | Separação entre ícone e indicador, ajustes internos. |
| `space-2` | `8px` | Ícone + texto, itens compactos, badges. |
| `space-3` | `12px` | Campos relacionados e padding compacto. |
| `space-4` | `16px` | Gap padrão de formulário e padding mobile. |
| `space-5` | `20px` | Padding de card compacto. |
| `space-6` | `24px` | Padding padrão de card e gap de grid. |
| `space-8` | `32px` | Separação entre blocos dentro de uma seção. |
| `space-10` | `40px` | Separação entre seções no mobile. |
| `space-12` | `48px` | Separação entre seções no desktop. |
| `space-16` | `64px` | Respiro de páginas especiais, como login. |

Regras:

- Use 8 px entre rótulo e campo quando houver helper; 6 px pode ser implementado apenas como token específico de campo, nunca como valor avulso.
- Use 16 px entre campos do mesmo grupo e 24–32 px entre grupos.
- Cards irmãos usam gap de 16 px no mobile e 24 px a partir de tablet.
- Não usar valores Tailwind arbitrários como `p-[18px]` quando um token atende à composição.

### 3.4 Border Radius

| Token | Valor | Uso |
| --- | ---: | --- |
| `radius-none` | `0` | Divisores e mídia que encosta nos limites do container. |
| `radius-sm` | `4px` | Badges pequenos e elementos compactos. |
| `radius-md` | `6px` | Inputs, botões, selects, tooltips e itens da navegação. |
| `radius-lg` | `10px` | Painel principal, cards, alerts, dropdowns e popovers. |
| `radius-xl` | `14px` | Dialogs, drawers e cards de destaque. |
| `radius-full` | `9999px` | Badges (pílula), contadores, avatares e indicadores circulares. |

Não misturar raios diferentes em elementos equivalentes. Inputs e botões lado a lado devem compartilhar `radius-md`.

### 3.5 Shadows / Elevation

```text
shadow-none: none
shadow-xs: 0 1px 1px rgba(21, 23, 28, 0.03)
shadow-sm: 0 1px 2px rgba(21, 23, 28, 0.06), 0 0 0 1px rgba(21, 23, 28, 0.035)
shadow-md: 0 8px 24px rgba(21, 23, 28, 0.10), 0 0 0 1px rgba(21, 23, 28, 0.04)
shadow-lg: 0 20px 48px rgba(21, 23, 28, 0.16), 0 0 0 1px rgba(21, 23, 28, 0.04)
```

- A hierarquia vem da troca de superfície (papel, branco, papel rebaixado) e de linhas finas, não de sombra. Cards comuns usam só a borda `border`.
- `shadow-xs` fica no botão Secondary; `shadow-sm` no painel principal.
- Menus e popovers usam `shadow-md`.
- Dialogs e drawers usam `shadow-lg` com overlay.
- Nunca usar sombra colorida, glow ou múltiplas sombras decorativas.

### 3.6 Breakpoints

Adotar os breakpoints padrão do Tailwind, salvo alteração documentada na implementação:

| Nome | Início | Comportamento principal |
| --- | ---: | --- |
| Mobile | `0px` | Uma coluna, navegação recolhida, cards empilhados. |
| `sm` | `640px` | Métricas em duas colunas e rótulos completos de paginação; formulários seguem em uma coluna. |
| Tablet `md` | `768px` | Formulários em duas colunas, padding de cards de 24 px, rodapés horizontais e tabela de lotes. |
| Desktop `lg` | `1024px` | Sidebar persistente e conteúdo ao lado. |
| Desktop amplo `xl` | `1280px` | Mais colunas em métricas e detalhes lado a lado. |
| Large desktop `2xl` | `1536px` | Conteúdo continua limitado; aumenta margem externa. |

O design é mobile first. Breakpoint indica mudança de composição, não uma classe de dispositivo.

---

## 4. Layout

### 4.1 Estrutura privada

- Em `lg` ou maior, a sidebar colapsável (`264px` expandida ↔ `56px` recolhida, atalho `Ctrl+B`/`⌘B`) fica sobre `background` (`#FAFAFB`), separada por borda hairline `border`, com topo próprio de `48px` (marca e botão recolher/expandir), gatilho da paleta rápida `CommandPalette` (`⌘K`/`Ctrl+K`) integrado e dock da conta no rodapé. Na rota `/dashboard`, o grupo `Acompanhando` da sidebar é ocultado para evitar duplicação com a seção principal.
- A coluna principal à direita traz o header fixo de `48px` sobre `surface` (`#FFFFFF`) com breadcrumb clicável à esquerda e central de notificações (falhas de coleta + novos alertas) à direita, seguido pelo canvas em `surface` (`#FFFFFF`).
- Abaixo de `lg`, o mesmo header fixo de `48px` traz o menu em gaveta (`MobileNav`), a marca, o contexto de rota (`md+`), o gatilho da paleta rápida, as notificações e o menu da conta.
- A área de conteúdo usa largura máxima de `1440px` (`max-w-360`), centralizada na coluna principal.
- Padding horizontal: `16px` no mobile (`px-4`), `24px` em `md` (`px-6`) e `32px` em `lg` (`px-8`).
- Padding vertical da página: `24px` no mobile (`py-6`) e `28px` no desktop `lg` (`py-7`).
- Espaço entre cabeçalho de página e conteúdo: `20–24px`.
- Espaço entre seções: `32–40px`.

### 4.2 Grid

- Grid padrão: 12 colunas no desktop, 8 no tablet e 4 no mobile.
- Gutter: `16px` no mobile; `24px` em `md` ou maior.
- Cards de métricas: 1 coluna no mobile, 2 em `sm`, até 4 em `xl`.
- Formulário: uma coluna no mobile; duas colunas em `md` para campos curtos relacionados.
- Campo longo, URL, observação e upload sempre podem ocupar a largura inteira.
- A análise financeira pode usar, em `xl`, formulário com 7 colunas e resumo fixo com 5 colunas.

### 4.3 Cabeçalho de página

Ordem obrigatória:

1. Breadcrumb opcional (`Breadcrumbs`, `BreadcrumbLink`, `BreadcrumbPage` em `src/components/layout/breadcrumbs.tsx`).
2. Linha de contexto opcional em mono (`eyebrow`): "LOTE 0152 · 02/10/2030, 10:00".
3. Título (`heading-1`) com as ações alinhadas à base, à direita.
4. Descrição curta em `muted` e, abaixo, a situação (`meta`): badges e data de fixação.
5. Tabs ou filtros, quando pertencem à página inteira.

No mobile, ações secundárias podem ir para menu. A ação principal continua visível e pode ocupar a largura inteira.

### 4.4 Alinhamento de dados

- Texto e datas ficam alinhados à esquerda.
- Valores monetários e quantidades em tabelas ficam alinhados à direita.
- Ações por linha ficam alinhadas à direita e não ocupam mais espaço que o conteúdo.
- Rótulos e valores em cards de resumo mantêm uma grade consistente; não alinhar manualmente com espaços.

---

## 5. Components

A biblioteca inicial implementa as primitivas com reutilização imediata no MVP, usando padrões shadcn/ui e comportamento acessível provido por Radix quando necessário. Novos componentes devem ser adicionados conforme os fluxos do `SPEC.md`, sem antecipar abstrações de domínio.

### 5.1 Button

Alturas responsivas: no mobile/touch, `sm 40px`, `md 40px`, `lg 44px` e `icon 40 × 40px`; a partir de `sm` (desktop/tablet), `sm 32px`, `md 36px`, `lg 40px` e `icon 36 × 36px`. O tamanho padrão é `md`. `sm` reduz padding horizontal para `10px` e usa `caption`; `md` usa padding de `14px` e `body`; `lg` usa padding de `18px` e `body-lg`. Todos usam peso `500`. Ícones: `14px` em `sm`, `16px` em `md`/`icon` e `18px` em `lg`.

| Variante | Aparência | Uso |
| --- | --- | --- |
| Primary | Fundo `primary` (tinta), texto branco | Uma ação principal por região: salvar, cadastrar, fixar análise. |
| Secondary | Superfície branca, borda `border-strong`, `shadow-xs`; hover em `background` | Ação relevante que não é a principal. |
| Outline | Borda e texto `accent`, fundo transparente; hover em `accent-subtle` | Ação contextual com ênfase intermediária. |
| Ghost | Sem fundo ou borda; hover com véu de 5% de tinta | Toolbar, ações de linha e navegação discreta. |
| Destructive | Fundo `error`, texto branco | Exclusão definitiva ou ação irreversível. |
| Link | Texto `accent`, fundo transparente e alvo mínimo de 40 px | Ação ou navegação discreta. Dentro de frases, usar um link de texto nativo. |

Estados:

- Hover e active usam os tokens correspondentes.
- Focus usa anel externo de 2 px, offset de 2 px.
- Loading mantém cor e opacidade normais, mostra spinner e texto adequado, como “Salvando…”, e expõe `aria-busy`. Embora bloqueie repetição da ação, não usa a aparência de Disabled.
- Passe `loading={isSaving}` desde o primeiro render e, opcionalmente, `loadingLabel="Salvando…"`. O componente reserva a maior largura dos dois estados; somente o rótulo visível participa do nome acessível. Em `size="icon"`, mantém 40 × 40 px, mostra apenas spinner e preserva `aria-label`.
- Disabled não recebe eventos, usa cursor padrão e mantém o motivo compreensível por texto adjacente quando não for óbvio.
- `asChild` recebe exatamente um elemento, como `<a>` ou `Link`. O componente preserva esse elemento, sem criar botão aninhado. Loading e Disabled bloqueiam ativação por ponteiro/teclado e removem o link da sequência de Tab; âncoras nativas também perdem `href` enquanto bloqueadas.
- Botão só com ícone exige `aria-label` e alvo mínimo de 40 × 40 px.

Não usar Primary para duas ações concorrentes dentro do mesmo card ou dialog.

### 5.2 Input, CurrencyInput e Textarea

- Altura de input/select: `40px`; textarea mínima: `96px`.
- Padding horizontal: `12px`.
- Borda `control-border`, fundo `surface`, texto `foreground`, `radius-md`.
- Focus: borda `accent` e anel externo de 2 px com transparência visual equivalente a 20%.
- Error: borda `error`; mensagem abaixo com ícone opcional e texto `error`.
- Readonly: `surface-subtle`, texto normal, foco ainda visível.
- Disabled: `surface-subtle`, `muted-subtle`, sem interação.
- Placeholder usa `placeholder`; nunca funciona como label.

`CurrencyInput`:

- Exibe prefixo `R$` visualmente associado.
- Aceita entrada em formato brasileiro e armazena centavos por meio da camada de formulário.
- Alinha o valor à direita quando usado em grades financeiras; em formulários simples pode alinhar à esquerda.
- Não altera o valor enquanto o usuário digita de forma que mova o cursor inesperadamente.
- Exibe helper quando zero e vazio têm significados diferentes.

### 5.3 Select, Checkbox, Radio e Switch

- Select segue dimensões e estados do Input.
- No posicionamento `popper`, o menu tem a largura do gatilho, limitada ao espaço disponível da viewport. Opções têm pelo menos 40 px de altura, e listas longas permitem rolagem.
- Checkbox é usado para seleção independente e listas de critérios.
- Radio é usado quando exatamente uma opção deve ser escolhida, como modalidade de comissão.
- Switch é reservado para estado imediato e reversível, como “Acompanhar lote”. Não usar para confirmação de regras importantes.
- Checkbox e radio usam desenho de 20 × 20 px dentro do próprio botão de 40 × 40 px; não contar padding de um wrapper inerte como área clicável.
- Switch usa trilho de 44 × 24 px dentro do próprio botão de 44 × 40 px.
- Label inteiro deve ser clicável e ter altura mínima de 40 px. O anel de foco contorna a área interativa.
- Checkbox indeterminado usa traço; marcado usa check. Estado inválido usa borda `error` e mensagem associada.

### 5.4 Card

Variantes:

- **Default:** `surface`, borda `border` sem sombra, `radius-lg`, padding de 20 px abaixo de `md` e 24 px a partir de `md`. Título usa `heading-3` (15/22).
- **Metric:** valor principal, label, contexto e tendência/estado opcional; sem ícone decorativo obrigatório.
- **Summary:** destaca cálculo ou decisão; painel rebaixado em `background` (papel), sem borda.
- **Interactive:** o card inteiro pode ser clicável somente se tiver um único destino e foco visível.

Cards não devem conter cards idênticos aninhados. Para subdivisões internas, use `surface-subtle`, divisores ou grupos sem borda.

**Section (direção A).** Na maior parte das telas o conteúdo não vai em caixa: `Section` + `SectionHeader` + `SectionTitle` (`heading-3`, 15/22) e o conteúdo separado por linhas finas. `DataList` + `DataRow` formam linhas de rótulo e valor com divisor `border` (`emphasis` para totais, com `border-strong`). `Stat` põe rótulo `caption` sobre o valor, em colunas (fichas e números do painel), com o tamanho do valor de `body` a `heading-2`. Card fica para o que precisa de destaque: o painel rebaixado (Summary) com o número que decide, pendências e indicadores.

### 5.5 Badge / StatusBadge

- Pílula: altura mínima de `22px` (`min-h-5.5`), padding horizontal de `8px`, `radius-full`, texto `12px / 16px` peso `500`, com fundo suave e borda sutil semântica (`border-{estado}-border` / `border` no neutro).
- Variante neutra para status de domínio.
- Variantes success, warning, error e info apenas com o significado definido nos tokens.
- Texto curto e explícito: “Rascunho”, “Fixada”, “Acima do limite”.
- Não usar badge para frases ou explicações.

### 5.6 Alert

- Fundo e borda suaves do estado; ícone 20 px; título opcional e descrição objetiva.
- Alert inline permanece junto do conteúdo que afeta.
- Use error para falha que impede a tarefa, warning para condição revisável, info para contexto e success para confirmação persistente.
- Não usar Alert como container visual genérico.

### 5.7 Toast

- Confirma operações breves e informa falhas globais.
- Duração padrão: 5 segundos; erros importantes permanecem até 8 segundos ou permitem fechamento.
- Máximo de três toasts simultâneos.
- Não usar toast como único lugar de erro de formulário.
- Mensagem descreve o resultado: “Leilão salvo” ou “Não foi possível salvar o lote”.

### 5.8 Dialog e Drawer

- Dialog para confirmação, edição curta ou decisão bloqueante.
- Drawer lateral para filtros complexos no desktop; drawer inferior ou lateral no mobile conforme altura do conteúdo. `DrawerContent side="right" | "bottom"`, com `DrawerBody` rolável e `DrawerFooter` fixo.
- Formulários longos e análises financeiras devem ter página própria.
- Larguras de dialog: 480 px para confirmação; 640 px para formulário curto; máximo de 800 px para conteúdo especial.
- Título usa `heading-2` (24/30). Ações ficam no rodapé, secundária seguida de Primary no DOM e visualmente. A partir de `md`, Primary fica à direita; abaixo de `md`, ações empilhadas em largura total, Primary por último. Não inverter a ordem visual em relação ao foco.
- Fechar com Escape quando seguro. Mudanças não salvas pedem confirmação.

### 5.9 Dropdown menu e Tooltip

- Dropdown agrupa ações secundárias de uma linha ou cabeçalho.
- Ações destrutivas ficam separadas por divisor e em `error`.
- Tooltip explica ícone, termo curto ou dado truncado; não contém ação nem informação essencial exclusiva.
- Delay do tooltip: 400–600 ms; deve funcionar por foco e hover. Exceção: a dica de gráfico (`ChartTooltip`) acompanha o ponteiro e aparece sem atraso, porque é leitura do dado, não explicação de controle (D-70).

### 5.10 Tabs

- Use para alternar visões irmãs do mesmo recurso, como “Resumo”, “Análises” e “Resultado”.
- Estado ativo usa texto `foreground` (tinta), peso 600 e indicador inferior de 2 px em tinta.
- Não usar tabs como substituto de navegação principal ou etapa obrigatória de formulário.
- Em mobile, permitir rolagem horizontal com indicação visual, sem cortar o rótulo ativo.

### 5.11 Table / DataTable

- Cabeçalho sem fundo, texto `caption` peso 500 em `muted`, divisor `border` e altura mínima de 40 px. A primeira e a última coluna encostam nas bordas da seção (sem padding externo), alinhadas ao título.
- Linha padrão com altura mínima de 48 px; até 56 px quando há descrição secundária.
- Bordas horizontais; evitar grade completa entre todas as células.
- Hover suave apenas quando a linha é interativa.
- Seleção e ação devem ser elementos separados; clicar em um menu não navega pela linha.
- Cabeçalhos ordenáveis são botões com estado acessível.
- Valores monetários e contagens: alinhamento à direita e numerais tabulares.
- Colunas críticas não desaparecem sem alternativa no mobile.

No mobile, escolher por tabela:

1. Rolagem horizontal para comparação entre colunas essencialmente tabular; ou
2. Lista de cards/linhas empilhadas quando cada registro é entendido individualmente.

As listas de leilões e lotes devem preferir linhas empilhadas no mobile. Histórico de versões financeiras pode usar rolagem horizontal.

`Table` não impõe largura mínima global. A feature define `min-w-*` somente se a comparação exigir rolagem horizontal. A referência de lotes usa lista semântica com rótulos e valores abaixo de `md`, e tabela a partir de `md`, compartilhando os mesmos dados. Linhas com interação explícita podem usar `data-interactive="true"` para receber hover.

### 5.12 Pagination

- Mostrar “X–Y de Z” quando o total é conhecido.
- Controles anterior/próximo sempre visíveis; números de página a partir de `sm`.
- Tamanho padrão da página: 25 registros, conforme `SPEC.md`.
- Ao mudar de página, mover foco para o início da lista ou anunciar a atualização.

### 5.13 Skeleton

- Deve reproduzir a estrutura aproximada do conteúdo, sem animação agressiva.
- Shimmer ou pulso entre 1,2 e 1,8 segundo.
- Use apenas quando o carregamento não for imediato. Para ações curtas, use estado loading no controle acionado.
- Respeitar `prefers-reduced-motion`.

### 5.14 EmptyState

Variante `inline` (dentro de uma seção): faixa com borda `border`, título e descrição à esquerda e a ação à direita, sem ícone. Use quando a ausência é de um bloco da página (sem análise, sem resultado, sem fotos); a variante padrão fica para a página ou a lista inteira vazia.

Composição:

1. Ícone opcional de 40 px em fundo neutro.
2. Título objetivo.
3. Descrição de uma ou duas linhas.
4. Uma ação principal quando existe próximo passo.

Exemplo: “Nenhum lote acompanhado” + “Marque um lote para acompanhar sua situação no dashboard.” + “Ver lotes”. Não usar ilustrações grandes no MVP.

### 5.15 Search e FilterBar

- Busca com ícone, label acessível e placeholder específico, como “Buscar por lote, marca ou modelo”. Aplica 400 ms depois da última tecla ou com Enter; sugestões em combobox (setas, Enter, Escape) com a contagem.
- Filtros aplicam na hora (sem botão “Filtrar”) e persistem na URL; a tela mostra “Atualizando…” no lugar do total enquanto carrega.
- Linha de chips dos filtros ativos (`RemovableChip`, “×” com `aria-label` “Remover filtro …”) e “Limpar tudo” a partir de dois. Atalhos de um toque em chip tracejado com “+”.
- Total do resultado em `label` `tabular-nums`, num `role="status"`; ordem num Select com rótulo “Ordenar”.
- Desktop: busca, depois os filtros mais usados em `Popover` (o gatilho mostra o valor escolhido, com borda `accent` quando ativo) e “Mais filtros (n)” abrindo o drawer lateral.
- Mobile: busca visível e botão “Filtros (n)” abrindo o drawer inferior com todos os filtros; o rodapé tem “Limpar tudo” e “Ver N lotes”.
- Controles: `SegmentedControl` para escolha única curta (Abertos | Encerrados, escala de condição); `ToggleChip` (`aria-pressed`, check) para várias escolhas com contagem; faixa de preço em `Slider` com dois campos em reais; grade de anos em botões `aria-pressed` (toque no início e no fim da faixa).

### 5.16 FileUpload / PhotoGallery

- Área de upload com botão explícito; drag and drop é complemento.
- Informar formatos, quantidade e limite de tamanho antes do envio.
- Mostrar progresso por arquivo, erro específico, miniatura e ação de remover.
- Galeria usa proporção `4:3`; foto de capa claramente identificada.
- Não permitir que a remoção definitiva aconteça sem confirmação quando a foto já estiver salva.

---

## 6. Component States

| Estado | Regra visual | Regra de comportamento |
| --- | --- | --- |
| Default | Tokens base do componente. | Pronto para interação. |
| Hover | Mudança sutil de fundo, borda ou cor. | Apenas em dispositivos compatíveis com hover. |
| Focus-visible | Anel de 2 px com offset de 2 px. | Aparece por teclado e outras modalidades relevantes. |
| Active | Cor mais escura ou leve deslocamento visual de 1 px. | Dura apenas durante ativação. |
| Selected | Fundo suave + texto/indicador primário. | Persiste enquanto selecionado. |
| Disabled | Menor contraste, sem hover. | Não recebe ação; não usar como explicação de regra. |
| Loading | Spinner/skeleton e texto adequado, preservando contraste e dimensões. | Bloqueia repetição da própria ação e expõe `aria-busy`; não usa os tokens de Disabled. |
| Error | Borda/fundo/error + mensagem textual. | Foco vai ao primeiro erro após submissão. |
| Success | Confirmação textual discreta. | Não permanece como decoração quando deixa de ser útil. |
| Empty | EmptyState ou travessão conforme contexto. | Oferece próximo passo quando possível. |

Transições nunca podem ocultar mudança de estado, atrasar uma ação ou mover conteúdo inesperadamente.

---

## 7. Forms

### Estrutura

- Título e descrição do formulário aparecem antes dos campos.
- Formulários longos são divididos por seções com `heading-3`, descrição opcional e gap de 24–32 px.
- Label fica acima do campo.
- Campos obrigatórios exibem `*` e uma nota inicial “Campos marcados com * são obrigatórios”.
- Helper aparece abaixo do campo e antes da mensagem de erro; quando há erro, a mensagem substitui o helper se ambos competirem.
- Ações ficam ao final, separadas por divisor ou espaço de 32 px.

### Validação

- Validar formato ao sair do campo quando isso ajudar; não mostrar erro destrutivo a cada caractere digitado.
- Após submissão inválida, mostrar resumo curto quando houver erros em várias seções e focar o primeiro campo inválido.
- Mensagens explicam a correção: “Informe um valor maior que zero”, não “Valor inválido”.
- Erro de servidor preserva o conteúdo digitado.
- Valores calculados pelo servidor são exibidos novamente após o salvamento.

### Formulários financeiros

- Agrupar “Referências de preço”, “Custos”, “Comissão”, “Reserva e margem” e “Resultado da análise”.
- A unidade aparece no próprio controle (`R$`, `%`, `km`) e não apenas no placeholder.
- Totais calculados são somente leitura e visualmente distintos de entradas.
- O resumo da análise fica visível ao lado no desktop e após os campos no mobile.
- “Salvar rascunho” é Secondary; “Fixar análise” é Primary e exige revisão quando torna a versão imutável.

---

## 8. Feedback

### Confirmação

- Operação simples: toast.
- Mudança persistente relevante, como análise fixada: alert inline no estado final e toast breve.
- Nunca comunicar sucesso antes da confirmação do servidor.

### Erro

- Campo: mensagem inline.
- Formulário/servidor: alert no início da área afetada e campos preservados.
- Página indisponível: estado de erro com tentativa novamente e caminho de retorno.
- Detalhe técnico fica em log; a interface informa o que ocorreu e o que o usuário pode fazer.

### Warning

Usar para informação faltante, análise retrospectiva, resultado não comparável ou condição próxima do limite. Não usar warning para conteúdo rotineiro.

### Loading

- Navegação inicial: skeleton estrutural.
- Mutação: loading no botão acionado.
- Tabela atualizada por filtro: manter cabeçalho e controles, usar skeleton ou indicador na área de resultados.
- Evitar spinner central de página inteira quando parte da UI já pode permanecer disponível.

---

## 9. Navigation

### Sidebar desktop

Ordem inicial:

1. Marca: quadrado de 24 px em tinta com o martelo e “Leilão Tracker” (`src/components/layout/brand.tsx`).
2. Início (ícone de casa, rota `/dashboard`).
3. Leilões (o catálogo coletado, por leilão ou todos os veículos; docs/PLANO-COLETA.md e docs/PLANO-NAVEGACAO.md): porta de entrada do fluxo descobrir → analisar.
4. Minhas análises (os lotes do usuário, todos ou por leilão).
5. Monitores (buscas salvas que geram alertas).
6. Alertas (lotes novos que combinaram com um monitor), com contador de não lidos.
7. Mercado (preços de arremate do catálogo, em três abas: Avaliar, Panorama e Calibração; docs/PLANO-MERCADO.md).
7. Grupo **Acompanhando**: até 5 lotes acompanhados sem resultado, com um ponto pela situação do lance (`success` abaixo, `warning` no limite, `error` acima, `muted-subtle` sem comparação; o texto da situação vai para leitores de tela) e o número do lote em mono. Some quando não há nenhum.
8. Espaço flexível.
9. Cartão **Próximo leilão** (véu de 3% de tinta, `radius-lg`): data e hora, nome e quantidade de lotes; leva ao leilão. Some sem leilão próximo.

- A conta (avatar com dropdown de Preferências, Guia e atalhos e Sair) fica ancorada no rodapé da sidebar no desktop e no canto direito do header fixo (`48px`) abaixo de `lg`, ao lado da central de notificações (falhas de coleta + novos alertas).
- A sidebar fica sobre o papel (`background`), separada por borda hairline `border`.
- Item: altura mínima de 36 px, `radius-md`, 1 px entre itens, ícone 16 px em `muted-subtle`, texto `body` peso 500 em `foreground-secondary`.
- Ativo: fundo `primary-subtle` (sem borda nem sombra), texto e ícone em tinta, peso 600; mantém a mesma cor no hover.
- Hover: fundo `primary-subtle` a 60%, texto e ícone em tinta.
- Não usar badges de contagem na navegação salvo necessidade operacional validada. Única exceção validada: **não lidos em Alertas** (etapa 2 de docs/PLANO-COLETA.md), pílula `accent` com texto branco alinhada à direita, some quando é zero.

### Navegação mobile

- Topbar de 56 px com marca/contexto e botão de menu.
- Menu abre drawer lateral com os mesmos destinos, extras e ordem da sidebar; qualquer link clicado fecha o drawer.
- Não criar navegação inferior enquanto existirem poucos destinos e ações contextuais importantes.

### Breadcrumbs

- Usar em detalhes com hierarquia: `Minhas análises / Leilão Detran / Lote 152` ou `Leilões / Leilão de Seguradoras`.
- O item atual não é link e usa `foreground`.
- Em mobile, pode reduzir para um link de retorno com o pai imediato, mantendo o título da página visível.

### Links

- Link inline usa `accent`, sublinhado no hover e foco visível.
- Link externo tem ícone de 16 px e indicação acessível de nova aba quando aplicável.
- Não usar texto azul para conteúdo que não é interativo.

---

## 10. Responsive Design

### Mobile: 0–639 px

- Página com 16 px de padding.
- Uma coluna; cards e campos ocupam largura completa.
- Título `heading-1` em 24/32.
- Ação principal pode ocupar 100% da largura.
- Toolbars quebram em busca + botão de filtros.
- Listagens de leilões e lotes viram linhas/cards empilhados.
- Resumo financeiro vem depois dos campos; pode usar barra fixa inferior apenas para uma ação principal, sem cobrir conteúdo.
- Dialogs complexos viram drawer/tela cheia com safe areas.

### Small/tablet: 640–1023 px

- Página com 24 px de padding.
- Formulários usam duas colunas para campos curtos.
- Métricas usam duas colunas.
- Navegação continua em drawer até `lg`.
- Tabelas podem usar rolagem horizontal quando a comparação exigir colunas.

### Desktop: 1024–1279 px

- Sidebar persistente.
- Página com 24 px de padding.
- Detalhe pode dividir conteúdo principal e painel lateral em proporção 2:1.
- Ações ficam no cabeçalho da página.

### Desktop amplo: 1280 px ou mais

- Página com 32 px de padding, limitada a 1440 px.
- Métricas podem ocupar quatro colunas.
- Análise financeira usa composição 7/5 quando melhorar a revisão dos cálculos.
- Não aumentar indefinidamente largura de texto, inputs ou tabelas; usar margem externa.

### Elementos que podem mudar de posição

- Ações secundárias vão para menu no mobile.
- Resumo lateral vai abaixo do formulário.
- Filtros avançados migram para drawer.
- Breadcrumb completo reduz para retorno ao pai.

Informação essencial não deve simplesmente desaparecer. Se uma coluna for removida, seu conteúdo deve estar disponível na linha expandida ou página de detalhe.

---

## 11. Accessibility

- Meta: WCAG 2.2 nível AA para fluxos do MVP.
- Texto normal deve atingir contraste mínimo de 4,5:1; texto grande, 3:1; componentes e indicadores, 3:1 contra cores adjacentes.
- Todo elemento interativo recebe foco visível. Não remover `outline` sem substituição equivalente.
- Ordem de foco segue a ordem visual e do DOM.
- Alvo clicável mínimo: 40 × 40 px; preferir 44 × 44 px em ações isoladas no mobile.
- Todo input possui label programaticamente associado.
- Erros usam `aria-invalid`, ligação com a mensagem e texto de correção.
- Dialogs controlam foco, têm título acessível e devolvem foco ao gatilho ao fechar.
- Atualizações assíncronas relevantes usam região viva com moderação.
- Tabelas usam cabeçalhos semânticos e `scope` adequado.
- Ícones decorativos usam `aria-hidden="true"`; ícones que são o único conteúdo de um botão exigem nome acessível.
- Estados financeiros sempre incluem texto ou símbolo além da cor.
- Respeitar `prefers-reduced-motion` e não exigir hover para revelar ação necessária.
- Fotos recebem texto alternativo objetivo quando agregam informação; miniaturas puramente repetidas podem ter alt vazio quando já existe legenda acessível.
- Formatação monetária deve ser lida de forma compreensível por tecnologia assistiva; considerar label acessível completo para valores abreviados visualmente.

---

## 12. Icons

Decisão inicial: usar **Lucide React**, compatível com o estilo de shadcn/ui.

- Não misturar bibliotecas no MVP.
- Tamanhos: 16 px em texto/controles compactos; 20 px em navegação e botões; 24 px em alertas; 40 px em empty states.
- Stroke padrão: 2; manter o padrão da biblioteca.
- Ícone aparece antes do texto em botões, com gap de 8 px.
- Usar ícones para reforçar significado ou facilitar reconhecimento, não para decorar todos os cards.
- Não usar emoji como ícone de interface.
- Ícone de carro pode aparecer em estado vazio ou identificação de domínio, sem se tornar uma marca visual repetitiva.

---

## 13. Images

As imagens do MVP são fotos dos lotes.

- Miniatura padrão: proporção `4:3`, `object-fit: cover`, `radius-md`.
- Imagem principal: `4:3`, largura responsiva e fundo `surface-subtle` para áreas vazias.
- Galeria: uma imagem principal e grade de miniaturas; no mobile, carrossel acessível ou rolagem horizontal com contador.
- Não distorcer fotos para preencher container.
- Placeholder usa ícone neutro e texto “Sem fotos”, sem imagem genérica de carro que possa ser confundida com o lote.
- Exibir quantidade e posição, como “2 de 8”.
- Ações de capa, reordenação e remoção ficam acessíveis por teclado.
- Avatares não são necessários no MVP de usuário único; não criar componente sem uso real.

---

## 14. Animation & Motion

| Token | Duração | Uso |
| --- | ---: | --- |
| `motion-fast` | `120ms` | Hover, cor, borda e pressionamento. |
| `motion-base` | `180ms` | Menus, tooltip, accordion e feedback. |
| `motion-slow` | `240ms` | Dialog e drawer. |

Easing padrão: `cubic-bezier(0.2, 0, 0, 1)`. Saída pode usar `cubic-bezier(0.4, 0, 1, 1)` quando precisar ser mais rápida.

- Animar `opacity` e `transform`; evitar transicionar dimensões grandes quando causa reflow.
- Não usar transição de página no MVP.
- Hover não desloca cards nem aplica zoom.
- Spinner usa rotação linear; skeleton usa pulso suave.
- Em `prefers-reduced-motion: reduce`, remover deslocamentos e reduzir animações à mudança imediata ou fade curto.

---

## 15. UI Patterns

### 15.1 Dashboard (`/dashboard`)

1. `PageHeader` com título **“Visão geral”**, linha compacta da coleta à direita (`X veículos abertos até 150 km de … · Coleta dd mmm, hh:mm`), e ações **“Ver leilões”** (`primary`) e **“Novo leilão”** (`secondary`).
2. Faixa de KPIs operacionais (`DashboardKpis`) em grade hairline (`2` colunas no mobile, `4` em `@3xl+`): **Para analisar**, **Acompanhados** (destaque suave em `error-subtle` a 40% quando houver provável acima do limite), **Pendências** (destaque suave em `warning-subtle` a 40% quando houver pendências) e **Próximo no catálogo**, cada célula ligada à seção ou leilão correspondente.
3. Faixa compacta de alertas não lidos e saúde da coleta (`RecentAlerts`), quando houver alertas ou falha/atraso na coleta (neste caso explicando o impacto e oferecendo link para `/leiloes`).
4. Duas colunas no desktop amplo (`1,7 : 1`):
   - à esquerda, nesta ordem (`SPEC §5`):
     - **“Para analisar agora”**: até `4` `ListingCard` compactos em grade de `2` colunas em `@3xl+` (1 coluna abaixo), mostrando lance, preço provável, limite estimado, evidência (`n`, confiança e origem do limite), ações (`Analisar agora`, `Inspecionar`, `Dispensar`), aviso quando truncado e rodapé **“Ver mais N no catálogo”** quando houver mais candidatos;
     - **“Lotes acompanhados”**: linhas com toda a área clicável (`≥ 44px`), número do lote em mono, veículo, leilão, urgência de encerramento (≤24h em `warning`) e frescor do lance observado, rótulos visíveis **Lance** / **Limite**, barra `LimitProgress` com a diferença em texto e o provável frente ao limite;
     - **“Próximos leilões na região”**: agenda agrupada por dia (dia grande, mês e dia da semana à esquerda; marcador sólido quando há lote que cabe no limite, hora, nome, fonte, lotes no filtro e quantos cabem à direita) com linha inteira clicável (`≥ 44px`).
   - à direita (`<aside>`):
     - **“Registros pendentes”** no painel rebaixado `summary` (até `3` aguardando resultado + `3` rascunhos, com botão **“Revisar e fixar”** abrindo diálogo com checklist explícito de lotes, limites calculados e alerta de premissas padrão antes de fixar em lote);
     - **“Suas decisões antes do resultado”** (`DecisionIndicator`, sempre com o denominador `X de Y resultados comparáveis ficaram dentro do limite` e link para `/mercado/calibracao`).
5. `EmptyState` `inline` em cada seção quando necessário (sem repetição do CTA primário do cabeçalho e com link para `/monitores` e `/leiloes/veiculos`).
6. No celular, uma coluna na mesma ordem do DOM, mantendo **“Para analisar agora”** no topo da área de trabalho logo após os KPIs e alertas.

Situação e limite são estimativas: sempre com o método e o `n`. Não destacar “economia potencial”, “lucro” ou score, pois não são resultados garantidos.

### 15.2 Listagem

1. PageHeader e ação de cadastro.
2. Search + FilterBar.
3. Contagem/estado dos resultados.
4. DataTable no desktop ou lista adaptada no mobile.
5. Pagination.

Filtros ativos permanecem visíveis ou resumidos. O estado vazio por filtro oferece “Limpar filtros”; o estado sem dados oferece cadastro.

### 15.3 Detalhe de leilão ou lote

1. Breadcrumb.
2. PageHeader com status e ações.
3. Resumo de identidade e metadados.
4. Conteúdo dividido em seções/cards.
5. Histórico ou itens relacionados por último.

No lote, o painel “Mercado deste lote” e, na análise, o bloco “Concorrência” levam ao Avaliar com o lote como alvo (§15.8).

No lote (direção A): logo abaixo do cabeçalho, o painel rebaixado "Lance e limite" com o número que decide (folga até o limite em `display`, `success`; ou "acima do seu limite em" em `error`), lance atual e meu limite em `heading-2`, a barra do lance até o limite e o formulário do novo lance. Depois, duas colunas (1,75 : 1): análise (tabela de versões) e resultado à esquerda; veículo (`dl` em duas colunas), fotos, "Acompanhar lote" e observações à direita, separados por linhas finas.

No leilão do usuário: dados do evento numa faixa rebaixada (data, local, edital, plataforma) e a lista de lotes em largura total; se o leilão veio do catálogo, a faixa traz o link para todos os lotes dele.

### 15.3.1 Leilões do catálogo

- Abas de texto no topo: "Por leilão" e "Todos os veículos" (links, com `aria-current`), seguidas dos filtros dos anúncios.
- Cartão de leilão: fonte e data em `caption`, nome em `heading-3`, e uma linha de números em `tabular-nums` ("214 lotes · 147 abertos · 37 no filtro · 3 analisados"). O cartão inteiro leva ao leilão.
- Leilão do catálogo: faixa rebaixada com fonte, data e números, e a grade de cartões de anúncio em largura total.
- Minhas análises: abas "Todos os lotes" e "Por leilão"; no agrupado, cada grupo tem cabeçalho (nome, data, lotes do usuário e "214 no catálogo" quando houver) e as linhas da lista de lotes.

### 15.4 Análise financeira

- Desktop amplo: premissas (formulário ou linhas em leitura) à esquerda e AnalysisSummary à direita, numa coluna de 460 px.
- O resumo é o painel rebaixado: lance máximo em `display`; a composição do valor de venda numa barra (lance máximo em tinta, custos, comissão, reserva e margem em tons até `success`), repetida em texto como conta (valor de venda − partes = lance máximo); e a simulação de lance com custo total, margem estimada e a situação numa faixa branca ("R$ X de folga").
- “Lance máximo” é a maior saída visual, mas permanece acompanhado de rótulo e premissas.
- Ações ficam ao final do formulário; o resumo não contém ação duplicada.
- Análise fixada usa modo leitura, badge “Fixada”, data/hora e ação “Criar nova versão”.

### 15.5 Resultado

- Formulário diferencia “Desfecho do lote” de “Minha participação”.
- Comparação só aparece quando há preço final e análise vinculada.
- Resultado retrospectivo recebe warning claro.
- Diferença para o limite usa sinal e frase completa.

### 15.6 Autenticação

- Página simples, centralizada, com painel de 400 px no desktop e padding de 16 px no mobile.
- Marca, título, descrição curta, campos e ação principal.
- Sem imagem hero, depoimentos ou mensagens comerciais no MVP privado.

### 15.7 Página de erro

- Título humano, explicação curta, ação de tentar novamente e retorno seguro.
- Não exibir stack trace, código interno ou detalhes de infraestrutura.

### 15.8 Mercado

1. PageHeader com título “Mercado” e a linha “N vendas arrematadas no catálogo desde dd/mm/aaaa”; abaixo, as abas de link (`LinkTabs`, como as de Leilões) **Avaliar**, **Panorama** e **Calibração**, com `aria-current` na ativa (D-71).
2. **Avaliar** (`/mercado`):
   - Seletor do veículo no topo, separado por borda inferior: a busca de modelo (a do Panorama, focada pela tecla `/`) e, com modelo, `Select` com a contagem de vendas em cada opção (família, versão FIPE, ano-modelo de e até, km máximo, condição, origem; opção sem venda desabilitada, menos a escolhida), o total em `label` com `role="status"` e “Limpar”. Com o lote como alvo, uma linha nomeia o lote e um botão de ícone deixa de comparar com ele.
   - Sem veículo: a pergunta da tela e listas de atalhos (“Seus lotes”, “Buscados por último”, “Mais vendidos no último ano”).
   - **Resposta**: `Card` `metric` com o recorte em `label` `muted`, “Faixa típica de arremate” em `label` e a faixa em `heading-1` `tabular-nums`; os fatos numa `dl` em linha (mediana, da FIPE, base, período, confiança, rótulo em `caption` `muted`); a origem das vendas em `caption`; o aviso de anos misturados em `caption` `warning`; “Como calculamos” num `details` em `caption`; as ações (“Acompanhar este veículo”, `SaveWatchButton`, e “Ver no catálogo”, `ButtonLink` `ghost`) no fim. Insuficiente: título em `heading-3`, a frase em `muted` e os botões `secondary` `sm` que afrouxam um filtro com a contagem.
   - **Vendas e lotes abertos**: `SegmentedControl` do eixo (ano-modelo ou data) e a dispersão: venda em ponto cheio `data-3`, tirada da conta mais clara, lote aberto em ponto vazado com anel em tinta e traço até a mediana, faixa típica sombreada em `data-1`; legenda em `caption`. No celular, o bloco vai para o fim (`order-last`).
   - **Lotes abertos do recorte** e **Vendas do recorte**: listas em linhas separadas por `gap-px` sobre `border`; título, fatos em `caption` `tabular-nums` (data, ano, km, origem, cidade, fonte) e o valor em peso 600. Nos abertos, a posição frente à faixa é um `Badge` com texto (abaixo, dentro, acima) e a ação vem da rota (“Analisar” ou a análise). Nas vendas, miniatura 4:3, % da FIPE em `caption`, motivo da semelhança e “Tirar da conta” (`ButtonLink` `ghost` `sm`); tirada da conta fica com fundo `surface-subtle`, texto a 60%, lance riscado, `Badge` `outline` “Fora da conta” e o botão `secondary` “Voltar para a conta”. Doze vendas visíveis (o resto em “Ver as outras N vendas”) e oito lotes abertos, os que encerram primeiro e os únicos marcados no gráfico (o resto em “Ver os outros N lotes abertos”).
3. **Panorama** (`/mercado/panorama`):
   - Barra de filtros fixa a partir de `lg`, numa linha: busca de modelo (combobox que só aplica um modelo da lista, com as vendas de cada um; vazia, sugere os últimos modelos pesquisados, guardados no `localStorage`, e os mais vendidos; tecla `/`), categoria em `Select` com contagem, “Mais filtros” (`Dialog` com condição, estado, fonte, km, ano-modelo e, quando a base cobre, período; o botão diz quantos filtros ativos há), o botão `secondary` “Comparar” (abre a linha “Comparar com”, com a busca do outro modelo e o `Select` do outro estado; com comparação na URL, vira “Tirar comparação”) e o total “N vendas com esses filtros”. Embaixo, os filtros da gaveta fora do padrão em chips removíveis. Os blocos têm `scroll-margin` para não ficar sob a barra.
   - Resumo: até quatro cartões (borda `border`, valor em `heading-2`, nota em `caption`): mediana do % da FIPE com a metade do meio, vendas com % (as de fora por motivo, só quando há), lance final mediano com modelo escolhido e quanto o lance sobe nas últimas 24 h.
   - Blocos nesta ordem: comparação; modelos ou vendas do modelo; “De quem se compra” e “Quanto se paga por condição” lado a lado a partir de `xl`; tendência; “Onde”; “Como lemos os dados”. Cada um tem título em `heading-3`, no máximo uma linha curta de apoio em `muted` e “Ver dados em tabela” ao fim.
   - “Modelos”: busca pelo nome, `Select` de idade na venda e de ordem (mais vendas, menor ou maior mediana, nome), o chip “Amostra pequena” com a contagem e linhas com a posição, o nome, a faixa P25–P75 em `data-3` e a mediana em ponto de tinta sob um eixo, com a mediana geral tracejada; a partir de `xl`, colunas de ano e lance medianos; a legenda da linha diz “N vendas · X por semana” (abaixo de `xl`, mais o ano e o lance). Cada linha é um link para o Avaliar; os 15 primeiros e “Mostrar todos os N modelos”.
   - “Vendas do <modelo>”: dispersão das vendas (lance em R$ ou % da FIPE, com a linha tracejada “100% da FIPE”; ano-modelo ou quilometragem; medianas dos anos ligadas por uma linha em tinta a 50%; “Destacar” um estado ou uma fonte) e a tabela das vendas, com miniatura, link para o anúncio, colunas ordenáveis, `Select` de estado e “Ver todas as N vendas”; o % fora de 1% a 200% leva o `Badge` `outline` “fora do %”; o ícone “Ver lances” (link de 40 px) abre, entre o gráfico e a tabela, o painel dos lances em degraus (`StepLine`: linha de 2 px em `data-4`, último ponto em `data-5` com o valor escrito, `SegmentedControl` R$ / % da FIPE). O título do bloco traz “Ver lotes abertos deste modelo” (`ButtonLink` `secondary` `sm`) e “Acompanhar este modelo” (`SaveWatchButton`). O ponto da dispersão tem alvo de 24 px (exceção ao mínimo de 40 px: a tabela traz as mesmas vendas).
   - “De quem se compra” e “Quanto se paga por condição”: o `DistributionChart` (histograma de 2 em 2 pontos percentuais em `data-3`, faixa P25–P75 em `data-1`, mediana em tinta com o valor escrito; a linha do filtro em peso 600 e fundo `background`; nas condições, o rótulo das outras é link que aplica a condição); a dica própria (`ChartTooltip`) ao passar o mouse diz a faixa, as vendas e quantas saíram abaixo; clicar fixa a faixa e compara os grupos nela (Esc ou “Soltar” solta); com o bloco abaixo de 36 rem, o rótulo fica acima da faixa.
   - “Tendência”: `LineBand` da mediana semanal com a faixa do meio e o `n`; sem base, o bloco não ocupa lugar.
   - “Onde”: duas listas de `RangeBars` na mesma escala, “Distância de São Carlos/SP” e “Estado e fonte” (cada par é um link que aplica o estado e a fonte); embaixo, `details` “Ver no mapa” (“Ver por estado” no celular), aberto com estado escolhido. O mapa do Brasil (D-46) tem até 32 rem de largura, preenchimento no passo da escala, `surface-subtle` com 1 a 4 vendas e só contorno sem venda, sigla em `caption` e valor em `label` peso 600 sobre o desenho (estados pequenos com rótulo fora, ligado por linha guia), dica ao passar o mouse ou focar e o estado escolhido em `accent`; abaixo de `md`, a lista dos estados em barras de faixa. O detalhe do estado fica ao lado do mapa a partir de `lg` e abaixo no celular.
   - “Como lemos os dados”: `details` fechado (“Mostrar”) com “Como o lance sobe” (`LineBand` do lance visto em % do lance final por marca de horas, eixo sem zero, dica por coluna), “De onde vem a FIPE” e “Regras de amostra”.
   - Ao trocar um filtro, os blocos ficam a 50% de opacidade com `aria-busy` até a resposta chegar; o total da barra diz “Atualizando…”. Faixas, medianas e pontos deslizam até o lugar novo em `motion-base` (sem movimento com `prefers-reduced-motion`).
   - EmptyState `inline` por bloco: “Nenhuma venda com esses filtros desde dd/mm/aaaa”, com até três botões que afrouxam um filtro e dizem quantas vendas trariam (“Ver o Brasil todo (40 vendas)”, “Ver todo o período”, “Ver todos os modelos”).
4. **Calibração** (`/mercado/calibracao`): aviso em faixa `surface-subtle` com menos de 10 resultados; duas frases em cartões `metric` lado a lado a partir de `md` (título em `heading-3`, explicação em `muted`); “Limite × arremate” em `ScatterPlot` com os dois eixos na mesma escala e a diagonal tracejada “limite = arremate”; “Por categoria” (só com mais de uma) e “Por análise” em `Table` (lote em link `accent`, data da fixação como link para a análise, faixa da época com “recalculada” em `caption` quando não veio do snapshot, “sem lance viável” em `muted`, posição em texto); no fim, “Qualidade do preço provável” com a frase e a `Table` por confiança. Sem resultados, `EmptyState` que diz como ter um.

No lote, o painel **Mercado deste lote** (seção com “Ver as N vendas”, `ButtonLink` `secondary` `sm`, para o Avaliar): o recorte em `caption`, a faixa em `heading-2`, a linha da mediana, das vendas e da confiança, quanto o lance ainda sobe com o lote aberto e as 5 vendas mais parecidas em linhas. Na análise, o bloco **Concorrência** no resumo, abaixo da simulação (borda superior `border-strong`, título em `label`, “Ver as vendas” em link): a faixa e onde o lance máximo e o lance simulado ficam entre as vendas, em texto, sem cor de bom ou ruim.

**Amostra pequena** (5 a 14 vendas, `SMALL_SAMPLE`): o número aparece, marcado sem cor nova: asterisco no valor do mapa (a legenda diz “amostra pequena (5 a 14 vendas)”), faixa a 50% de opacidade no ranking e “· amostra pequena” na linha de apoio (ranking, distribuições, dica e leitor de tela).

Os gráficos são descritivos: sempre com `n` e o início da base, sem “oportunidade”, score ou cor de estado (`success`/`error`). Cada gráfico tem `role="img"` com resumo em texto.

---

## 16. Do's & Don'ts

### Do

- Usar tinta (`primary`) na ação principal e o azul `accent` só em link, foco e seleção.
- Reutilizar tokens e componentes antes de criar variações.
- Manter números financeiros com rótulo, unidade e numerais tabulares.
- Usar texto explícito junto de cores semânticas.
- Preservar uma ação principal clara por região.
- Manter formulários em grupos coerentes.
- Adaptar tabelas de acordo com a tarefa em telas pequenas.
- Registrar neste documento toda mudança sistêmica.

### Don't

- Criar novas cores, fontes, sombras, raios ou espaçamentos localmente.
- Usar gradientes, glassmorphism, glow, textura de carbono ou estética de velocímetro.
- Tratar o produto como plataforma de apostas ou trading.
- Usar verde para sugerir garantia financeira.
- Transformar toda informação em badge ou card.
- Usar emoji como componente visual.
- Criar botões primários concorrentes.
- Esconder informação essencial no hover.
- Mostrar dado ausente como zero.
- Usar vermelho para arquivar ou cancelar uma edição reversível.
- Reduzir texto ou alvos interativos para caber mais dados.

---

## 17. Rules for AI / Coding Agents

1. Leia `SPEC.md` e `DESIGN.md` antes de criar ou alterar qualquer interface.
2. Trate este arquivo como contrato; não como referência opcional.
3. Verifique componentes existentes antes de criar um novo.
4. Estenda uma variante quando a diferença for sistêmica; use composição quando for específica da página.
5. Não duplique componente sob outro nome.
6. Não use valores arbitrários quando existir token equivalente.
7. Não crie cor nova dentro de JSX, CSS module ou classe Tailwind.
8. Não introduza fonte além de Inter e JetBrains Mono.
9. Siga a escala tipográfica e a escala de espaçamento.
10. Preserve estados default, hover, focus-visible, active, disabled, loading e error.
11. Implemente acesso por teclado e nome acessível junto do componente.
12. Não comunique limite financeiro somente por cor ou ícone.
13. Não altere o significado de cores semânticas para atender um caso isolado.
14. Prefira shadcn/ui/Radix e composição dos componentes locais previstos.
15. Não copie diretamente o visual padrão do shadcn sem aplicar os tokens deste documento.
16. Use Lucide React; não misture packs de ícones.
17. Não adicione gradiente, glassmorphism, animação decorativa ou imagem genérica de carro.
18. Mantenha uma ação Primary por região visual.
19. Use Server Components ou Client Components conforme a arquitetura; isso não muda o contrato visual.
20. Teste a composição pelo menos em 375, 768, 1024 e 1440 px.
21. Antes de concluir uma tela, verifique estados vazio, loading, erro e conteúdo longo.
22. Não silencie truncamentos; forneça acesso ao conteúdo completo.
23. Se uma necessidade exigir novo token ou padrão, atualize este documento na mesma mudança.
24. Não altere o design system silenciosamente para resolver uma exceção local.
25. Quando houver dúvida, escolha a solução mais simples que reutilize os padrões existentes.

Checklist para uma nova página:

- [ ] Usa PageHeader e layout padrão.
- [ ] Tem hierarquia de títulos correta.
- [ ] Consome apenas tokens definidos.
- [ ] Reutiliza componentes existentes.
- [ ] Tem ação principal inequívoca.
- [ ] Trata loading, vazio, erro e sucesso.
- [ ] Funciona por teclado e apresenta foco visível.
- [ ] Não depende apenas de cor.
- [ ] Foi verificada nos quatro tamanhos de referência.

---

## 18. Implementation Reference

### Stack visual planejada

- Next.js App Router + TypeScript.
- Tailwind CSS.
- shadcn/ui com primitivas Radix.
- Next.js Google Fonts (`Inter` e `JetBrains_Mono`) em `src/app/layout.tsx`.
- Lucide React para ícones.

A estrutura atual relevante ao design system é:

```text
src/
  app/
    globals.css                 # tokens CSS, Tailwind e estilos base
    layout.tsx                  # fontes, metadados e Providers globais
    providers.tsx               # TooltipProvider e Toaster
    page.tsx                    # referência visual temporária da fundação
    component-showcase.tsx      # exemplos interativos da biblioteca
  components/
    ui/                         # primitivas tematizadas e barrel de exportação
    layout/
      page-header.tsx           # cabeçalho reutilizável de página
  lib/
    utils.ts                    # composição segura de classes
components.json                 # configuração shadcn
package.json                    # dependências e scripts da aplicação
DESIGN.md                       # contrato visual
SPEC.md                         # contrato funcional
```

Versões da fundação: Next.js `16.3.6` (atualizado de 16.3.5 em 2026-09-28), React `19.3.0`, Tailwind CSS `4.3.3`, TypeScript `6.0.3` e ESLint `9.39.5`. TypeScript 6 e ESLint 9 são mantidos enquanto os analisadores do ecossistema usado pelo Next.js 16 não suportarem as APIs das versões major seguintes.

### Estratégia de tokens

Definir tokens semânticos como variáveis CSS em `globals.css` e mapeá-los ao Tailwind. Componentes consomem nomes semânticos, não hexadecimais.

Regras globais de elementos ficam em `@layer base`, abaixo das utilities. O Preflight já herda tipografia para controles; não adicionar `font: inherit` fora de uma camada, nem regras universais de borda fora de `base`, pois elas sobrescrevem peso, erro e seleção. A variante `actionable:` limita hover/active a elementos habilitados.

Referência inicial:

```css
:root {
  --background: #fafafb;
  --surface: #ffffff;
  --surface-subtle: #f3f4f6;
  --surface-elevated: #ffffff;
  --foreground: #111318;
  --foreground-secondary: #3e434d;
  --muted: #626773;
  --muted-subtle: #8b909b;
  --border: #eaecef;
  --border-strong: #dadde3;
  --control-border: #878c98;
  --placeholder: #626773;
  --primary: #111318;
  --primary-hover: #252932;
  --primary-active: #000000;
  --primary-subtle: #eef0f3;
  --accent: #1d4ed8;
  --accent-hover: #1e40af;
  --accent-subtle: #eff4ff;
  --success: #047857;
  --warning: #92400e;
  --error: #be123c;
}
```

Esse trecho é um resumo; a configuração completa está em `src/app/globals.css`. Ao alterar tokens, verificar contraste no navegador e manter nomes consistentes entre CSS, Tailwind, `cn()` e componentes.

### Fonte

Carregar Inter (`--font-inter`) e JetBrains Mono (`--font-jetbrains-mono`) via Next.js Google Fonts no layout raiz (`src/app/layout.tsx`) e aplicar Inter com `cv02`, `cv03`, `cv04`, `cv11` no `body`. Ativar numerais tabulares (`tabular-nums`) em valores financeiros, datas e tabelas.

### Componentes shadcn

- Manter os componentes base em `src/components/ui`.
- Aplicar tokens semânticos e variantes centralmente.
- Componentes de domínio, como `AnalysisSummary` e `LimitStatus`, ficam dentro da feature correspondente.
- Não editar uma primitiva para atender apenas uma tela; compor na feature.

### Tema escuro

Não implementar classe `.dark` com valores improvisados. Quando o tema escuro entrar no escopo, definir todos os tokens, estados, sombras, imagens e contraste em uma revisão própria deste documento.

---

## 19. Examples

Os exemplos mostram composição e nomenclatura. Não são componentes já implementados nem código pronto para copiar sem adaptação.

### 19.1 Página padrão de listagem

```tsx
<Page>
  <PageHeader
    title="Leilões"
    description="Eventos cadastrados para acompanhamento."
    action={<Button>Novo leilão</Button>}
  />

  <FilterBar>
    <SearchField label="Buscar leilões" />
    <AuctionStatusFilter />
    <AuctionOriginFilter />
  </FilterBar>

  <AuctionList />
  <Pagination />
</Page>
```

### 19.2 Card de métrica

```text
Lotes acompanhados          ← label, 14/20 medium, secondary
17                          ← valor, 28/36 bold, foreground
3 aguardam resultado        ← contexto, 12/16 regular, muted
```

O card não precisa de ícone, cor forte ou gráfico quando o valor e o contexto já comunicam a informação.

### 19.3 Seção de formulário

```tsx
<FormSection
  title="Custos estimados"
  description="Informe os valores previstos fora do lance."
>
  <FormGrid>
    <CurrencyField label="Reparos" required />
    <CurrencyField label="Documentação" required />
    <CurrencyField label="Transporte e guincho" required />
    <CurrencyField label="Pneus" required />
  </FormGrid>
</FormSection>
```

### 19.4 Resumo da análise

```text
┌─────────────────────────────────────┐
│ Resultado da análise                │
│                                     │
│ Valor de mercado      R$ 50.000,00 │
│ Custos + reserva      R$ 10.800,00 │
│ Margem desejada        R$ 6.000,00 │
│ ─────────────────────────────────── │
│ LANCE MÁXIMO          R$ 33.200,00 │
│                                     │
│ [Abaixo do seu limite]              │
│ Lance simulado         R$ 31.000,00 │
│ Diferença               R$ 2.200,00 │
└─────────────────────────────────────┘
```

- Container Summary com `radius-lg`, borda e `surface`.
- Lance máximo usa `heading-1` ou `display` apenas quando for a principal saída da página.
- Badge sempre inclui texto.
- Divisor separa premissas da conclusão.

### 19.5 Linha de lote no mobile

```text
Corolla 2020                         [Acompanhando]
Lote 152 · Leilão Detran SP

Lance atual                              R$ 38.500
Meu limite                               R$ 42.000
[Abaixo do seu limite]
```

Toda a linha pode abrir o lote, desde que menus e botões internos tenham eventos e foco independentes.

### 19.6 Empty state

```tsx
<EmptyState
  icon={Eye}
  title="Nenhum lote acompanhado"
  description="Marque um lote para acompanhar seu lance e limite no dashboard."
  action={<Button variant="secondary">Ver lotes</Button>}
/>
```

### 19.7 Confirmação de análise fixada

```text
[i] Fixar esta análise?

As premissas e o lance máximo desta versão não poderão ser editados.
Se precisar revisar os valores depois, você criará uma nova versão.

[Cancelar]                         [Fixar análise]
```

O dialog explica a consequência. O botão de fixar continua Primary, pois a ação é intencional e não destrutiva.

---

## Manutenção deste documento

### Revisão 2.4 — 11/10/2026

- Pesquisa vira Mercado, em três abas (Avaliar, Panorama e Calibração), com o painel do lote e a Concorrência da análise (§15.8, D-71 a D-76).

### Revisão 2.3 — 11/10/2026

- Gráfico em degraus `StepLine` (lances de uma venda) e eixo, linha de referência e transição nas barras de faixa (§15.8, D-66).
- Pesquisa: filtros de fonte e km, botão “Comparar”, resumo com as vendas fora do %, ranking com busca e ordem, dispersão em R$ ou %, dicas nativas nos gráficos e textos de apoio em uma linha (§15.8).

### Revisão 2.2 — 08/10/2026

- Tokens de dados `data-1` a `data-5` (§3.1, escala sequencial de um tom) para os gráficos da Pesquisa (D-45).
- Item Pesquisa na navegação (§9) e padrão da tela (§15.8).

### Revisão 1.2 — 20/09/2026

- Corrigida a precedência de estilos globais sobre utilities.
- Separados contornos decorativos, bordas de controles e placeholders.
- Implementados tokens de tipografia e unificado o breakpoint de formulários em `md`.
- Corrigidos `Button asChild`, largura e contraste de loading, tamanhos compactos e bloqueio de links.
- Ampliadas áreas clicáveis, ajustado Select à largura do campo e aplicada lista de lotes no mobile.
- Alinhadas dimensões e ordem das ações de cards e dialogs ao contrato.

Atualize a versão e registre a decisão quando houver:

- novo token ou mudança de valor;
- novo componente reutilizável ou variante sistêmica;
- alteração de breakpoint, grid ou navegação;
- inclusão de tema escuro;
- mudança de tipografia ou biblioteca de ícones;
- padrão visual que apareça em três ou mais lugares.

Uma necessidade local não deve mudar o sistema por si só. Primeiro verifique se composição, conteúdo ou componente existente resolvem o caso. Se a mudança for realmente sistêmica, atualize este arquivo e a implementação na mesma entrega.
