-- CreateEnum
CREATE TYPE "auction_origin" AS ENUM ('detran', 'insurer', 'financial', 'judicial', 'other', 'unknown');

-- CreateEnum
CREATE TYPE "auction_status" AS ENUM ('scheduled', 'in_progress', 'finished', 'cancelled');

-- CreateEnum
CREATE TYPE "analysis_status" AS ENUM ('draft', 'fixed');

-- CreateEnum
CREATE TYPE "commission_mode" AS ENUM ('fixed', 'percentage');

-- CreateEnum
CREATE TYPE "lot_outcome" AS ENUM ('sold', 'unsold', 'withdrawn', 'cancelled', 'unknown');

-- CreateEnum
CREATE TYPE "personal_outcome" AS ENUM ('observed', 'bid_not_won', 'won');

-- CreateEnum
CREATE TYPE "analysis_timing" AS ENUM ('prior', 'retrospective', 'unknown');

-- CreateTable
CREATE TABLE "auctions" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "auctioneer" TEXT NOT NULL,
    "origin" "auction_origin" NOT NULL,
    "status" "auction_status" NOT NULL DEFAULT 'scheduled',
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "city" TEXT,
    "state" CHAR(2),
    "notice_url" TEXT,
    "platform_url" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "archived_at" TIMESTAMPTZ(3),

    CONSTRAINT "auctions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lots" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "auction_id" UUID NOT NULL,
    "lot_number" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "vehicle_version" TEXT,
    "model_year" SMALLINT NOT NULL,
    "manufacture_year" SMALLINT,
    "mileage_km" INTEGER,
    "is_followed" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "starting_bid_cents" INTEGER,
    "current_bid_cents" INTEGER,
    "current_bid_observed_at" TIMESTAMPTZ(3),
    "lot_url" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "archived_at" TIMESTAMPTZ(3),

    CONSTRAINT "lots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analyses" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "lot_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "analysis_status" NOT NULL DEFAULT 'draft',
    "market_value_cents" INTEGER,
    "market_reference_date" DATE,
    "market_reference_source" TEXT,
    "fipe_value_cents" INTEGER,
    "fipe_reference_month" DATE,
    "fipe_reference_source" TEXT,
    "repair_cost_cents" INTEGER,
    "documentation_cost_cents" INTEGER,
    "transport_cost_cents" INTEGER,
    "tires_cost_cents" INTEGER,
    "service_cost_cents" INTEGER,
    "other_fees_cents" INTEGER,
    "commission_mode" "commission_mode",
    "commission_fixed_cents" INTEGER,
    "commission_rate_bps" INTEGER,
    "risk_reserve_cents" INTEGER,
    "desired_margin_cents" INTEGER,
    "notes" TEXT,
    "max_bid_cents" INTEGER,
    "is_viable" BOOLEAN,
    "total_at_max_bid_cents" INTEGER,
    "margin_at_max_bid_cents" INTEGER,
    "formula_version" INTEGER,
    "known_result_at_creation" BOOLEAN NOT NULL DEFAULT false,
    "fixed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "results" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "lot_id" UUID NOT NULL,
    "revision" INTEGER NOT NULL,
    "supersedes_result_id" UUID,
    "outcome" "lot_outcome" NOT NULL,
    "final_bid_cents" INTEGER,
    "event_at" TIMESTAMPTZ(3),
    "source_url" TEXT,
    "source_notes" TEXT,
    "personal_outcome" "personal_outcome" NOT NULL DEFAULT 'observed',
    "decision_reason" TEXT,
    "notes" TEXT,
    "analysis_id" UUID,
    "analysis_timing" "analysis_timing" NOT NULL DEFAULT 'unknown',
    "recorded_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "correction_reason" TEXT,

    CONSTRAINT "results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lot_images" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "lot_id" UUID NOT NULL,
    "storage_path" TEXT NOT NULL,
    "original_filename" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_cover" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lot_images_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "auctions_owner_id_starts_at_idx" ON "auctions"("owner_id", "starts_at");

