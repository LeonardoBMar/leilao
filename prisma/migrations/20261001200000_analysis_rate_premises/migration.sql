-- Premissas padrão da análise (D-38): reserva e margem também em % do valor de venda.
-- Na fixação, risk_reserve_cents e desired_margin_cents continuam obrigatórios e guardam o valor aplicado (R = r × V,
-- M = m × V), então análises fixadas antigas e novas têm o mesmo formato. Colunas novas e anuláveis: nada a migrar.

-- AlterTable
ALTER TABLE "analyses" ADD COLUMN     "desired_margin_bps" INTEGER,
ADD COLUMN     "risk_reserve_bps" INTEGER;

ALTER TABLE "analyses"
  ADD CONSTRAINT "analyses_premise_bps_range" CHECK (
    ("risk_reserve_bps" IS NULL OR "risk_reserve_bps" BETWEEN 0 AND 10000)
    AND ("desired_margin_bps" IS NULL OR "desired_margin_bps" BETWEEN 0 AND 10000)
  );
