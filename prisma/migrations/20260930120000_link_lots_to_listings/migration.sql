-- "Adicionar à análise" e acompanhamento automático (docs/PLANO-COLETA.md, etapa 3; D-34).
-- O lote do usuário passa a apontar para o anúncio coletado, e o leilão para o leilão na fonte, para não duplicar.

-- AlterTable
ALTER TABLE "auctions" ADD COLUMN     "external_id" TEXT,
ADD COLUMN     "source_id" VARCHAR(40);

-- AlterTable
ALTER TABLE "lots" ADD COLUMN     "listing_id" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "auctions_owner_id_source_id_external_id_key" ON "auctions"("owner_id", "source_id", "external_id");

-- CreateIndex
CREATE INDEX "lots_listing_id_idx" ON "lots"("listing_id");

-- CreateIndex
CREATE UNIQUE INDEX "lots_owner_id_listing_id_key" ON "lots"("owner_id", "listing_id");

-- AddForeignKey
ALTER TABLE "auctions" ADD CONSTRAINT "auctions_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lots" ADD CONSTRAINT "lots_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- CHECKs: fonte e id na fonte andam juntos (senão o índice único não impede duplicar)
ALTER TABLE "auctions"
  ADD CONSTRAINT "auctions_source_pair" CHECK (("source_id" IS NULL) = ("external_id" IS NULL)),
  ADD CONSTRAINT "auctions_external_id_not_blank" CHECK ("external_id" IS NULL OR btrim("external_id") <> '');
