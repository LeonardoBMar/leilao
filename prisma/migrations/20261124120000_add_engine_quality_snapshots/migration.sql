-- CreateTable
CREATE TABLE "engine_quality_snapshots" (
    "id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "computed_at" TIMESTAMPTZ(3) NOT NULL,
    "from_date" TIMESTAMPTZ(3) NOT NULL,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "engine_quality_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "engine_quality_snapshots_version_computed_at_idx" ON "engine_quality_snapshots"("version", "computed_at" DESC);

-- Segurança (D-14): só o servidor lê e grava.
ALTER TABLE "engine_quality_snapshots" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "engine_quality_snapshots" FROM anon, authenticated;
