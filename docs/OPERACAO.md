# Leilão Tracker — Operação

> Runbook de deploy, release, backup e restauração (SPEC §11). Decisões técnicas em [`ARCHITECTURE.md`](ARCHITECTURE.md) (D-20 a D-22).

## 1. Ambiente

| Peça | Onde | Observações |
| --- | --- | --- |
| Aplicação | Vercel (Next.js 16, Node ≥ 22) | Região das funções **iad1 (Washington, D.C.)**, perto do Supabase `us-east-1` |
| Banco | Supabase PostgreSQL 17 | App via pooler de transação (`DATABASE_URL`, 6543); migrations via sessão (`DIRECT_URL`, 5432) |
| Autenticação | Supabase Auth | Cadastro público **desligado**; usuários criados no painel |
| Fotos | Supabase Storage, bucket privado `lot-images` | Bucket e políticas em `prisma/sql/storage.sql` |

## 2. Variáveis de ambiente

| Variável | Vercel (Production) | Máquina local | Observação |
| --- | :---: | :---: | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | ✅ | Pública |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | ✅ | ✅ | Pública; a proteção vem de RLS (D-14) e das políticas do Storage |
| `DATABASE_URL` | ✅ | ✅ | Pooler de transação, `?pgbouncer=true` |
| `DIRECT_URL` | ❌ | ✅ | Só para migrations, `db:storage` e backup |
| `SUPABASE_SECRET_KEY` | ❌ **nunca** | Só no backup | Ignora RLS. Supabase → Project Settings → API Keys → Secret keys |
| `E2E_EMAIL` / `E2E_PASSWORD` | ❌ | Opcional | Usuário dedicado aos testes E2E |
| `RESTORE_DATABASE_URL` / `RESTORE_SUPABASE_URL` | ❌ | Só na restauração | Destino da restauração |
| `FIPE_LOOKUP` | ❌ | Opcional | `off` desliga a importação da tabela FIPE e o casamento do valor de mercado durante a coleta (D-47, D-51). Padrão `on`. No GitHub Actions, como variável do workflow, só se for preciso desligar |

> Configure as variáveis **somente em Production**. Deploys de Preview sem variáveis falham no build de propósito, porque apontariam para o banco real. Para previews, crie um projeto Supabase separado e configure as variáveis dele em Preview.

## 3. Primeiro deploy

1. **Repositório:** envie o código para um repositório **privado** no GitHub.
2. **Supabase**, no projeto de produção:
   1. `npm run db:release`, com `DIRECT_URL` de produção no `.env.local`. Aplica as migrations e o bucket e as políticas do Storage.
   2. Authentication → Sign In / Providers: **Allow new users to sign up** desligado.
   3. Authentication → URL Configuration: **Site URL** = domínio de produção (ex.: `https://leilao.seudominio.com`).
   4. Advisors → Security e Performance: rodar e resolver alertas.
3. **Vercel:**
   1. Add New → Project → importar o repositório. O framework é detectado; build e install usam o padrão (o `postinstall` gera o Prisma Client).
   2. Settings → Environment Variables: as três variáveis marcadas para Vercel na tabela da seção 2, em **Production**.
   3. Settings → Functions → Function Region: **Washington, D.C. (iad1)**.
   4. Deploy.
4. **Conferência pós-deploy:**
   - [ ] `/` redireciona para `/login`; `/robots.txt` responde `Disallow: /`.
   - [ ] Login funciona; dashboard carrega.
   - [ ] Criar leilão, lote e análise; fixar.
   - [ ] Enviar uma foto e abri-la (confere CSP de `img-src`/`connect-src` com o domínio do Supabase).
   - [ ] Console do navegador sem violações de CSP.
   - [ ] Nenhum erro em Vercel → Logs.

## 4. Rotina de release

1. `npm run check` e `npm run build` passam localmente. Se possível, rode também `npm run test:e2e`.
2. **Com migration nova:** faça backup (`npm run backup`), depois `npm run db:release` **antes** de publicar o código.
   - A migration precisa ser compatível com a versão **atual** do app, porque por alguns minutos o código antigo roda sobre o schema novo. Adicione colunas e tabelas primeiro e remova só num release seguinte (expandir → migrar → contrair).
3. Publique (push/merge para a branch de produção). A Vercel faz o deploy.
4. Refaça a conferência pós-deploy (seção 3.4).

### Rollback

- **Código:** Vercel → Deployments → deploy anterior → **Instant Rollback**.
- **Banco:** migrations **não** são revertidas automaticamente. Crie uma migration corretiva. Nunca edite migration já aplicada (receita "Mudança de schema" da skill).
- **Dados perdidos ou corrompidos:** restauração (seção 6).

