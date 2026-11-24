-- CreateTable
CREATE TABLE "user_preferences" (
    "owner_id" UUID NOT NULL,
    "municipality_ibge_code" INTEGER,
    "radius_km" INTEGER,
    "desired_margin_rate_bps" INTEGER,
    "risk_reserve_rate_bps" INTEGER,
    "documentation_cost" INTEGER,
    "tow_base" INTEGER,
    "tow_per_km" INTEGER,
    "tow_unknown_distance" INTEGER,
    "sale_discount_none_bps" INTEGER,
    "sale_discount_small_bps" INTEGER,
    "sale_discount_medium_bps" INTEGER,
    "sale_discount_large_bps" INTEGER,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("owner_id"),
    CONSTRAINT "user_preferences_radius_km_check" CHECK ("radius_km" IS NULL OR ("radius_km" >= 10 AND "radius_km" <= 5000)),
    CONSTRAINT "user_preferences_desired_margin_rate_bps_check" CHECK ("desired_margin_rate_bps" IS NULL OR ("desired_margin_rate_bps" >= 0 AND "desired_margin_rate_bps" <= 9000)),
    CONSTRAINT "user_preferences_risk_reserve_rate_bps_check" CHECK ("risk_reserve_rate_bps" IS NULL OR ("risk_reserve_rate_bps" >= 0 AND "risk_reserve_rate_bps" <= 5000)),
    CONSTRAINT "user_preferences_documentation_cost_check" CHECK ("documentation_cost" IS NULL OR "documentation_cost" >= 0),
    CONSTRAINT "user_preferences_tow_base_check" CHECK ("tow_base" IS NULL OR "tow_base" >= 0),
    CONSTRAINT "user_preferences_tow_per_km_check" CHECK ("tow_per_km" IS NULL OR "tow_per_km" >= 0),
    CONSTRAINT "user_preferences_tow_unknown_distance_check" CHECK ("tow_unknown_distance" IS NULL OR "tow_unknown_distance" >= 0),
    CONSTRAINT "user_preferences_sale_discount_none_bps_check" CHECK ("sale_discount_none_bps" IS NULL OR ("sale_discount_none_bps" >= 0 AND "sale_discount_none_bps" <= 9000)),
    CONSTRAINT "user_preferences_sale_discount_small_bps_check" CHECK ("sale_discount_small_bps" IS NULL OR ("sale_discount_small_bps" >= 0 AND "sale_discount_small_bps" <= 9000)),
    CONSTRAINT "user_preferences_sale_discount_medium_bps_check" CHECK ("sale_discount_medium_bps" IS NULL OR ("sale_discount_medium_bps" >= 0 AND "sale_discount_medium_bps" <= 9000)),
    CONSTRAINT "user_preferences_sale_discount_large_bps_check" CHECK ("sale_discount_large_bps" IS NULL OR ("sale_discount_large_bps" >= 0 AND "sale_discount_large_bps" <= 9000))
);

-- AddForeignKey
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_municipality_ibge_code_fkey" FOREIGN KEY ("municipality_ibge_code") REFERENCES "municipalities"("ibge_code") ON DELETE SET NULL ON UPDATE CASCADE;

-- Segurança (D-14): só o servidor lê e grava.
ALTER TABLE "user_preferences" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "user_preferences" FROM anon, authenticated;
