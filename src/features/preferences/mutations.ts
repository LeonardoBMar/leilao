import "server-only";

import { err, ok, type Result } from "@/lib/result";
import { requireUser } from "@/server/auth";
import { db } from "@/server/db";

import type { UserPreferencesInput } from "./schemas";

export type UpsertUserPreferencesError = "invalid_municipality";

function hasAnyValue(input: UserPreferencesInput): boolean {
  return (
    input.municipalityIbgeCode !== null ||
    input.radiusKm !== null ||
    input.desiredMarginRateBps !== null ||
    input.riskReserveRateBps !== null ||
    input.documentationCost !== null ||
    input.towBase !== null ||
    input.towPerKm !== null ||
    input.towUnknownDistance !== null ||
    input.saleDiscountNoneBps !== null ||
    input.saleDiscountSmallBps !== null ||
    input.saleDiscountMediumBps !== null ||
    input.saleDiscountLargeBps !== null
  );
}

export async function upsertUserPreferences(
  input: UserPreferencesInput,
): Promise<Result<void, UpsertUserPreferencesError>> {
  const user = await requireUser();

  if (input.municipalityIbgeCode !== null) {
    const exists = await db.municipality.findUnique({
      where: { ibgeCode: input.municipalityIbgeCode },
      select: { ibgeCode: true },
    });
    if (!exists) return err("invalid_municipality");
  }

  if (!hasAnyValue(input)) {
    await db.userPreference.deleteMany({ where: { ownerId: user.id } });
    return ok(undefined);
  }

  const data = {
    municipalityIbgeCode: input.municipalityIbgeCode,
    radiusKm: input.radiusKm,
    desiredMarginRateBps: input.desiredMarginRateBps,
    riskReserveRateBps: input.riskReserveRateBps,
    documentationCost: input.documentationCost,
    towBase: input.towBase,
    towPerKm: input.towPerKm,
    towUnknownDistance: input.towUnknownDistance,
    saleDiscountNoneBps: input.saleDiscountNoneBps,
    saleDiscountSmallBps: input.saleDiscountSmallBps,
    saleDiscountMediumBps: input.saleDiscountMediumBps,
    saleDiscountLargeBps: input.saleDiscountLargeBps,
  };

  await db.userPreference.upsert({
    where: { ownerId: user.id },
    create: { ownerId: user.id, ...data },
    update: data,
  });

  return ok(undefined);
}

export async function resetUserPreferences(): Promise<void> {
  const user = await requireUser();
  await db.userPreference.deleteMany({ where: { ownerId: user.id } });
}
