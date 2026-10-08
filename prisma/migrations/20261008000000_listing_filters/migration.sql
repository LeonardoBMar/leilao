-- Filtros dos Leilões e de Minhas análises (D-43, docs/PLANO-FILTROS.md).

-- Preço e % do mercado gerados pelo banco: filtram e ordenam sem depender do coletor.
-- Mesmas regras de `priceOf` e `marketRatioBps` (src/domain/listings/criteria.ts).
ALTER TABLE "listings"
  ADD COLUMN "price_cents" INTEGER GENERATED ALWAYS AS (COALESCE("current_bid_cents", "minimum_bid_cents")) STORED,
  ADD COLUMN "market_ratio_bps" INTEGER GENERATED ALWAYS AS (
    CASE
      WHEN "market_value_cents" > 0 AND COALESCE("current_bid_cents", "minimum_bid_cents") IS NOT NULL
        THEN ROUND(COALESCE("current_bid_cents", "minimum_bid_cents") * 10000.0 / "market_value_cents")::INTEGER
    END
  ) STORED;

-- Monitores com os mesmos critérios da tela. Expandir: `category` fica, nula e sem uso, até o release seguinte.
ALTER TABLE "watches"
  ADD COLUMN "min_price_cents" INTEGER,
  ADD COLUMN "max_market_pct" SMALLINT,
  ADD COLUMN "max_mileage_km" INTEGER,
  ADD COLUMN "categories" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "hide" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "sources" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "origins" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "fuels" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "key_only" BOOLEAN NOT NULL DEFAULT false,
  ALTER COLUMN "category" DROP NOT NULL;

-- Grupo antigo → categorias. "todas" vira vazio (todas as categorias).
UPDATE "watches" SET "categories" = CASE "category"
  WHEN 'veiculos' THEN ARRAY['carros', 'motos', 'utilitarios']
  WHEN 'todas' THEN ARRAY[]::TEXT[]
  ELSE ARRAY["category"]
END;

-- CHECKs: chaves e faixas iguais às de src/domain/listings/criteria.ts
ALTER TABLE "watches"
  ADD CONSTRAINT "watches_min_price_positive" CHECK ("min_price_cents" IS NULL OR "min_price_cents" > 0),
  ADD CONSTRAINT "watches_price_order" CHECK (
    "min_price_cents" IS NULL OR "max_price_cents" IS NULL OR "min_price_cents" <= "max_price_cents"
  ),
  ADD CONSTRAINT "watches_max_market_pct_option" CHECK ("max_market_pct" IS NULL OR "max_market_pct" IN (40, 50, 60, 70, 80)),
  ADD CONSTRAINT "watches_max_mileage_option" CHECK (
    "max_mileage_km" IS NULL OR "max_mileage_km" IN (50000, 100000, 150000)
  ),
  ADD CONSTRAINT "watches_categories_keys" CHECK (
    "categories" <@ ARRAY['carros', 'motos', 'utilitarios', 'pesados', 'sucatas', 'outros']
  ),
  ADD CONSTRAINT "watches_hide_keys" CHECK ("hide" <@ ARRAY['impedido', 'remarcado', 'airbag', 'laudo-reprovado']),
  ADD CONSTRAINT "watches_origins_keys" CHECK ("origins" <@ ARRAY['financiamento', 'seguradora', 'frota', 'outros']),
  ADD CONSTRAINT "watches_fuels_keys" CHECK ("fuels" <@ ARRAY['flex', 'gasolina', 'diesel', 'eletrico']);
