-- Onda 2 (D-97): Checklist de diligência pré-lance e auditoria determinística de edital no lote.
-- Colunas JSONB anuláveis em `lots` (herdam RLS, REVOKE e FK de `lots`; backup/restore já suportam jsonb).

ALTER TABLE "lots"
ADD COLUMN "diligence_checklist" JSONB,
ADD COLUMN "notice_audit" JSONB;
