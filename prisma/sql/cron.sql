-- Disparo da coleta pelo Supabase (D-33): o pg_cron chama a API do GitHub de 4 em 4 horas e dispara o workflow
-- "Coleta" (.github/workflows/collect.yml). O agendamento do próprio GitHub foi removido para não duplicar execuções
-- nem consumir a cota mensal do Actions em repositório privado.
--
-- Fica fora das migrations do Prisma: pg_cron e pg_net não existem no shadow database.
-- Pré-requisito: o segredo `github_workflow_token` no Vault (docs/OPERACAO.md §7). O token nunca fica neste arquivo.
-- Idempotente: rode com `npm run db:cron` sempre que este arquivo mudar.

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- Sem o token, o agendamento dispararia requisições recusadas em silêncio: falha aqui, com a instrução.
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'github_workflow_token') then
    raise exception 'Cadastre o segredo github_workflow_token no Vault antes (docs/OPERACAO.md, seção 7).';
  end if;
end
$$;

-- Horário em UTC (00:17, 04:17, 08:17, 12:17, 16:17 e 20:17 UTC = 21:17, 01:17, 05:17, 09:17, 13:17 e 17:17 BRT). Mesmo nome = o job existente é atualizado.
select cron.schedule(
  'leilao-coleta',
  '17 */4 * * *',
  $job$
  select net.http_post(
    url := 'https://api.github.com/repos/LeonardoBMar/leilao/actions/workflows/collect.yml/dispatches',
    headers := jsonb_build_object(
      'Accept', 'application/vnd.github+json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'github_workflow_token'),
      'X-GitHub-Api-Version', '2022-11-28',
      'User-Agent', 'leilao-tracker-cron',
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object('ref', 'main'),
    timeout_milliseconds := 10000
  );
  $job$
);
