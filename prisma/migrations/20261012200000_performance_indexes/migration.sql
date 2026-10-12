-- Índices da auditoria de performance de 12/10/2026 (D-79). Só índices: nenhum dado muda.
-- As tabelas são pequenas (listings ~19 mil linhas, fipe_prices ~98 mil): cada CREATE INDEX leva poucos segundos e
-- só segura as escritas nesse intervalo, sem bloquear leituras.

-- Fila do casamento FIPE: o índice completo servia só aos pendentes (`market_value_checked_at IS NULL`).
-- DropIndex
DROP INDEX "listings_market_value_checked_at_idx";

-- Nunca usado (pg_stat_user_indexes.idx_scan = 0); a tabela tem poucas linhas.
-- DropIndex
DROP INDEX "watches_active_idx";

-- CreateIndex
CREATE INDEX "listings_fipe_pending_idx" ON "listings"("status", "first_seen_at" DESC) WHERE ("market_value_checked_at" IS NULL);

-- Vendas da Pesquisa e do Avaliar: as agregações leem só o índice, em vez de uma página do heap por venda.
-- CreateIndex
CREATE INDEX "listings_sales_idx" ON "listings"("ends_at", "category", "damage_level", "state", "source_id", "vehicle_key", "model_year", "mileage_km", "final_bid_cents", "market_value_cents", "market_value_origin", "vehicle_origin", "municipality_id", "id") WHERE ("status" = 'sold');

-- Nome mais recente de cada versão FIPE: a PK começa pelo mês e a busca por código lia o índice inteiro.
-- CreateIndex
CREATE INDEX "fipe_prices_fipe_code_reference_month_idx" ON "fipe_prices"("fipe_code", "reference_month" DESC);
