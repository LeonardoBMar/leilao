import {
  DEFAULT_COSTS,
  type DefaultAssumptions,
  defaultAssumptions,
  type DefaultsInput,
} from "@/domain/finance/defaults";
import type { ConditionFlag, DamageLevel } from "@/domain/listings/condition";
import type { MarketValueOrigin } from "@/domain/listings/fipe-match";
import { distanceKm } from "@/domain/listings/geo";
import { DEFAULT_REGION } from "@/domain/listings/region";
import { type Bps, bps, type Cents, cents } from "@/domain/money";
import { calendarDateToUtc, toCalendarDateInput } from "@/lib/dates";
import { formatBps, formatBRL } from "@/lib/format";

import type { ListingFipe } from "./fipe-fill";

const DAMAGE_LABELS: Record<DamageLevel | "none", string> = {
  none: "sem sinistro declarado",
  small: "pequena monta",
  medium: "média monta",
  large: "grande monta",
  salvage: "sucata",
};

/** Colunas do anúncio que alimentam as premissas padrão (o select de quem chama). */
export type ListingForDefaults = {
  marketValueCents: number | null;
  marketValueOrigin: MarketValueOrigin | null;
  marketValueRefMonth: Date | null;
  category: string | null;
  damageLevel: DamageLevel | null;
  conditionFlags: ConditionFlag[];
  commissionBps: number | null;
  dispatcherFeeCents: number | null;
  removalFeeCents: number | null;
  storageFeeCents: number | null;
  inspectionFeeCents: number | null;
  otherFeesCents: number | null;
  municipality: { latitude: number; longitude: number } | null;
};

export const listingForDefaultsSelect = {
  marketValueCents: true,
  marketValueOrigin: true,
  marketValueRefMonth: true,
  category: true,
  damageLevel: true,
  conditionFlags: true,
  commissionBps: true,
  dispatcherFeeCents: true,
  removalFeeCents: true,
  storageFeeCents: true,
  inspectionFeeCents: true,
  otherFeesCents: true,
  municipality: { select: { latitude: true, longitude: true } },
} as const;

/** Lote sem anúncio: nada se sabe além do que o usuário digitar (a FIPE entra pelo botão do formulário). */
export const UNKNOWN_VEHICLE: DefaultsInput = {
  fipe: null,
  isMotorcycle: false,
  damageLevel: null,
  airbagDeployed: false,
  missingParts: false,
  dispatcherFee: null,
  removalFee: null,
  otherFees: null,
  commissionRate: null,
  distanceKm: null,
};

const toCents = (value: number | null): Cents | null => (value === null ? null : cents(value));

export function defaultsInputFromListing(listing: ListingForDefaults): DefaultsInput {
  // Depósito, vistoria e demais taxas do anúncio somam em "outras taxas"; nada informado fica `null`.
  const fees = [listing.storageFeeCents, listing.inspectionFeeCents, listing.otherFeesCents].filter(
    (fee) => fee !== null,
  );
  return {
    fipe: toCents(listing.marketValueCents),
    isMotorcycle: listing.category === "Motos",
    damageLevel: listing.damageLevel,
    airbagDeployed: listing.conditionFlags.includes("airbag_deployed"),
    missingParts: listing.conditionFlags.includes("missing_parts"),
    dispatcherFee: toCents(listing.dispatcherFeeCents),
    removalFee: toCents(listing.removalFeeCents),
    otherFees: fees.length === 0 ? null : cents(fees.reduce((total, fee) => total + fee, 0)),
    commissionRate: listing.commissionBps === null ? null : bps(listing.commissionBps),
    distanceKm: listing.municipality ? distanceKm(DEFAULT_REGION.center, listing.municipality) : null,
  };
}

/** Anúncio de onde o rascunho parte: a fonte, quando foi lido e de onde veio a FIPE (D-47). */
export type DraftSource = {
  name: string;
  referenceDate: Date;
  marketValueOrigin: MarketValueOrigin | null;
  marketValueRefMonth: Date | null;
};

export function draftSourceOf(listing: ListingForDefaults & { lastCheckedAt: Date; source: { name: string } }) {
  return {
    name: listing.source.name,
    referenceDate: listing.lastCheckedAt,
    marketValueOrigin: listing.marketValueOrigin,
    marketValueRefMonth: listing.marketValueRefMonth,
  } satisfies DraftSource;
}

/** Referência da FIPE no rascunho: informada pela fonte ou casada pelo sistema na tabela do mês. */
function fipeReference(source: Pick<DraftSource, "name" | "marketValueOrigin" | "marketValueRefMonth"> | null) {
  if (source === null) return { fipeReferenceMonth: null, fipeReferenceSource: null };
  if (source.marketValueOrigin === "fipe_version" || source.marketValueOrigin === "fipe_family") {
    return {
      fipeReferenceMonth: source.marketValueRefMonth,
      fipeReferenceSource:
        source.marketValueOrigin === "fipe_version"
          ? "Tabela FIPE (casada pelo sistema)"
          : "Tabela FIPE (casada pelo sistema, versão aproximada)",
    };
  }
  return { fipeReferenceMonth: null, fipeReferenceSource: `${source.name} (informado no anúncio)` };
}

/** FIPE do anúncio ligado, para "Usar FIPE do anúncio" na análise; `null` sem valor de mercado. */
export function listingFipeOf(listing: {
  marketValueCents: number | null;
  marketValueOrigin: MarketValueOrigin | null;
  marketValueRefMonth: Date | null;
  source: { name: string };
}): ListingFipe | null {
  if (listing.marketValueCents === null || listing.marketValueCents <= 0) return null;
  const reference = fipeReference({
    name: listing.source.name,
    marketValueOrigin: listing.marketValueOrigin,
    marketValueRefMonth: listing.marketValueRefMonth,
  });
  return {
    value: cents(listing.marketValueCents),
    refMonth: reference.fipeReferenceMonth,
    source: reference.fipeReferenceSource ?? listing.source.name,
  };
}

