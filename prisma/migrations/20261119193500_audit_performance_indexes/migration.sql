-- Índices da auditoria de performance (D-84). Só índices: nenhum dado muda.

-- Substituído por (vehicle_key, status, ends_at) desde D-77.
-- DropIndex
DROP INDEX IF EXISTS "listings_brand_model_model_year_idx";

-- Leilões do catálogo: inclui last_seen_at DESC para agrupamento e capa.
-- DropIndex
DROP INDEX IF EXISTS "listings_source_id_auction_external_id_idx";

-- CreateIndex
CREATE INDEX "listings_source_id_auction_external_id_last_seen_at_idx" ON "listings"("source_id", "auction_external_id", "last_seen_at" DESC);

-- Catálogo "Recém-chegados": apenas anúncios abertos ordenados por entrada.
-- CreateIndex
CREATE INDEX "listings_open_first_seen_idx" ON "listings"("first_seen_at" DESC) WHERE ("status" = 'open');

-- Curva de lances e passos de uma venda (`getBidCurve`, `getSaleBids`): apenas observações com lance positivo.
-- CreateIndex
CREATE INDEX "listing_observations_positive_bid_idx" ON "listing_observations"("listing_id", "observed_at" DESC) WHERE ("bid_cents" > 0);
