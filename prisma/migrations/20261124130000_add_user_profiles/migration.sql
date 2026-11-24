-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('USER', 'ADMIN');

-- CreateTable
CREATE TABLE "user_profiles" (
    "user_id" UUID NOT NULL,
    "role" "user_role" NOT NULL DEFAULT 'USER',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("user_id")
);

-- Segurança (D-14): só o servidor lê e grava.
ALTER TABLE "user_profiles" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "user_profiles" FROM anon, authenticated;

-- Promove usuário(s) já existente(s) a ADMIN para não bloquear o acesso atual a /sistema (D-90).
-- Novos usuários nascem sem linha (tratados como USER) ou com role = 'USER'; promoção futura só por SQL.
DO $$
BEGIN
    IF to_regclass('auth.users') IS NOT NULL THEN
        INSERT INTO "user_profiles" ("user_id", "role")
        SELECT id, 'ADMIN'::"user_role"
        FROM auth.users
        ON CONFLICT ("user_id") DO NOTHING;
    END IF;

    INSERT INTO "user_profiles" ("user_id", "role")
    SELECT DISTINCT owner_id, 'ADMIN'::"user_role"
    FROM (
        SELECT owner_id FROM "auctions"
        UNION
        SELECT owner_id FROM "watches"
        UNION
        SELECT owner_id FROM "user_preferences"
    ) existing_owners
    ON CONFLICT ("user_id") DO NOTHING;
END $$;
