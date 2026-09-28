-- Monitores e alertas (docs/PLANO-COLETA.md, etapa 2). Critérios: src/domain/listings/criteria.ts.
-- Alertas são criados pelo coletor (D-32), um por par monitor × anúncio.

-- AlterTable
ALTER TABLE "collector_runs" ADD COLUMN     "alerts_created" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "watches" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "name" TEXT,
    "search" TEXT,
    "year_from" SMALLINT,
    "year_to" SMALLINT,
    "max_price_cents" INTEGER,
    "radius_km" SMALLINT,
    "category" VARCHAR(20) NOT NULL,
    "condition" VARCHAR(20) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "alerts_from" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "watches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alerts" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "watch_id" UUID NOT NULL,
    "listing_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "read_at" TIMESTAMPTZ(3),

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "watches_owner_id_created_at_idx" ON "watches"("owner_id", "created_at");

-- CreateIndex
CREATE INDEX "watches_active_idx" ON "watches"("active");

-- CreateIndex
CREATE UNIQUE INDEX "watches_id_owner_id_key" ON "watches"("id", "owner_id");

-- CreateIndex
CREATE INDEX "alerts_owner_id_read_at_created_at_idx" ON "alerts"("owner_id", "read_at", "created_at");

-- CreateIndex
CREATE INDEX "alerts_listing_id_idx" ON "alerts"("listing_id");

-- CreateIndex
CREATE UNIQUE INDEX "alerts_watch_id_listing_id_key" ON "alerts"("watch_id", "listing_id");

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_watch_id_owner_id_fkey" FOREIGN KEY ("watch_id", "owner_id") REFERENCES "watches"("id", "owner_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- CHECKs: monitores (chaves e faixas iguais às de src/domain/listings/criteria.ts)
ALTER TABLE "watches"
  ADD CONSTRAINT "watches_name_not_blank" CHECK ("name" IS NULL OR btrim("name") <> ''),
  ADD CONSTRAINT "watches_search_not_blank" CHECK ("search" IS NULL OR btrim("search") <> ''),
  ADD CONSTRAINT "watches_year_from_range" CHECK ("year_from" IS NULL OR "year_from" BETWEEN 1900 AND 2100),
  ADD CONSTRAINT "watches_year_to_range" CHECK ("year_to" IS NULL OR "year_to" BETWEEN 1900 AND 2100),
  ADD CONSTRAINT "watches_year_order" CHECK ("year_from" IS NULL OR "year_to" IS NULL OR "year_from" <= "year_to"),
  ADD CONSTRAINT "watches_max_price_positive" CHECK ("max_price_cents" IS NULL OR "max_price_cents" > 0),
  ADD CONSTRAINT "watches_radius_option" CHECK ("radius_km" IS NULL OR "radius_km" IN (50, 100, 150, 300)),
  ADD CONSTRAINT "watches_category_key" CHECK (
    "category" IN ('veiculos', 'carros', 'motos', 'utilitarios', 'pesados', 'sucatas', 'todas')
  ),
  ADD CONSTRAINT "watches_condition_key" CHECK (
    "condition" IN ('qualquer', 'sem-monta', 'ate-pequena', 'ate-media', 'com-monta')
  );

ALTER TABLE "alerts"
  ADD CONSTRAINT "alerts_read_after_created" CHECK ("read_at" IS NULL OR "read_at" >= "created_at");

ALTER TABLE "collector_runs"
  ADD CONSTRAINT "collector_runs_alerts_non_negative" CHECK ("alerts_created" >= 0);

-- Segurança (D-14): só o servidor lê e grava.
ALTER TABLE "watches" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "alerts" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "watches", "alerts" FROM anon, authenticated;
