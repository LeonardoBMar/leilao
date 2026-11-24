-- Extensão nativa para busca por substring/trigramas no catálogo (D-91).
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- AlterTable
ALTER TABLE "listings" ADD COLUMN "search_text" TEXT NOT NULL DEFAULT '';

-- CreateIndex
CREATE INDEX "listings_search_text_trgm_idx" ON "listings" USING GIN ("search_text" gin_trgm_ops);
