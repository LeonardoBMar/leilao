# Plano: coleta automática, alertas e estimativas

Status: **aprovado em 2026-09-27**. Decisões registradas em `docs/ARCHITECTURE.md` §15 (D-25 a D-30).

## 1. Objetivo

Automatizar o fluxo **Descobrir → Filtrar → Acompanhar → Analisar → Registrar decisão → Observar resultado → Aprender**, com o mínimo de trabalho manual:

1. Um coletor busca lotes em sites de leilão, sozinho e periodicamente.
2. Os dados viram um formato único (veículo, lote, leilão, data, local, preço, fotos) e são deduplicados.
3. Monitores do usuário ("VW Fox 2011–2013 até 150 km de São Carlos") geram alertas.
4. Um clique leva o lote para o Tracker, já preenchido. Lance e resultado passam a ser atualizados pelo coletor.
5. As estimativas (preço provável e limite estimado) saem **dos dados do próprio sistema**: arremates observados e análises do usuário.

**Único passo manual por princípio: fixar a análise.** A fixação registra a decisão do usuário antes do resultado. Se o sistema fixasse sozinho, o indicador mediria a fórmula, e não o usuário. O sistema prepara tudo e o usuário revisa e fixa.

## 2. Primeira fonte: Leilo (levantamento de 2026-09-27)

| Item | Achado | Consequência |
| --- | --- | --- |
| `robots.txt` | `Allow: /` para todos, com sitemap | Coleta permitida pelo site |
| Regulamentos (cadastro, participação, privacidade) | Nenhuma cláusula contra robôs, raspagem ou extração | Sem impedimento explícito; manter coleta moderada |
| Descoberta | `sitemap-lotes.xml` lista os lotes abertos (617 no dia) com `lastmod` | Coleta **incremental**: só baixa lote novo ou alterado |
| Dados do lote | Página renderizada no servidor com o **estado completo em `window.__INITIAL_STATE__`** (situação, lance e nº de lances, início e fim, pátio, **código e nome FIPE**, **valor de mercado**, km, anos, **custos**: comissão %, despachante, remoção, depósito) e **JSON-LD `Vehicle`** (núcleo: marca, modelo, ano, km, lance, fim, fotos) | Adaptador lê o estado da página validado com Zod e usa o JSON-LD como reserva. Sem seletores CSS (as classes têm versão no nome, ex. `…-julho2026`) e sem navegador automatizado |
| Localização | Cidade/UF e endereço do pátio no JSON-LD | Distância calculada pela cidade (base do IBGE) |
| Resultado após o leilão | A **página do lote continua no ar** depois do fim, mas o lote **sai do sitemap**. No JSON-LD: `availability` vira `SoldOut`, `offers.price` é o **lance final** e `availabilityEnds`, a hora real do encerramento. Na página: "Vendido", "Lance Final · 4 lances · R$ 23.900,00" (lote 64, 21/09/2026, confirmado) | O coletor **guarda o link na descoberta e revisita o lote depois do fim** para registrar o arremate. "Leilões realizados" não serve: leva à próxima edição do evento |
| Custos e valor de mercado da fonte | Ex. lote 64: valor de mercado R$ 41.247, comissão 5% (R$ 1.195), despachante R$ 50, remoção R$ 400, depósito R$ 2.350 | Entram no rascunho de "Adicionar à análise" como **sugestão rotulada com a fonte** (D-30); nunca como estimativa do sistema (D-28) |

## 3. Arquitetura

```text
GitHub Actions (cron) ──► coletor (Node, mesmo repositório)
                            ├─ adaptador por fonte: descobrir URLs → baixar → extrair → validar (Zod)
                            ├─ normalizar (domain) → deduplicar → gravar observação
                            └─ casar com monitores → criar alertas
                                   │ Prisma
                                   ▼
                              Supabase (Postgres)
                                   ▲ DAL (requireUser + ownerId)
Leilão Tracker (Vercel) ── Descobertos · Monitores · Alertas · Adicionar à análise · Estimativas
```

**Camadas**, seguindo as regras atuais (ESLint aplica):