/**
 * Premissas padrão (D-38) → colunas do rascunho, com a origem de cada número nas observações. O rascunho continua
 * editável; quem fixa é o usuário.
 */
export function draftDefaults(input: DefaultsInput, source: DraftSource | null) {
  const defaults = defaultAssumptions(input);
  const referenceDate = source ? calendarDateToUtc(toCalendarDateInput(source.referenceDate)) : null;
  const saleDiscount = defaults.basis.saleDiscount;
  return {
    marketValueCents: defaults.marketValue,
    marketReferenceDate: defaults.marketValue === null ? null : referenceDate,
    marketReferenceSource:
      saleDiscount === null
        ? null
        : `FIPE − ${formatBps(saleDiscount)} (premissa padrão, ${DAMAGE_LABELS[defaults.basis.condition]})`,
    fipeValueCents: input.fipe,
    ...(input.fipe === null ? { fipeReferenceMonth: null, fipeReferenceSource: null } : fipeReference(source)),
    repairCostCents: defaults.repairCost,
    documentationCostCents: defaults.documentationCost,
    transportCostCents: defaults.transportCost,
    tiresCostCents: defaults.tiresCost,
    serviceCostCents: defaults.serviceCost,
    otherFeesCents: defaults.otherFees,
    commissionMode: "percentage" as const,
    commissionRateBps: defaults.commissionRateBps,
    riskReserveBps: defaults.riskReserveRateBps,
    desiredMarginBps: defaults.desiredMarginRateBps,
    notes: defaultsNote(input, defaults, source?.name ?? null),
  };
}

const DEFAULT_NOTES_PREFIX = "Premissas padrão, pessimistas";

/**
 * Rascunho criado com as premissas padrão e nunca editado pelo usuário (nem em valores nem nas notas).
 * Usado para alertar antes de fixar em lote diretamente pelo dashboard.
 */
export function isUnreviewedDefaultDraft(draft: { createdAt: Date; updatedAt: Date; notes: string | null }): boolean {
  return (
    draft.updatedAt.getTime() === draft.createdAt.getTime() && Boolean(draft.notes?.startsWith(DEFAULT_NOTES_PREFIX))
  );
}

function defaultsNote(input: DefaultsInput, defaults: DefaultAssumptions, sourceName: string | null): string {
  const { basis } = defaults;
  const vehicle = input.isMotorcycle ? "moto" : "carro";
  const fromListing = sourceName === null ? "do anúncio" : `do anúncio no ${sourceName}`;
  const lines = [
    input.fipe === null
      ? "Valor de venda e reparos: sem FIPE. Informe a FIPE e use “Estimar a partir da FIPE”."
      : basis.saleDiscount === null
        ? "Valor de venda e reparos: sucata, sem valor de venda padrão. Informe os dois."
        : `Valor de venda: FIPE ${formatBRL(input.fipe)} − ${formatBps(basis.saleDiscount)} (${DAMAGE_LABELS[basis.condition]}).`,
    basis.repairRate === null ? null : `Reparos: ${repairText(input, basis.repairRate)}.`,
    basis.documentation === "listing"
      ? `Documentação: despachante ${fromListing}.`
      : `Documentação: padrão ${formatBRL(DEFAULT_COSTS.documentation)}.`,
    basis.transport === "listing"
      ? `Transporte: remoção ${fromListing}.`
      : basis.transport === "distance" && basis.roadKm === 0
        ? `Transporte: pátio no mesmo município, só a saída do guincho (${formatBRL(DEFAULT_COSTS.towBase)}).`
        : basis.transport === "distance" && basis.roadKm !== null
          ? `Transporte: guincho ${formatBRL(DEFAULT_COSTS.towBase)} + ${formatBRL(DEFAULT_COSTS.towPerKm)}/km × ` +
            `${basis.roadKm} km de estrada estimados até o pátio.`
          : `Transporte: local do pátio desconhecido, guincho padrão ${formatBRL(DEFAULT_COSTS.towUnknownDistance)}.`,
    `Pneus e revisão: padrão para ${vehicle}.`,
    basis.otherFees === "listing"
      ? `Outras taxas: depósito, vistoria e outras ${fromListing}.`
      : "Outras taxas: nenhuma informada.",
    basis.commission === "listing"
      ? `Comissão: ${formatBps(defaults.commissionRateBps)} ${fromListing}.`
      : `Comissão: padrão ${formatBps(defaults.commissionRateBps)} sobre o lance; confira no edital.`,
    `Reserva ${formatBps(defaults.riskReserveRateBps)} e margem ${formatBps(defaults.desiredMarginRateBps)} do valor de venda.`,
  ].filter((line) => line !== null);
  return `${DEFAULT_NOTES_PREFIX} (revise antes de fixar):\n${lines.map((line) => `- ${line}`).join("\n")}`;
}

function repairText(input: DefaultsInput, rate: Bps): string {
  const floor = (input.isMotorcycle ? DEFAULT_COSTS.motorcycle : DEFAULT_COSTS.car).repairFloor;
  const extras = [
    input.airbagDeployed ? `airbag acionado ${formatBRL(DEFAULT_COSTS.airbagDeployed)}` : null,
    input.missingParts ? `peças faltando ${formatBRL(DEFAULT_COSTS.missingParts)}` : null,
  ].filter((extra) => extra !== null);
  const base = `${formatBps(rate)} da FIPE (mínimo ${formatBRL(floor)})`;
  return extras.length === 0 ? base : `${base} + ${extras.join(" + ")}`;
}