-- CreateIndex
CREATE UNIQUE INDEX "auctions_id_owner_id_key" ON "auctions"("id", "owner_id");

-- CreateIndex
CREATE INDEX "lots_owner_id_is_followed_idx" ON "lots"("owner_id", "is_followed");

-- CreateIndex
CREATE UNIQUE INDEX "lots_id_owner_id_key" ON "lots"("id", "owner_id");

-- CreateIndex
CREATE UNIQUE INDEX "lots_auction_id_lot_number_key" ON "lots"("auction_id", "lot_number");

-- CreateIndex
CREATE UNIQUE INDEX "analyses_id_lot_id_key" ON "analyses"("id", "lot_id");

-- CreateIndex
CREATE UNIQUE INDEX "analyses_lot_id_version_key" ON "analyses"("lot_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "analyses_one_draft_per_lot" ON "analyses"("lot_id") WHERE ("status" = 'draft');

-- CreateIndex
CREATE UNIQUE INDEX "results_id_lot_id_key" ON "results"("id", "lot_id");

-- CreateIndex
CREATE UNIQUE INDEX "results_lot_id_revision_key" ON "results"("lot_id", "revision");

-- CreateIndex
CREATE UNIQUE INDEX "results_supersedes_result_id_lot_id_key" ON "results"("supersedes_result_id", "lot_id");

-- CreateIndex
CREATE UNIQUE INDEX "lot_images_storage_path_key" ON "lot_images"("storage_path");

-- CreateIndex
CREATE INDEX "lot_images_lot_id_sort_order_idx" ON "lot_images"("lot_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "lot_images_one_cover_per_lot" ON "lot_images"("lot_id") WHERE ("is_cover" = true);

-- AddForeignKey
ALTER TABLE "lots" ADD CONSTRAINT "lots_auction_id_owner_id_fkey" FOREIGN KEY ("auction_id", "owner_id") REFERENCES "auctions"("id", "owner_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analyses" ADD CONSTRAINT "analyses_lot_id_owner_id_fkey" FOREIGN KEY ("lot_id", "owner_id") REFERENCES "lots"("id", "owner_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "results" ADD CONSTRAINT "results_lot_id_owner_id_fkey" FOREIGN KEY ("lot_id", "owner_id") REFERENCES "lots"("id", "owner_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "results" ADD CONSTRAINT "results_analysis_id_lot_id_fkey" FOREIGN KEY ("analysis_id", "lot_id") REFERENCES "analyses"("id", "lot_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "results" ADD CONSTRAINT "results_supersedes_result_id_lot_id_fkey" FOREIGN KEY ("supersedes_result_id", "lot_id") REFERENCES "results"("id", "lot_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lot_images" ADD CONSTRAINT "lot_images_lot_id_owner_id_fkey" FOREIGN KEY ("lot_id", "owner_id") REFERENCES "lots"("id", "owner_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex (FK results.analysis_id)
CREATE INDEX "results_analysis_id_idx" ON "results"("analysis_id");

-- =====================================================================
-- Regras que o Prisma não modela. Mantidas à mão; veja docs/ARCHITECTURE.md §12.
-- =====================================================================

-- CHECKs: auctions (RF-01)
ALTER TABLE "auctions"
  ADD CONSTRAINT "auctions_name_not_blank" CHECK (btrim("name") <> ''),
  ADD CONSTRAINT "auctions_auctioneer_not_blank" CHECK (btrim("auctioneer") <> ''),
  ADD CONSTRAINT "auctions_state_format" CHECK ("state" IS NULL OR "state" ~ '^[A-Z]{2}$'),
  ADD CONSTRAINT "auctions_notice_url_http" CHECK ("notice_url" IS NULL OR "notice_url" ~* '^https?://'),
  ADD CONSTRAINT "auctions_platform_url_http" CHECK ("platform_url" IS NULL OR "platform_url" ~* '^https?://');

-- CHECKs: lots (RF-02, §7.6)
ALTER TABLE "lots"
  ADD CONSTRAINT "lots_lot_number_trimmed" CHECK ("lot_number" = btrim("lot_number") AND "lot_number" <> ''),
  ADD CONSTRAINT "lots_brand_not_blank" CHECK (btrim("brand") <> ''),
  ADD CONSTRAINT "lots_model_not_blank" CHECK (btrim("model") <> ''),
  ADD CONSTRAINT "lots_model_year_range" CHECK ("model_year" BETWEEN 1900 AND 2100),
  ADD CONSTRAINT "lots_manufacture_year_range" CHECK (
    "manufacture_year" IS NULL OR ("manufacture_year" BETWEEN 1900 AND 2100 AND "manufacture_year" <= "model_year")
  ),
  ADD CONSTRAINT "lots_mileage_non_negative" CHECK ("mileage_km" IS NULL OR "mileage_km" >= 0),
  ADD CONSTRAINT "lots_starting_bid_positive" CHECK ("starting_bid_cents" IS NULL OR "starting_bid_cents" > 0),
  ADD CONSTRAINT "lots_current_bid_positive" CHECK ("current_bid_cents" IS NULL OR "current_bid_cents" > 0),
  ADD CONSTRAINT "lots_lot_url_http" CHECK ("lot_url" IS NULL OR "lot_url" ~* '^https?://');

-- CHECKs: analyses (RF-04, RF-05, §7.6)
ALTER TABLE "analyses"
  ADD CONSTRAINT "analyses_version_positive" CHECK ("version" >= 1),
  ADD CONSTRAINT "analyses_money_non_negative" CHECK (
    coalesce("market_value_cents", 0) >= 0 AND coalesce("fipe_value_cents", 0) >= 0
    AND coalesce("repair_cost_cents", 0) >= 0 AND coalesce("documentation_cost_cents", 0) >= 0
    AND coalesce("transport_cost_cents", 0) >= 0 AND coalesce("tires_cost_cents", 0) >= 0
    AND coalesce("service_cost_cents", 0) >= 0 AND coalesce("other_fees_cents", 0) >= 0
    AND coalesce("commission_fixed_cents", 0) >= 0
    AND coalesce("risk_reserve_cents", 0) >= 0 AND coalesce("desired_margin_cents", 0) >= 0
  ),
  ADD CONSTRAINT "analyses_rate_bps_range" CHECK ("commission_rate_bps" IS NULL OR "commission_rate_bps" BETWEEN 0 AND 10000),
  -- Só a modalidade escolhida guarda valor.
  ADD CONSTRAINT "analyses_commission_mode_consistent" CHECK (
    ("commission_mode" IS DISTINCT FROM 'fixed' OR "commission_rate_bps" IS NULL)
    AND ("commission_mode" IS DISTINCT FROM 'percentage' OR "commission_fixed_cents" IS NULL)
  ),
  -- Rascunho não tem data de fixação; análise fixada tem todas as entradas e saídas (§7.6).
  ADD CONSTRAINT "analyses_fixed_complete" CHECK (
    ("status" = 'draft' AND "fixed_at" IS NULL)
    OR (
      "status" = 'fixed' AND "fixed_at" IS NOT NULL
      AND "market_value_cents" > 0
      AND "repair_cost_cents" IS NOT NULL AND "documentation_cost_cents" IS NOT NULL
      AND "transport_cost_cents" IS NOT NULL AND "tires_cost_cents" IS NOT NULL
      AND "service_cost_cents" IS NOT NULL AND "other_fees_cents" IS NOT NULL
      AND "risk_reserve_cents" IS NOT NULL AND "desired_margin_cents" IS NOT NULL
      AND (
        ("commission_mode" = 'fixed' AND "commission_fixed_cents" IS NOT NULL)
        OR ("commission_mode" = 'percentage' AND "commission_rate_bps" IS NOT NULL)
      )
      AND "is_viable" IS NOT NULL AND "formula_version" IS NOT NULL
      AND (
        ("is_viable" AND "max_bid_cents" > 0 AND "total_at_max_bid_cents" IS NOT NULL AND "margin_at_max_bid_cents" IS NOT NULL)
        OR (NOT "is_viable" AND "max_bid_cents" IS NULL AND "total_at_max_bid_cents" IS NULL AND "margin_at_max_bid_cents" IS NULL)
      )
    )
  );

-- CHECKs: results (RF-06)
ALTER TABLE "results"
  ADD CONSTRAINT "results_revision_positive" CHECK ("revision" >= 1),
  ADD CONSTRAINT "results_final_bid_only_when_sold" CHECK (
    "final_bid_cents" IS NULL OR ("outcome" = 'sold' AND "final_bid_cents" > 0)
  ),
  ADD CONSTRAINT "results_won_requires_sold_price" CHECK (
    "personal_outcome" <> 'won' OR ("outcome" = 'sold' AND "final_bid_cents" IS NOT NULL)
  ),
  -- A primeira revisão não corrige nada; as seguintes apontam a anterior e dizem o motivo.
  ADD CONSTRAINT "results_correction_chain" CHECK (
    ("revision" = 1 AND "supersedes_result_id" IS NULL)
    OR ("revision" > 1 AND "supersedes_result_id" IS NOT NULL AND btrim(coalesce("correction_reason", '')) <> '')
  ),
  ADD CONSTRAINT "results_source_url_http" CHECK ("source_url" IS NULL OR "source_url" ~* '^https?://');

-- CHECKs: lot_images (RF-07)
ALTER TABLE "lot_images"
  ADD CONSTRAINT "lot_images_mime_type_allowed" CHECK ("mime_type" IN ('image/jpeg', 'image/png', 'image/webp')),
  ADD CONSTRAINT "lot_images_size_limit" CHECK ("size_bytes" BETWEEN 1 AND 5242880),
  ADD CONSTRAINT "lot_images_sort_order_non_negative" CHECK ("sort_order" >= 0);

-- Imutabilidade (RF-05): análise fixada não é alterada nem removida.
CREATE FUNCTION "prevent_fixed_analysis_change"() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF OLD."status" = 'fixed' THEN
    RAISE EXCEPTION 'Análise fixada % não pode ser alterada ou removida', OLD."id"
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

CREATE TRIGGER "analyses_fixed_immutable"
  BEFORE UPDATE OR DELETE ON "analyses"
  FOR EACH ROW EXECUTE FUNCTION "prevent_fixed_analysis_change"();

-- Imutabilidade (RF-06): revisões de resultado só são inseridas; correção = nova revisão.
CREATE FUNCTION "prevent_result_change"() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  RAISE EXCEPTION 'Revisão de resultado % é imutável; registre uma nova revisão', OLD."id"
    USING ERRCODE = 'integrity_constraint_violation';
END;
$$;

CREATE TRIGGER "results_immutable"
  BEFORE UPDATE OR DELETE ON "results"
  FOR EACH ROW EXECUTE FUNCTION "prevent_result_change"();

REVOKE EXECUTE ON FUNCTION "prevent_fixed_analysis_change"(), "prevent_result_change"() FROM PUBLIC, anon, authenticated;

-- D-14: Data API do Supabase fechada. Acesso aos dados só pelo servidor (Prisma como postgres, que ignora RLS).
ALTER TABLE "auctions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "lots" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "analyses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "results" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "lot_images" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "auctions", "lots", "analyses", "results", "lot_images" FROM anon, authenticated;

-- A tabela de controle do Prisma também fica no schema public.
DO $$
BEGIN
  IF to_regclass('public._prisma_migrations') IS NOT NULL THEN
    ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;
    REVOKE ALL ON TABLE "_prisma_migrations" FROM anon, authenticated;
  END IF;
END;
$$;
