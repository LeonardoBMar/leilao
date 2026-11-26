-- Onda 1 (D-96): Fórmula financeira v3 (débitos, custos de comercialização, impostos e giro esperado),
-- perfil operacional nas preferências do usuário e gestão pós-arremate (`lot_post_auctions`, `lot_expenses`).
-- Análises fixadas anteriores (`formula_version < 3`) permanecem intactas e imutáveis.

-- CreateEnum
CREATE TYPE "buyer_profile" AS ENUM ('reseller', 'personal', 'advisor');

-- CreateEnum
CREATE TYPE "post_auction_status" AS ENUM ('acquired', 'in_transit', 'in_repair', 'ready_for_sale', 'listed', 'sold');

-- CreateEnum
CREATE TYPE "expense_category" AS ENUM ('auction_commission', 'auction_fees', 'debts', 'transport', 'documentation', 'repair', 'tires', 'service', 'selling', 'tax', 'other');

-- AlterTable: analyses (novas colunas anuláveis; zero alteração em linhas fixadas antigas)
ALTER TABLE "analyses"
  ADD COLUMN "debts_cost_cents" INTEGER,
  ADD COLUMN "selling_cost_cents" INTEGER,
  ADD COLUMN "tax_cost_cents" INTEGER,
  ADD COLUMN "expected_hold_days" SMALLINT;

ALTER TABLE "analyses" DROP CONSTRAINT "analyses_money_non_negative";
ALTER TABLE "analyses"
  ADD CONSTRAINT "analyses_money_non_negative" CHECK (
    coalesce("market_value_cents", 0) >= 0 AND coalesce("fipe_value_cents", 0) >= 0
    AND coalesce("repair_cost_cents", 0) >= 0 AND coalesce("documentation_cost_cents", 0) >= 0
    AND coalesce("transport_cost_cents", 0) >= 0 AND coalesce("tires_cost_cents", 0) >= 0
    AND coalesce("service_cost_cents", 0) >= 0 AND coalesce("other_fees_cents", 0) >= 0
    AND coalesce("debts_cost_cents", 0) >= 0 AND coalesce("selling_cost_cents", 0) >= 0
    AND coalesce("tax_cost_cents", 0) >= 0
    AND coalesce("commission_fixed_cents", 0) >= 0
    AND coalesce("risk_reserve_cents", 0) >= 0 AND coalesce("desired_margin_cents", 0) >= 0
  ),
  ADD CONSTRAINT "analyses_expected_hold_days_range" CHECK (
    "expected_hold_days" IS NULL OR "expected_hold_days" BETWEEN 1 AND 3650
  );

ALTER TABLE "analyses" DROP CONSTRAINT "analyses_fixed_complete";
ALTER TABLE "analyses"
  ADD CONSTRAINT "analyses_fixed_complete" CHECK (
    ("status" = 'draft' AND "fixed_at" IS NULL)
    OR (
      "status" = 'fixed' AND "fixed_at" IS NOT NULL
      AND "market_value_cents" > 0
      AND "repair_cost_cents" IS NOT NULL AND "documentation_cost_cents" IS NOT NULL
      AND "transport_cost_cents" IS NOT NULL AND "tires_cost_cents" IS NOT NULL
      AND "service_cost_cents" IS NOT NULL AND "other_fees_cents" IS NOT NULL
      AND (
        "formula_version" < 3
        OR ("debts_cost_cents" IS NOT NULL AND "selling_cost_cents" IS NOT NULL AND "tax_cost_cents" IS NOT NULL)
      )
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

-- AlterTable: user_preferences
ALTER TABLE "user_preferences" ADD COLUMN "buyer_profile" "buyer_profile";

-- CreateTable: lot_post_auctions
CREATE TABLE "lot_post_auctions" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "lot_id" UUID NOT NULL,
    "status" "post_auction_status" NOT NULL DEFAULT 'acquired',
    "payment_due_at" DATE,
    "paid_at" DATE,
    "picked_up_at" DATE,
    "doc_received_at" DATE,
    "listed_at" DATE,
    "sold_at" DATE,
    "sale_price_cents" INTEGER,
    "private_plate" VARCHAR(10),
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "lot_post_auctions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "lot_post_auctions_sale_price_positive" CHECK ("sale_price_cents" IS NULL OR "sale_price_cents" > 0),
    CONSTRAINT "lot_post_auctions_sold_requires_price_and_date" CHECK (
      "status" <> 'sold' OR ("sale_price_cents" IS NOT NULL AND "sold_at" IS NOT NULL)
    ),
    CONSTRAINT "lot_post_auctions_private_plate_not_blank" CHECK (
      "private_plate" IS NULL OR btrim("private_plate") <> ''
    )
);

-- CreateTable: lot_expenses
CREATE TABLE "lot_expenses" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "lot_id" UUID NOT NULL,
    "category" "expense_category" NOT NULL,
    "description" TEXT NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "incurred_at" DATE NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "lot_expenses_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "lot_expenses_amount_positive" CHECK ("amount_cents" > 0),
    CONSTRAINT "lot_expenses_description_not_blank" CHECK (btrim("description") <> '')
);

-- CreateIndex
CREATE UNIQUE INDEX "lot_post_auctions_lot_id_key" ON "lot_post_auctions"("lot_id");
CREATE UNIQUE INDEX "lot_post_auctions_lot_id_owner_id_key" ON "lot_post_auctions"("lot_id", "owner_id");
CREATE INDEX "lot_post_auctions_owner_id_status_idx" ON "lot_post_auctions"("owner_id", "status");

CREATE INDEX "lot_expenses_owner_id_lot_id_incurred_at_idx" ON "lot_expenses"("owner_id", "lot_id", "incurred_at");
CREATE INDEX "lot_expenses_lot_id_category_idx" ON "lot_expenses"("lot_id", "category");

-- AddForeignKey
ALTER TABLE "lot_post_auctions" ADD CONSTRAINT "lot_post_auctions_lot_id_owner_id_fkey" FOREIGN KEY ("lot_id", "owner_id") REFERENCES "lots"("id", "owner_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lot_expenses" ADD CONSTRAINT "lot_expenses_lot_id_owner_id_fkey" FOREIGN KEY ("lot_id", "owner_id") REFERENCES "lots"("id", "owner_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Segurança (D-14): Data API do Supabase fechada; acesso somente pelo servidor.
ALTER TABLE "lot_post_auctions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "lot_expenses" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "lot_post_auctions", "lot_expenses" FROM anon, authenticated;
