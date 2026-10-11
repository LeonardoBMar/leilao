-- CreateEnum
CREATE TYPE "vehicle_origin" AS ENUM ('financiamento', 'seguradora', 'frota', 'orgao_publico', 'outros');

-- AlterTable
ALTER TABLE "listings" ADD COLUMN     "vehicle_origin" "vehicle_origin" NOT NULL DEFAULT 'outros';
