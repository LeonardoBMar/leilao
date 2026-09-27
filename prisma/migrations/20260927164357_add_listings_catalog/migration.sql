-- CreateEnum
CREATE TYPE "listing_status" AS ENUM ('open', 'sold', 'conditional', 'unsold', 'withdrawn', 'unknown');

-- CreateEnum
CREATE TYPE "collector_run_status" AS ENUM ('running', 'succeeded', 'failed');

-- CreateTable
CREATE TABLE "sources" (
    "id" VARCHAR(40) NOT NULL,
    "name" TEXT NOT NULL,
    "base_url" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "municipalities" (
    "ibge_code" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "state" CHAR(2) NOT NULL,
    "name_key" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "municipalities_pkey" PRIMARY KEY ("ibge_code")
);

-- CreateTable
CREATE TABLE "listings" (
    "id" UUID NOT NULL,
    "source_id" VARCHAR(40) NOT NULL,
    "external_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "lot_number" TEXT,
    "title" TEXT NOT NULL,
    "brand" TEXT,
    "model" TEXT,
    "fipe_code" TEXT,
    "fipe_name" TEXT,
    "model_year" SMALLINT,
    "manufacture_year" SMALLINT,
    "mileage_km" INTEGER,
    "fuel" TEXT,
    "color" TEXT,
    "category" TEXT,
    "recovery_type" TEXT,
    "has_key" BOOLEAN,
    "seller_name" TEXT,
    "auction_external_id" TEXT,
    "auction_name" TEXT,
    "auction_starts_at" TIMESTAMPTZ(3),
    "starts_at" TIMESTAMPTZ(3),
    "ends_at" TIMESTAMPTZ(3),
    "yard_name" TEXT,
    "city" TEXT,
    "state" CHAR(2),
    "address" TEXT,
    "municipality_id" INTEGER,
    "status" "listing_status" NOT NULL,
    "source_status" TEXT,
    "current_bid_cents" INTEGER,
    "minimum_bid_cents" INTEGER,
    "bid_count" INTEGER,
    "final_bid_cents" INTEGER,
    "market_value_cents" INTEGER,
    "commission_bps" INTEGER,
    "dispatcher_fee_cents" INTEGER,
    "removal_fee_cents" INTEGER,
    "storage_fee_cents" INTEGER,
    "inspection_fee_cents" INTEGER,
    "other_fees_cents" INTEGER,
    "photo_urls" TEXT[],
    "raw" JSONB NOT NULL,
    "first_seen_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_checked_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "next_check_at" TIMESTAMPTZ(3),
    "check_failures" SMALLINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listing_observations" (
    "id" UUID NOT NULL,
    "listing_id" UUID NOT NULL,
    "observed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "listing_status" NOT NULL,
    "bid_cents" INTEGER,
    "bid_count" INTEGER,

    CONSTRAINT "listing_observations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collector_runs" (
    "id" UUID NOT NULL,
    "source_id" VARCHAR(40) NOT NULL,
    "status" "collector_run_status" NOT NULL DEFAULT 'running',
    "started_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMPTZ(3),
    "requests" INTEGER NOT NULL DEFAULT 0,
    "discovered" INTEGER NOT NULL DEFAULT 0,
    "created" INTEGER NOT NULL DEFAULT 0,
    "updated" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "errors" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "collector_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "municipalities_latitude_longitude_idx" ON "municipalities"("latitude", "longitude");

-- CreateIndex
CREATE UNIQUE INDEX "municipalities_name_key_state_key" ON "municipalities"("name_key", "state");

-- CreateIndex
CREATE INDEX "listings_next_check_at_idx" ON "listings"("next_check_at");

-- CreateIndex
CREATE INDEX "listings_status_ends_at_idx" ON "listings"("status", "ends_at");

-- CreateIndex
CREATE INDEX "listings_municipality_id_idx" ON "listings"("municipality_id");

-- CreateIndex
CREATE INDEX "listings_brand_model_model_year_idx" ON "listings"("brand", "model", "model_year");

-- CreateIndex
CREATE UNIQUE INDEX "listings_source_id_external_id_key" ON "listings"("source_id", "external_id");

-- CreateIndex
CREATE INDEX "listing_observations_listing_id_observed_at_idx" ON "listing_observations"("listing_id", "observed_at");

-- CreateIndex
CREATE INDEX "collector_runs_source_id_started_at_idx" ON "collector_runs"("source_id", "started_at");

-- AddForeignKey
ALTER TABLE "listings" ADD CONSTRAINT "listings_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listings" ADD CONSTRAINT "listings_municipality_id_fkey" FOREIGN KEY ("municipality_id") REFERENCES "municipalities"("ibge_code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_observations" ADD CONSTRAINT "listing_observations_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collector_runs" ADD CONSTRAINT "collector_runs_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Escrito à mão: o que o Prisma não modela (receita "Mudança de schema").
-- ---------------------------------------------------------------------------

-- CHECKs: municípios
ALTER TABLE "municipalities"
  ADD CONSTRAINT "municipalities_state_format" CHECK ("state" ~ '^[A-Z]{2}$'),
  ADD CONSTRAINT "municipalities_latitude_range" CHECK ("latitude" BETWEEN -90 AND 90),
  ADD CONSTRAINT "municipalities_longitude_range" CHECK ("longitude" BETWEEN -180 AND 180);

-- CHECKs: anúncios (dinheiro em centavos não negativos, taxa em pontos-base, D-15)
ALTER TABLE "listings"
  ADD CONSTRAINT "listings_external_id_not_blank" CHECK (btrim("external_id") <> ''),
  ADD CONSTRAINT "listings_title_not_blank" CHECK (btrim("title") <> ''),
  ADD CONSTRAINT "listings_url_http" CHECK ("url" ~* '^https?://'),
  ADD CONSTRAINT "listings_state_format" CHECK ("state" IS NULL OR "state" ~ '^[A-Z]{2}$'),
  ADD CONSTRAINT "listings_model_year_range" CHECK ("model_year" IS NULL OR "model_year" BETWEEN 1900 AND 2100),
  ADD CONSTRAINT "listings_manufacture_year_range" CHECK ("manufacture_year" IS NULL OR "manufacture_year" BETWEEN 1900 AND 2100),
  ADD CONSTRAINT "listings_mileage_non_negative" CHECK ("mileage_km" IS NULL OR "mileage_km" >= 0),
  ADD CONSTRAINT "listings_bid_count_non_negative" CHECK ("bid_count" IS NULL OR "bid_count" >= 0),
  ADD CONSTRAINT "listings_money_non_negative" CHECK (
    coalesce("current_bid_cents", 0) >= 0 AND coalesce("minimum_bid_cents", 0) >= 0
    AND coalesce("final_bid_cents", 0) >= 0 AND coalesce("market_value_cents", 0) >= 0
    AND coalesce("dispatcher_fee_cents", 0) >= 0 AND coalesce("removal_fee_cents", 0) >= 0
    AND coalesce("storage_fee_cents", 0) >= 0 AND coalesce("inspection_fee_cents", 0) >= 0
    AND coalesce("other_fees_cents", 0) >= 0
  ),
  ADD CONSTRAINT "listings_commission_bps_range" CHECK ("commission_bps" IS NULL OR "commission_bps" BETWEEN 0 AND 10000),
  -- Lance final só existe depois do encerramento.
  ADD CONSTRAINT "listings_final_bid_when_ended" CHECK ("final_bid_cents" IS NULL OR "status" <> 'open');

ALTER TABLE "listing_observations"
  ADD CONSTRAINT "listing_observations_bid_non_negative" CHECK (coalesce("bid_cents", 0) >= 0 AND coalesce("bid_count", 0) >= 0);

ALTER TABLE "collector_runs"
  ADD CONSTRAINT "collector_runs_counters_non_negative" CHECK (
    "requests" >= 0 AND "discovered" >= 0 AND "created" >= 0 AND "updated" >= 0 AND "failed" >= 0
  ),
  ADD CONSTRAINT "collector_runs_finished_after_start" CHECK ("finished_at" IS NULL OR "finished_at" >= "started_at");

-- D-14: Data API do Supabase fechada também para o catálogo. Só o servidor lê e grava.
ALTER TABLE "sources" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "municipalities" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "listings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "listing_observations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "collector_runs" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "sources", "municipalities", "listings", "listing_observations", "collector_runs" FROM anon, authenticated;

-- Primeira fonte (docs/PLANO-COLETA.md §2).
INSERT INTO "sources" ("id", "name", "base_url") VALUES ('leilo', 'Leilo', 'https://leilo.com.br');
