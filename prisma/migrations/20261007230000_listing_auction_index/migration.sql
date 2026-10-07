-- Leilões do catálogo (D-42): agrupamento e filtro dos anúncios por fonte e leilão.

-- CreateIndex
CREATE INDEX "listings_source_id_auction_external_id_idx" ON "listings"("source_id", "auction_external_id");
