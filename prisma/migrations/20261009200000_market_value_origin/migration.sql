-- Valor de mercado com origem (D-47, docs/PLANO-VALOR-MERCADO.md §4): da fonte ou casado na tabela FIPE oficial.

-- CreateEnum
CREATE TYPE "market_value_origin" AS ENUM ('source', 'fipe_version', 'fipe_family');

-- AlterTable
ALTER TABLE "listings" ADD COLUMN     "market_value_checked_at" TIMESTAMPTZ(3),
ADD COLUMN     "market_value_fipe_code" TEXT,
ADD COLUMN     "market_value_origin" "market_value_origin",
ADD COLUMN     "market_value_ref_month" DATE;

-- Todo valor gravado até aqui veio da fonte.
UPDATE "listings" SET "market_value_origin" = 'source' WHERE "market_value_cents" IS NOT NULL;

-- CHECKs que o código anterior não viola (expandir). "Origem nula exatamente quando não há valor" entra no release
-- seguinte, quando nenhum coletor antigo grava valor sem origem (contrair, docs/OPERACAO.md).
ALTER TABLE "listings"
  ADD CONSTRAINT "listings_market_value_fipe_code_origin" CHECK (
    "market_value_fipe_code" IS NULL OR "market_value_origin" = 'fipe_version'
  ),
  ADD CONSTRAINT "listings_market_value_ref_month_first_day" CHECK (
    "market_value_ref_month" IS NULL OR EXTRACT(DAY FROM "market_value_ref_month") = 1
  );

-- CreateTable
CREATE TABLE "fipe_responses" (
    "key" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "fetched_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fipe_responses_pkey" PRIMARY KEY ("key")
);

ALTER TABLE "fipe_responses" ADD CONSTRAINT "fipe_responses_key_not_blank" CHECK (btrim("key") <> '');

-- Global e só do servidor, como o catálogo (D-14, D-25).
ALTER TABLE "fipe_responses" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "fipe_responses" FROM anon, authenticated;

-- CreateIndex
CREATE INDEX "listings_market_value_checked_at_idx" ON "listings"("market_value_checked_at");
