-- Índices da otimização do dashboard (D-85). Só índices: nenhum dado muda.

-- Última execução por fonte (`getCollectorStatus`): substitui índice ASC por DESC.
-- DropIndex
DROP INDEX IF EXISTS "collector_runs_source_id_started_at_idx";

-- CreateIndex
CREATE INDEX "collector_runs_source_id_started_at_idx" ON "collector_runs"("source_id", "started_at" DESC);

-- Anúncios abertos por município e encerramento (`getRegionOverview`, `getCollectorStatus`).
-- CreateIndex
CREATE INDEX "listings_open_region_idx" ON "listings"("municipality_id", "ends_at") WHERE ("status" = 'open');
