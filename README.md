<p align="center">
  <img src="docs/assets/banner.jpg" alt="Leilão Tracker — Análise financeira, coleta automática e inteligência de mercado para leilões de veículos" width="100%" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16-15171C?style=flat-square&logo=nextdotjs&logoColor=white" alt="Next.js 16" />
  <img src="https://img.shields.io/badge/React-19-15171C?style=flat-square&logo=react&logoColor=white" alt="React 19" />
  <img src="https://img.shields.io/badge/TypeScript-Strict-2B45C8?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript Strict" />
  <img src="https://img.shields.io/badge/Prisma-7-15171C?style=flat-square&logo=prisma&logoColor=white" alt="Prisma 7" />
  <img src="https://img.shields.io/badge/Supabase-PostgreSQL-15171C?style=flat-square&logo=supabase&logoColor=white" alt="Supabase" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-4-15171C?style=flat-square&logo=tailwindcss&logoColor=white" alt="Tailwind CSS 4" />
</p>

# Leilão Tracker

Aplicação web para estudar e acompanhar leilões de veículos no Brasil, calcular o **limite de lance** antes do encerramento, preservar o histórico imutável de decisões e comparar estimativas com os preços reais de arremate.

> **Pergunta central do produto:**
> *“Considerando minhas estimativas de valor, custos e margem, quanto posso pagar por este lote?”*

---

## Principais funcionalidades

### 1. Coleta automática de leilões e tabela FIPE
- **10 fontes integradas** em paralelo (`src/sources/`): **Leilo**, **Pátio Estadual São Carlos**, **Freitas**, **Detran-MG**, **Leilão Online**, **Detran-SC**, **Superbid**, **Leilões PB**, **Leilões Freire** e **Lance Certo**.
- **Casamento automático com a FIPE:** anúncios sem valor de mercado informado pela fonte são associados automaticamente à tabela FIPE oficial do mês (via dataset público *fipeX*), com reaproveitamento de correlações e ajuste manual quando necessário.
- **Atualização de lances e desfechos:** acompanha a evolução dos lances de lotes monitorados e registra resultados automaticamente quando o leilão encerra.

### 2. Análise financeira e decisões imutáveis
- **Calculadora de lance máximo:** estima o maior lance viável considerando valor de venda esperado, reparos, documentação, transporte/guincho, pneus, revisão, comissão, reserva para imprevistos e margem desejada — tudo em centavos inteiros (`Cents`).
- **Premissas padrão calibradas por condição:** preenche rascunhos automaticamente com base na FIPE, monta declarada (pequena, média, grande), taxas do anúncio e distância do pátio.
- **Snapshots imutáveis:** ao **fixar** uma análise antes do leilão, as premissas e o limite ficam congelados. Revisões criam novas versões (`v2`, `v3`…) e o resultado final é sempre comparado com a decisão tomada antes do desfecho.

### 3. Monitores, alertas e estimativas
- **Filtros instantâneos** por marca/modelo, faixa de preço, % da FIPE, ano, distância, categoria, combustível, quilometragem, condição declarada e origem.
- **Monitores salvos e alertas:** qualquer busca pode virar um monitor que gera alertas automáticos sempre que novos lotes compatíveis entram no catálogo.
- **Preço provável vs. limite estimado:** compara lotes abertos com vendas parecidas já encerradas e destaca o que cabe no limite.

### 4. Inteligência de mercado
- **Avaliar:** faixa típica de arremate, mediana, % da FIPE e confiança estatística para um recorte de veículo.
- **Panorama:** distribuição do % da FIPE por condição, origem (financiamento, seguradora, frota, órgão público), ranking de modelos, curva de subida de lances e **mapa interativo do Brasil** por estado.
- **Calibração:** mede quantas análises fixadas antes do leilão acertaram a faixa real de arremate e audita a qualidade do motor de preço provável por backtest.

---

## Arquitetura

O projeto segue uma arquitetura em camadas estrita, verificada pelo ESLint:

```text
src/
├── app/          # Rotas App Router (Next.js 16 + Cache Components + Suspense)
├── features/     # Módulos de negócio (actions, queries, mutations, schemas, UI)
├── domain/       # Regras puras de domínio (cálculo financeiro, FIPE, saúde, mercado)
├── server/       # Infraestrutura server-only (Prisma, Supabase Auth/Storage, coletor)
├── sources/      # Adaptadores das 10 casas de leilão + fixtures e testes
├── components/   # Design System próprio ("refinado e silencioso") e gráficos
└── lib/          # Utilitários puros (formatação pt-BR, datas UTC, ActionState)
```

- **Sem estado implícito:** dinheiro sempre em `Cents` (inteiro), taxas em *basis points* e datas em UTC (exibidas em `America/Sao_Paulo`).
- **Segurança por padrão:** toda query e mutation exige sessão autenticada (`requireUser()`) e filtra por `ownerId`; Server Actions validam entradas com Zod.
- **Coleta agendada:** `pg_cron` no Supabase aciona o workflow [collect.yml](.github/workflows/collect.yml) no GitHub Actions a cada 12 horas.

---

## Stack

| Camada | Tecnologia |
| --- | --- |
| Framework | Next.js 16 (App Router, Cache Components, React Compiler) · React 19 |
| Linguagem | TypeScript 6 (estrito) |
| Estilo & UI | Tailwind CSS 4 · Radix UI · Lucide · Design System próprio ([DESIGN.md](DESIGN.md)) |
| Banco & ORM | PostgreSQL 17 (Supabase) · Prisma 7 (`@prisma/adapter-pg`) |
| Auth & Storage | Supabase Auth (`@supabase/ssr`) · Supabase Storage (bucket privado) |
| Validação | Zod 4 |
| Testes | Vitest (unitários e domínio) · Playwright (E2E) |
| CI & Coleta | GitHub Actions · Supabase `pg_cron` · Vercel |

---

## Como rodar localmente

### Pré-requisitos
- **Node.js ≥ 22**
- Um projeto no **Supabase** (PostgreSQL + Auth + Storage)

### Passo a passo

1. **Instale as dependências:**
   ```bash
   npm ci
   ```

2. **Configure as variáveis de ambiente:**
   ```bash
   cp .env.example .env.local
   ```
   Preencha `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `DATABASE_URL` (pooler, porta `6543`) e `DIRECT_URL` (sessão, porta `5432`).

3. **Aplique as migrations, políticas de Storage e municípios:**
   ```bash
   npm run db:release
   npm run db:seed
   ```

4. **Inicie o servidor de desenvolvimento:**
   ```bash
   npm run dev
   ```
   Acesse [http://localhost:3000](http://localhost:3000).

---

## Comandos úteis

| Comando | Descrição |
| --- | --- |
| `npm run check` | Typecheck (`next typegen` + `tsc`), ESLint, Prettier e Vitest |
| `npm run build` | Build de produção do Next.js |
| `npm run test:e2e` | Testes ponta a ponta com Playwright |
| `npm run collect` | Executa a coleta manual de todas as fontes (aceita `--source <id>`) |
| `npm run db:cron` | Configura ou atualiza o agendamento da coleta no `pg_cron` do Supabase |
| `npm run backup` | Gera backup consistente do banco e fotos em `backups/<data>/` |
| `npm run restore -- backups/<data>` | Simula (ou aplica com `--apply`) a restauração de um backup |

---

## Documentação

- [Guia de uso](docs/GUIA.md) — fluxo completo do dia a dia na aplicação
- [Arquitetura e decisões](docs/ARCHITECTURE.md) — system design e registro de decisões (D-01+)
- [Design System](DESIGN.md) — tokens, tipografia, superfícies e padrões de UI
- [Especificação do produto](SPEC.md) — visão original e modelo de domínio
- [Operação e deploy](docs/OPERACAO.md) — Vercel, Supabase, backup, restauração e monitoramento