## 5. Backup

**Frequência:** semanal e **sempre antes de uma migration**. Guarde cópias fora da máquina, por exemplo em disco externo ou nuvem pessoal criptografada. O backup contém dados pessoais do app.

```bash
npm run backup
```

- **Gera** `backups/<data>/database.json` (tabelas do domínio, catálogo coletado, monitores, alertas, sugestões dispensadas e migrations aplicadas) e, com `SUPABASE_SECRET_KEY`, a pasta `backups/<data>/photos/`.
- **Leitura consistente:** as tabelas são lidas numa única transação somente leitura.
- **`backups/` não é versionada.**
- **Backups do plano Supabase:** o plano Free não oferece backups para download; o Pro mantém 7 dias diários. Este script vale para qualquer plano e é a fonte principal.

## 6. Restauração

Sempre comece pela simulação, que valida a integridade do backup sem tocar em nada:

```bash
npm run restore -- backups/<data>
```

### No mesmo projeto Supabase (ex.: dados apagados por engano)

1. Crie um banco vazio no mesmo cluster ou use um projeto novo (seção seguinte).
2. `DIRECT_URL=<url do destino> npx prisma migrate deploy`.
   Se o backup tiver catálogo coletado, carregue também os municípios: `DATABASE_URL=<url do destino> npm run db:seed`.
3. `RESTORE_DATABASE_URL=<url do destino> npm run restore -- backups/<data> --apply`.
4. Confira os dados e troque `DATABASE_URL` na Vercel para o banco restaurado.

### Em um projeto Supabase novo (desastre)

1. Crie o projeto e o usuário em Authentication → Users. Anote o **UUID** do usuário.
2. Aplique o schema e o Storage no destino, com `DIRECT_URL` do projeto novo:
   ```bash
   npm run db:release
   npm run db:seed
   ```
   `db:seed` carrega os municípios, necessários para restaurar o catálogo coletado.
3. Restaure reatribuindo o dono, porque o id do usuário mudou:
   ```bash
   npm run restore -- backups/<data> --apply --owner <uuid-do-usuário>
   ```
   Defina antes `RESTORE_DATABASE_URL`, e para as fotos `RESTORE_SUPABASE_URL` e `SUPABASE_SECRET_KEY` do projeto novo.
4. Atualize as variáveis na Vercel e na máquina local, e refaça a conferência pós-deploy.

**Garantias do script:**
- restaura só em `RESTORE_DATABASE_URL`, nunca no banco configurado no app;
- exige destino **vazio** e com as mesmas migrations;
- insere tudo numa transação única, então ou restaura inteiro ou nada.

**Ensaio feito em 27/09/2026:** dois bancos temporários, com leilão, lote, análise fixada e rascunho, duas revisões de resultado e uma foto.
- As 5 tabelas foram restauradas com conteúdo **idêntico**, verificado por hash.
- A imutabilidade das análises fixadas se manteve no destino.
- Uma segunda restauração no mesmo destino foi recusada.
- Repita o ensaio a cada mudança de schema relevante.

## 7. Monitoramento e manutenção

