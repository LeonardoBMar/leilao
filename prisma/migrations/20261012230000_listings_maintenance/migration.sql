-- Manutenção de `listings` e da conexão da auditoria de performance de 12/10/2026 (D-80). Nenhum dado muda.
-- O CREATE INDEX leva poucos segundos (~19 mil linhas) e só segura as escritas nesse intervalo: aplique fora da coleta.

-- Fila de revisitas do coletor: o índice só em `next_check_at` lia os agendados de todas as fontes e descartava os das
-- outras (473 linhas por consulta, ~967 entradas por varredura). Agora por fonte e só com os agendados.
-- DropIndex
DROP INDEX "listings_next_check_at_idx";

-- CreateIndex
CREATE INDEX "listings_source_next_check_idx" ON "listings"("source_id", "next_check_at") WHERE ("next_check_at" IS NOT NULL);

-- Folga na página para as regravações do coletor caberem como HOT (só 37% eram), e vacuum por volume fixo em vez de 20%
-- da tabela: o mapa de visibilidade estava em 45% das páginas e o índice das vendas buscava o heap em 45% das linhas.
-- O fillfactor vale para as páginas novas; as atuais se ajustam com as regravações.
ALTER TABLE "listings" SET (
  fillfactor = 85,
  autovacuum_vacuum_scale_factor = 0.01,
  autovacuum_vacuum_threshold = 200,
  autovacuum_vacuum_insert_scale_factor = 0.01,
  autovacuum_analyze_scale_factor = 0.02
);

-- Transação esquecida aberta (runner da coleta interrompido) solta as travas e a conexão do pooler em 60 s. As
-- transações do app e dos scripts ficam ociosas por milissegundos entre comandos. Vale para as sessões novas.
ALTER ROLE CURRENT_USER SET idle_in_transaction_session_timeout = '60s';
