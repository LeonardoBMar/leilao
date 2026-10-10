-- CreateTable
CREATE TABLE "listing_dismissals" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "listing_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "listing_dismissals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "listing_dismissals_listing_id_idx" ON "listing_dismissals"("listing_id");

-- CreateIndex
CREATE UNIQUE INDEX "listing_dismissals_owner_id_listing_id_key" ON "listing_dismissals"("owner_id", "listing_id");

-- AddForeignKey
ALTER TABLE "listing_dismissals" ADD CONSTRAINT "listing_dismissals_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Segurança (D-14): só o servidor lê e grava.
ALTER TABLE "listing_dismissals" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "listing_dismissals" FROM anon, authenticated;
