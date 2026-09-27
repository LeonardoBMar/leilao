-- Condição declarada pelo leiloeiro (src/domain/listings/condition.ts): classificação de dano, marcações e laudo cautelar.
-- Anúncios já coletados: preencher com `npm run db:backfill-condition` (relê o dado bruto guardado em "raw").

-- CreateEnum
CREATE TYPE "damage_level" AS ENUM ('small', 'medium', 'large', 'salvage');

-- CreateEnum
CREATE TYPE "condition_flag" AS ENUM ('circulation_banned', 'remarked', 'theft_history', 'prior_claim', 'airbag_deployed', 'missing_parts', 'recall_pending', 'cng');

-- CreateEnum
CREATE TYPE "inspection_result" AS ENUM ('approved', 'approved_with_notes', 'rejected');

-- AlterTable
ALTER TABLE "listings" ADD COLUMN     "condition_flags" "condition_flag"[] DEFAULT ARRAY[]::"condition_flag"[],
ADD COLUMN     "damage_level" "damage_level",
ADD COLUMN     "description" TEXT,
ADD COLUMN     "inspection_notes" TEXT,
ADD COLUMN     "inspection_result" "inspection_result";

