-- Catálogo de preços e correlação anúncio → FIPE (D-49, docs/PLANO-FIPE-TABELAS.md). Expandir: tabelas novas e uma
-- coluna opcional em `listings`; nada é apagado. Contrair: o CHECK adiado de D-47 (origem nula ⇔ sem valor).
-- CreateEnum
CREATE TYPE "fipe_match_kind" AS ENUM ('version', 'family', 'none');

-- CreateEnum
CREATE TYPE "fipe_match_origin" AS ENUM ('auto', 'manual');

-- AlterTable
ALTER TABLE "listings" ADD COLUMN     "fipe_match_id" UUID;

-- CreateTable
CREATE TABLE "fipe_prices" (
    "id" UUID NOT NULL,
    "reference_table" INTEGER NOT NULL,
    "reference_month" DATE NOT NULL,
    "vehicle_type" SMALLINT NOT NULL,
    "brand_code" TEXT NOT NULL,
    "brand_name" TEXT NOT NULL,
    "model_code" TEXT NOT NULL,
    "model_name" TEXT NOT NULL,
    "model_year" SMALLINT NOT NULL,
    "fuel_code" SMALLINT NOT NULL,
    "fipe_code" TEXT NOT NULL,
    "value_cents" INTEGER NOT NULL,
    "fetched_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fipe_prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fipe_matches" (
    "id" UUID NOT NULL,
    "vehicle_key" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "model" TEXT,
    "model_year" SMALLINT NOT NULL,
    "fuel" TEXT,
    "category" TEXT NOT NULL,
    "kind" "fipe_match_kind" NOT NULL,
    "reason" TEXT,
    "vehicle_type" SMALLINT,
    "brand_code" TEXT,
    "models" JSONB NOT NULL,
    "origin" "fipe_match_origin" NOT NULL DEFAULT 'auto',
    "matcher_version" SMALLINT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "fipe_matches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "fipe_prices_fipe_code_reference_month_idx" ON "fipe_prices"("fipe_code", "reference_month");

-- CreateIndex
CREATE INDEX "fipe_prices_vehicle_type_brand_code_model_code_model_year_f_idx" ON "fipe_prices"("vehicle_type", "brand_code", "model_code", "model_year", "fuel_code", "reference_month");

-- CreateIndex
CREATE UNIQUE INDEX "fipe_prices_reference_table_vehicle_type_brand_code_model_c_key" ON "fipe_prices"("reference_table", "vehicle_type", "brand_code", "model_code", "model_year", "fuel_code");

-- CreateIndex
CREATE UNIQUE INDEX "fipe_matches_vehicle_key_key" ON "fipe_matches"("vehicle_key");

-- CreateIndex
CREATE INDEX "fipe_matches_origin_matcher_version_idx" ON "fipe_matches"("origin", "matcher_version");

-- CreateIndex
CREATE INDEX "listings_fipe_match_id_idx" ON "listings"("fipe_match_id");

-- AddForeignKey
ALTER TABLE "listings" ADD CONSTRAINT "listings_fipe_match_id_fkey" FOREIGN KEY ("fipe_match_id") REFERENCES "fipe_matches"("id") ON DELETE SET NULL ON UPDATE CASCADE;


ALTER TABLE "fipe_prices"
  ADD CONSTRAINT "fipe_prices_reference_month_first_day" CHECK (EXTRACT(DAY FROM "reference_month") = 1),
  ADD CONSTRAINT "fipe_prices_vehicle_type" CHECK ("vehicle_type" BETWEEN 1 AND 3),
  ADD CONSTRAINT "fipe_prices_fuel_code" CHECK ("fuel_code" BETWEEN 1 AND 6),
  ADD CONSTRAINT "fipe_prices_model_year" CHECK ("model_year" BETWEEN 1900 AND 2100),
  ADD CONSTRAINT "fipe_prices_value_positive" CHECK ("value_cents" > 0),
  ADD CONSTRAINT "fipe_prices_codes_not_blank" CHECK (
    btrim("brand_code") <> '' AND btrim("model_code") <> '' AND btrim("fipe_code") <> ''
  );

ALTER TABLE "fipe_matches"
  ADD CONSTRAINT "fipe_matches_vehicle_key_not_blank" CHECK (btrim("vehicle_key") <> ''),
  ADD CONSTRAINT "fipe_matches_models_array" CHECK (jsonb_typeof("models") = 'array'),
  -- Versão: uma; família: duas ou mais; nenhuma: zero, com o motivo.
  ADD CONSTRAINT "fipe_matches_kind_models" CHECK (
    ("kind" = 'version' AND jsonb_array_length("models") = 1)
    OR ("kind" = 'family' AND jsonb_array_length("models") >= 2)
    OR ("kind" = 'none' AND jsonb_array_length("models") = 0)
  ),
  ADD CONSTRAINT "fipe_matches_reason_only_none" CHECK (("kind" = 'none') = ("reason" IS NOT NULL)),
  ADD CONSTRAINT "fipe_matches_vehicle_type" CHECK ("vehicle_type" IS NULL OR "vehicle_type" BETWEEN 1 AND 3),
  ADD CONSTRAINT "fipe_matches_brand_with_type" CHECK (("vehicle_type" IS NULL) = ("brand_code" IS NULL)),
  ADD CONSTRAINT "fipe_matches_chosen_has_brand" CHECK ("kind" = 'none' OR "brand_code" IS NOT NULL);

-- Global e só do servidor, como o catálogo (D-14, D-25).
ALTER TABLE "fipe_prices" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "fipe_prices" FROM anon, authenticated;
ALTER TABLE "fipe_matches" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "fipe_matches" FROM anon, authenticated;

-- Contrair D-47: o coletor anterior ao valor casado gravava o valor da fonte sem origem até o deploy.
UPDATE "listings" SET "market_value_origin" = 'source'
  WHERE "market_value_cents" IS NOT NULL AND "market_value_origin" IS NULL;
UPDATE "listings" SET "market_value_origin" = NULL, "market_value_fipe_code" = NULL, "market_value_ref_month" = NULL
  WHERE "market_value_cents" IS NULL AND "market_value_origin" IS NOT NULL;
ALTER TABLE "listings"
  ADD CONSTRAINT "listings_market_value_origin_iff_value" CHECK (
    ("market_value_cents" IS NULL) = ("market_value_origin" IS NULL)
  );