| Onde | O quê | Teste |
| --- | --- | --- |
| `src/domain/listings/` | Tipos do formato único, normalização (marca e modelo, cidade), chave de deduplicação, distância, casamento com monitor, estimativas. **Puro.** | Unitário, obrigatório |
| `src/sources/<fonte>/` | Adaptador: `discover()` (URLs com `lastmod`) e `parse(html) → ListingInput`. O `parse` é puro; o acesso à rede fica isolado | Unitário com **páginas salvas** em `fixtures/`. Quando o site mudar, o teste quebra |
| `src/server/collector/` | Orquestração: rede educada, gravação, execução registrada | Integração |
| `scripts/collect.ts` | Ponto de entrada do cron | Execução a seco com fixtures no CI |
| `src/features/listings`, `watches`, `alerts` | DAL, actions e telas | Unitário e E2E |

**Rede educada:**
- 1 requisição por segundo por fonte.
- User-Agent identificado (`LeilaoTracker/1.0 (+contato)`).
- Nova tentativa com espera crescente em 429 e 5xx.
- Limite de páginas por execução.
- Só páginas públicas: nada de login ou CAPTCHA.

## 4. Modelo de dados (novas tabelas)

| Tabela | Escopo | Conteúdo |
| --- | --- | --- |
| `sources` | global | Fonte (leilo), ativa ou não |
| `listings` | **global** | Anúncio normalizado. **Única por `(source_id, external_id)`**. Guarda URL canônica (`/lote/<uuid>/`), veículo, lote, evento, início e fim, cidade, UF, município IBGE, fotos (URLs), `first_seen_at`, `last_seen_at`, `raw` (JSON original). **Desfecho na fonte:** status (aberto, vendido, condicional, não vendido…), **lance final**, nº de lances, hora real do fim e `next_check_at` (quando revisitar). Complementos da fonte: valor de mercado informado, vendedor, tipo de retomada e taxas da descrição |
| `listing_observations` | global, só inserção | Instantâneos de lance e status ao longo do tempo. Base do "último lance observado" e do histórico de preço |
| `collector_runs` | global | Início, fim, fonte, descobertos, novos, atualizados e falhas, com amostra de erros |
| `municipalities` | global, semente | Municípios do IBGE com latitude e longitude (arquivo estático versionado, sem API externa) |
| `watches` | `owner_id` | Monitor: marca, modelo, faixa de ano, preço máximo, cidade base e raio (padrão São Carlos/SP, 150 km), ativo |
| `alerts` | `owner_id` | Monitor × anúncio, **único por par**, com lido ou não e data |
| `lots.listing_id` | `owner_id` | Liga o lote do usuário ao anúncio, para atualização automática |
| `results.source` | `owner_id` | `manual` ou `collector`, para rastrear a origem do dado |

- **Deduplicação:**
  - Mesma fonte: a chave única impede duplicar. Reaparecer só atualiza o anúncio e cria uma observação.
  - Fontes diferentes, quando houver a segunda: marca, modelo, ano, cidade e data formam uma impressão digital. O caso é marcado como **"possível duplicado"** e **nunca é juntado sozinho**.
- **Segurança (D-14):** as tabelas novas seguem com RLS ativo e sem acesso pela API de dados. Só o servidor lê e grava. Catálogo global não tem `owner_id`; o que é do usuário (monitores, alertas, lotes) tem.

## 5. Estimativas com dados do próprio sistema

Nada de fórmula externa. A estimativa só aparece quando **existe base suficiente**, e sempre mostra de onde veio.

| Estimativa | Fonte | Regra |
| --- | --- | --- |
| **Preço provável de arremate** | Últimos lances observados de lotes **comparáveis** já encerrados no catálogo | Mesma marca e modelo, ano ±1, faixa de km, região e **mesma condição declarada** (sem monta informada, pequena monta, média monta, sucata; `damage_level`). Mostra **mediana e faixa (P25–P75) com o número de casos**. Com menos de 5 comparáveis: "Sem base suficiente (3 de 5)" |
| **Limite estimado** | Calculadora atual (a mesma fórmula da análise) alimentada pelos **dados do usuário**: valor de mercado e custos das suas análises fixadas de veículos comparáveis, e margem e reserva padrão | Sem análises comparáveis suficientes, não mostra limite, e sim "faça 3 análises de veículos parecidos para liberar". Nunca vira análise fixada sozinha |
| **Precisão** | Estimado × real dos lotes encerrados | Tela de aprendizado (Fase 2): quanto a estimativa errou, por modelo e origem |

