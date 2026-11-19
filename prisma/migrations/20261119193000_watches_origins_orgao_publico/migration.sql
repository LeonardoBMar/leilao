-- Alinha watches_origins_keys com o enum vehicle_origin após D-73 (inclusão de orgao_publico).
ALTER TABLE "watches" DROP CONSTRAINT "watches_origins_keys";
ALTER TABLE "watches" ADD CONSTRAINT "watches_origins_keys"
  CHECK ("origins" <@ ARRAY['financiamento', 'seguradora', 'frota', 'orgao_publico', 'outros']);
