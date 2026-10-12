-- Chave do veículo gravada (D-77). Fica nula até a coleta visitar o anúncio ou `npm run db:vehicle-keys` rodar.

-- AlterTable
ALTER TABLE "listings" ADD COLUMN     "vehicle_key" TEXT;

-- CreateIndex
CREATE INDEX "listings_vehicle_key_status_ends_at_idx" ON "listings"("vehicle_key", "status", "ends_at");