Consequência honesta: **no começo não haverá estimativas.** Elas surgem conforme o coletor acumula arremates e o usuário fixa análises. A etapa 5 só começa quando houver dados.

## 6. Etapas

Cada etapa segue o fluxo da skill `leilao-padroes`:
1. atualizar SPEC e ARCHITECTURE;
2. implementar do domínio para as telas;
3. testar (unitário, fixtures e E2E);
4. rodar `npm run check` e `npm run build`;
5. revisar com o subagente `leilao-reviewer`;
6. commitar e usar a etapa por alguns dias antes da próxima.

| # | Entrega | Pronto quando |
| --- | --- | --- |
| **0** | **Decisões e fixtures.** SPEC e ARCHITECTURE atualizados. Arremate já confirmado pela página do lote (§2). Falta mapear os **outros desfechos**: salvar como fixture as páginas de lotes de São Carlos do leilão de **28/09 10h** depois do fim (vendido, condicional, não vendido, retirado) | Decisões aprovadas e uma fixture para cada desfecho conhecido |
| 1 | **Catálogo + adaptador Leilo + coletor agendado**, já **revisitando lotes encerrados** para gravar o arremate (a base das estimativas começa a crescer no primeiro dia). Tabelas `sources`, `listings`, `listing_observations`, `collector_runs` e `municipalities`. Cron de 2 em 2 horas (cabe na cota gratuita do GitHub para repositório privado). Tela **Descobertos** com filtros (marca, modelo, ano, preço, distância) e cartão "última coleta" no dashboard. **Condição declarada** pelo leiloeiro (monta, sucata, circulação vedada, remarcado, laudo cautelar…) extraída da descrição, com selos e filtro | Lotes até 150 km de São Carlos aparecem sozinhos, sem duplicar, com fotos e distância. Falha do coletor fica visível no app |
| 2 | **Monitores e alertas.** Telas de monitores (CRUD) e de alertas, com contador na navegação e seção no dashboard | Lote novo compatível gera **um** alerta, com "Ver lote" e "Adicionar à análise" |
| 3 | **Adicionar à análise + acompanhamento automático.** Cria leilão, lote e rascunho a partir do anúncio (sem duplicar se já existir). O coletor atualiza o lance dos lotes ligados | Um clique leva o lote ao Tracker, e o lance atual se mantém sozinho |
| 4 | **Resultado automático** nos lotes do usuário: quando o anúncio ligado encerra, o coletor registra o resultado (desfecho, preço final, hora real) com `source = collector` e link. Desfecho ambíguo (ex.: condicional) fica como **"resultado a confirmar"**, já preenchido | O usuário não digita resultados; no máximo confirma |
| 5 | **Estimativas** (§5), quando houver base | Alerta e anúncio mostram "provável R$ X (n=12) · limite estimado R$ Y" ou "sem base suficiente" |
| 6 | **Notificações externas** (e-mail ou push) e **segunda fonte** | Alerta chega fora do app; segunda fonte entra só com um adaptador novo |

## 7. Decisões

Aprovadas e registradas em `docs/ARCHITECTURE.md` §15: **D-25** catálogo global · **D-26** coletor no GitHub Actions com `tsx` · **D-27** adaptador por estado da página + JSON-LD · **D-28** estimativas só com dados do sistema · **D-29** fotos por URL · **D-30** dados da fonte como sugestão rotulada.

## 8. Riscos

| Risco | Mitigação |
| --- | --- |
| Lote vendido "condicional" ou desfecho novo | Mapeamento explícito de status com fixture; status desconhecido vira "a confirmar" e aparece no registro da coleta, nunca é adivinhado |
| Página do lote sair do ar depois de um tempo | Revisita logo após o fim (`next_check_at` = fim + 1 h, com novas tentativas); o que não for obtido fica "desfecho desconhecido" e fora das estimativas |
| Horário do cron no GitHub não é exato (atrasos de minutos) | Observação extra nas horas finais; se não bastar, servidor pequeno (D-26 prevê a migração) |
| Site muda o formato | Validação Zod aponta a falha, `collector_runs` e o cartão no dashboard mostram, e o teste com fixture reproduz |
| Volume cresce com mais fontes | Coleta incremental por `lastmod`; filtro por raio antes de baixar detalhes quando a fonte permitir |
| Termos de uso mudam | Revisar a cada fonte nova; desligar a fonte em `sources.active` |