- **Coleta automática** (docs/PLANO-COLETA.md): workflow **Coleta** no GitHub Actions, de 2 em 2 horas.
  - **Segredo necessário** em GitHub → Settings → Secrets and variables → Actions: `DATABASE_URL` (pooler, porta 6543, o mesmo valor da Vercel). `DIRECT_URL` não é usado ali: `prisma generate` não conecta ao banco.
  - **Fontes** (D-37): todas as de `src/sources/index.ts`, em paralelo, cada uma com o seu registro em `collector_runs`. O log tem uma linha por fonte e, no fim, a linha dos lotes ligados e alertas. Fonte nova se cadastra em `sources` na primeira execução.
  - **Saúde:** a linha "Última coleta" no dashboard e em Leilões mostra a pior fonte; se uma falhar, o aviso traz o nome dela. Falha aparece ali e em Actions → Coleta.
  - **Disparo (D-33):** o `pg_cron` do Supabase dispara o workflow de 2 em 2 horas (`prisma/sql/cron.sql`); o agendamento do GitHub fica só como reserva, a cada 12 h.
    - **Token:** GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens → _Generate new token_. Repositório: só `LeonardoBMar/leilao`. Permissão: **Actions: Read and write**, e nada mais. Guarde no Supabase → SQL Editor: `select vault.create_secret('SEU_TOKEN', 'github_workflow_token');`. Para trocar: `select vault.update_secret(id, 'NOVO_TOKEN') from vault.secrets where name = 'github_workflow_token';`. Nunca no repositório nem no chat.
    - **Ativar ou atualizar o agendamento:** `npm run db:cron` (idempotente; falha com aviso se o token não estiver no Vault).
    - **Diagnóstico:** `select jobname, schedule, active from cron.job;`, as execuções em `cron.job_run_details` e as respostas do GitHub em `net._http_response` (204 = disparou; 401 = token inválido ou vencido). O token expira: renove antes da data escolhida, senão a linha "Última coleta" passa a mostrar atraso.
    - **Pausar:** `select cron.unschedule('leilao-coleta');` (o `npm run db:cron` recria).
  - **Rodar à mão:** Actions → Coleta → Run workflow, ou `npm run collect` na máquina local. Só uma fonte: `npm run collect -- --source patio-sao-carlos`.
  - **Lotes acompanhados** (D-34): anúncios abertos ligados a lotes entram primeiro em cada execução, e o lance lido vai para os lotes; o log mostra `· N lotes com lance novo · N resultados`. Resultado automático (D-35): lotes ligados sem resultado cujo anúncio encerrou com desfecho definitivo ganham a revisão 1 com `source = collector`. Falha nessa etapa marca a execução como falha com o erro `(lotes)`; a próxima leitura do anúncio corrige.
  - **Alertas** (D-32): criados ao fim de cada coleta para os monitores ligados; o log termina com `· N alertas`. Se a geração falhar, a execução fica como falha com o erro `(alertas)`, e a próxima recupera os lotes das últimas 48 h.
  - **Valor de mercado da FIPE** (D-47, D-49, D-51): anúncio sem valor da fonte é casado na tabela FIPE oficial junto com a coleta e por mais 2 min depois das fontes, tudo no banco; o log termina com `· N valores de mercado da FIPE`. Cada anúncio é tentado uma vez (`listings.market_value_checked_at`). A tabela de cada mês fica inteira em `fipe_prices`, e a versão escolhida para cada veículo como a fonte escreve, em `fipe_matches`, reaproveitada por todos os anúncios iguais e nos meses seguintes.
    - **Tabela do mês:** vem do dataset público fipeX no Hugging Face (`alanwgt/fipex-veiculos-brasil`), que publica a tabela no começo do mês. A coleta confere a cada execução se falta algum mês desde setembro/2026 e, se o arquivo já saiu, baixa (~5 MB) e grava; o log mostra `Tabela FIPE 2026-11: N preços importados · N anúncios de volta à fila` ou `ainda não publicada no dataset`. Até lá, vale a tabela anterior (o rótulo mostra o mês). Os anúncios casados numa tabela anterior voltam à fila quando a do mês deles chega.
    - **Avisos, não falhas:** problema na importação (dataset fora do ar, formato mudou, tabela incompleta) ou no casamento aparece como `aviso:` no log da coleta e **não** marca a execução como falha; a próxima tenta de novo. Aviso que se repete por dias: confira o dataset no Hugging Face (arquivo `AAAA/MM/fipex-prices.csv`) e as colunas esperadas em `src/domain/listings/fipe-dataset.ts`.
    - **Carga ou refazer um mês:** `npm run db:fipe-import` importa os meses que faltam; `npm run db:fipe-import -- --month 2026-10` refaz um mês (substitui o que houver).
    - **Acervo ou atraso:** `npm run db:market-values` casa todos os pendentes (minutos, sem rede). Opções: `--source <id>`, `--limit <n>` e `--dry-run` (lista o que casaria, sem gravar).
    - **Regra do casamento mudou:** suba `MATCHER_VERSION` em `src/domain/listings/fipe-match.ts` e registre a versão nova em `MATCHER_CHANGES`: `unmatched` se a regra só amplia a busca (refaz só as correlações sem casamento) ou `all` se a escolha de quem já casou pode mudar (refaz todas as automáticas). Os anúncios ligados às correlações refeitas são recalculados na próxima coleta (ou no `db:market-values`). Sem SQL à mão.
    - **Casamento errado:** `npm run db:fipe-match -- list --search GOL` acha a correlação; `show <id>` mostra as versões da FIPE com os códigos FIPE; `set <id> --models 005205-1` (uma versão) ou `--models 005205-1,005206-0` (família) ou `--none` corrige, e `auto <id>` desfaz. `set` e `auto` só mostram quantos anúncios mudariam; acrescente `--apply` para gravar. A correção vale para todos os anúncios com o mesmo veículo e a regra nunca a sobrescreve; os anúncios recebem o valor novo na próxima coleta.
    - **Desligar:** `FIPE_LOOKUP=off` no ambiente da coleta (importação e casamento).
  - **Extração mudou** (ex.: condição do veículo, situação nova da fonte mapeada): `npm run db:reparse` relê `listings.raw` e atualiza descrição, condição e situação dos anúncios já coletados, sem baixar as páginas (serve também quando a página já saiu do ar). Só aplica situação quando o dado bruto traz um desfecho reconhecido. Idempotente. (A migration `add_listing_condition` cita o nome antigo, `db:backfill-condition`.)
  - **Regra da chave do veículo ou da origem mudou** (`vehicleKey`, `BRAND_ALIASES`, `MODEL_RENAMES`; `inferOrigin`): `npm run db:vehicle-keys` (D-77) ou `npm run db:origins` (D-73) refazem a coluna gravada em todo o catálogo, sem rede e idempotentes. A coleta só regrava os anúncios que visita. Depois da migration que cria `vehicle_key`, rode `db:vehicle-keys` antes de publicar o código: até lá o Mercado não acha vendas por modelo.
  - **Encerrados do Superbid** (D-60): `npm run db:superbid-backfill` grava os lotes encerrados nos últimos 30 dias que ainda não estão no catálogo, com desfecho e preço final (uma requisição por lote, 1 s de intervalo: ~2 h para 30 dias). Opções: `--days <n>` e `--dry-run` (só conta). Feito em 10/10; repetir só se a coleta do Superbid ficar parada por dias.
  - **Encerrados da Leilões Freire** (D-68): `npm run db:freire-backfill` lê os 50 leilões antes do mais novo aberto (ids sequenciais), fica com os lotes de veículo e grava os que ainda não estão no catálogo, com desfecho e preço final (três requisições por leilão, os lotes saem do cache). Opções: `--from <id>`, `--to <id>` e `--dry-run`. Feito em 11/10; repetir só se a coleta da fonte ficar parada por semanas.
  - **Fonte com problema** (layout mudou, bloqueio): os erros ficam em `collector_runs.errors`. Para pausar uma fonte, `update sources set active = false where id = 'leilo'` (ou `'patio-sao-carlos'`, `'freitas'`, `'detran-mg'`, `'leilao-online'`, `'detran-sc'`, `'superbid'`, `'leiloes-pb'`, `'leiloes-freire'`, `'lance-certo'`; o coletor passa a ignorá-la e o cartão de saúde deixa de considerá-la). Anúncio que não cumpre o contrato comum (ex.: categoria nova que o adaptador ainda não traduz) vira falha com o motivo, sem ser gravado.
