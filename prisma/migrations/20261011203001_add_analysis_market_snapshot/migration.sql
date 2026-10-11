-- AlterTable
ALTER TABLE "analyses" ADD COLUMN     "market_snapshot" JSONB;

-- O snapshot é do momento da fixação (D-74): só existe em análise fixada e é sempre um objeto.
ALTER TABLE "analyses" ADD CONSTRAINT "analyses_market_snapshot_fixed"
  CHECK ("market_snapshot" IS NULL OR ("status" = 'fixed' AND jsonb_typeof("market_snapshot") = 'object'));
