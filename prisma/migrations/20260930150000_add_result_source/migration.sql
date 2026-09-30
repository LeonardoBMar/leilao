-- Resultado automático (docs/PLANO-COLETA.md, etapa 4; D-35): a revisão guarda quem a registrou.
-- Revisões existentes foram digitadas pelo usuário: 'manual' (padrão). Resultados continuam imutáveis (trigger).

-- CreateEnum
CREATE TYPE "result_source" AS ENUM ('manual', 'collector');

-- AlterTable
ALTER TABLE "results" ADD COLUMN     "source" "result_source" NOT NULL DEFAULT 'manual';