- **Qualidade do preço provável** (D-76): `npm run db:estimate-backtest -- --variant v1 --write` refaz o backtest (só leitura, alguns minutos) e grava `src/features/research/engine-quality.json`, que a aba Mercado → Calibração mostra com a data. Rode mensalmente ou depois de mudar o motor, e leve o arquivo no commit.
- **Erros:** Vercel → Logs (as actions registram `console.error` sem dados pessoais).
- **Supabase → Advisors** (Security e Performance): mensalmente e depois de cada migration.
- **Performance do banco** (D-80): leia as métricas pelo MCP `supabase` (só leitura) ou pelo SQL Editor.
  - **Consultas:** `select calls, round(mean_exec_time) ms, temp_blks_written, left(query, 200) from extensions.pg_stat_statements order by total_exec_time desc limit 20;` (troque a ordem por `temp_blks_written` para achar quem usa disco temporário). O histórico foi zerado em 12/10/2026 às 19:17 UTC.
  - **Linha de base de 12/10/2026 (19:20 UTC):** `pg_stat_database.temp_bytes` = 97.743.567.128 desde 25/08 (sem dono conhecido; `log_temp_files` desligado); `listings` com 466 mil UPDATEs, 37% HOT, heap de 43 MB (5.517 páginas, 45,6% visíveis no mapa) e TOAST de 68 MB para 19 mil linhas; o índice das vendas buscava o heap em 45% das linhas.
  - **Instância:** a mesma consulta, com o mesmo plano e os mesmos buffers em memória, levou 926 ms e depois 13 ms. Se isso se repetir, confira em Supabase → Reports → Database a CPU, a memória e o **swap** nas janelas da coleta; com swap ou CPU no teto, o caminho é subir o compute (decisão de custo).
- **Dependências:** `npm audit` mensal. Atualizações do Next seguem o guia de upgrade em `node_modules/next/dist/docs/` e o `AGENTS.md`.
- **Arquivos órfãos no Storage** (envio sem confirmação, ou falha ao remover): são inofensivos, porque ninguém os exibe. Para limpar, compare `storage.objects` com `lot_images.storage_path`.
- **Senha do banco trocada:** atualize `DATABASE_URL` na Vercel, os dois segredos do GitHub Actions e `DATABASE_URL`/`DIRECT_URL` no `.env.local`.
