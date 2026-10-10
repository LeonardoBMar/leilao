-- D-51: o catálogo da FIPE passa a vir do dataset mensal fipeX, e não da API (que recusa o GitHub Actions com 403).
-- O preço é identificado por mês + código FIPE + ano + combustível; a marca e a versão passam a ser identificadas pelo
-- nome da marca e pelo código FIPE (o dataset não traz os códigos internos da API). As linhas atuais vieram da API e
-- são as mesmas do dataset (914 de 914 conferidas em 10/10/2026): saem e voltam na importação.

DELETE FROM "fipe_prices";

ALTER TABLE "fipe_prices"
  DROP CONSTRAINT "fipe_prices_codes_not_blank",
  DROP CONSTRAINT "fipe_prices_fuel_code";

-- DropIndex
DROP INDEX "fipe_prices_fipe_code_reference_month_idx";

-- DropIndex
DROP INDEX "fipe_prices_reference_table_vehicle_type_brand_code_model_c_key";

-- DropIndex
DROP INDEX "fipe_prices_vehicle_type_brand_code_model_code_model_year_f_idx";

-- AlterTable
ALTER TABLE "fipe_prices" DROP CONSTRAINT "fipe_prices_pkey",
DROP COLUMN "brand_code",
DROP COLUMN "fetched_at",
DROP COLUMN "id",
DROP COLUMN "model_code",
DROP COLUMN "reference_table",
ADD COLUMN     "imported_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD CONSTRAINT "fipe_prices_pkey" PRIMARY KEY ("reference_month", "fipe_code", "model_year", "fuel_code");

-- CreateIndex
CREATE INDEX "fipe_prices_reference_month_vehicle_type_brand_name_model_y_idx" ON "fipe_prices"("reference_month", "vehicle_type", "brand_name", "model_year", "fuel_code");

-- 7 = gás natural (sigla "n" no dataset).
ALTER TABLE "fipe_prices"
  ADD CONSTRAINT "fipe_prices_fuel_code" CHECK ("fuel_code" BETWEEN 1 AND 7),
  ADD CONSTRAINT "fipe_prices_names_not_blank" CHECK (
    btrim("brand_name") <> '' AND btrim("model_name") <> '' AND btrim("fipe_code") <> ''
  );

-- As correlações automáticas guardam os códigos da API; são refeitas sobre o catálogo novo (MATCHER_VERSION 2).
