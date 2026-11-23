-- Contração de artefatos legados (D-43, D-51, D-87):
-- - `watches.category`: substituída por `watches.categories` em D-43 (expandir → migrar → contrair).
-- - `fipe_responses`: sem uso desde D-51 (catálogo FIPE vem do dataset mensal em `fipe_prices`).

ALTER TABLE "watches" DROP CONSTRAINT IF EXISTS "watches_category_key";
ALTER TABLE "watches" DROP COLUMN IF EXISTS "category";

DROP TABLE IF EXISTS "fipe_responses";
