import type { BuyerProfile, UserDefaultOverrides } from "@/domain/finance/defaults";
import type { RegionConfig } from "@/domain/listings/region";
import type { Bps, Cents } from "@/domain/money";

export type MunicipalityOption = {
  ibgeCode: number;
  name: string;
  state: string;
  label: string;
};

export type RawUserPreferences = {
  buyerProfile: BuyerProfile | null;
  municipalityIbgeCode: number | null;
  municipalityLabel: string | null;
  radiusKm: number | null;
  desiredMarginRateBps: Bps | null;
  riskReserveRateBps: Bps | null;
  documentationCost: Cents | null;
  towBase: Cents | null;
  towPerKm: Cents | null;
  towUnknownDistance: Cents | null;
  saleDiscountNoneBps: Bps | null;
  saleDiscountSmallBps: Bps | null;
  saleDiscountMediumBps: Bps | null;
  saleDiscountLargeBps: Bps | null;
  updatedAt: Date | null;
};

export type UserPreferences = {
  region: RegionConfig;
  costOverrides: UserDefaultOverrides;
  raw: RawUserPreferences;
  hasOverrides: boolean;
};
