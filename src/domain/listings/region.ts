import type { Coordinates } from "./geo";

export type RegionConfig = {
  readonly label: string;
  readonly ibgeCode: number;
  readonly center: Coordinates;
  readonly radiusKm: number;
};

export type RegionOverride = {
  municipality?: {
    ibgeCode: number;
    name: string;
    state: string;
    latitude: number;
    longitude: number;
  } | null;
  radiusKm?: number | null;
};

/**
 * Região de interesse do coletor enquanto não há monitores por usuário (docs/PLANO-COLETA.md, etapa 1):
 * dentro dela o lance em andamento é acompanhado; fora, o anúncio só é revisitado para gravar o arremate.
 * Coordenadas da sede do município (prisma/data/municipalities.csv).
 */
export const DEFAULT_REGION: RegionConfig = {
  label: "São Carlos/SP",
  ibgeCode: 3548906,
  center: { latitude: -22.0174, longitude: -47.886 },
  radiusKm: 150,
} as const;

/** Resolve a região do usuário com fallback limpo para `DEFAULT_REGION`. */
export function resolveRegion(override?: RegionOverride | null): RegionConfig {
  const municipality = override?.municipality ?? null;
  const radiusKm =
    override?.radiusKm !== null && override?.radiusKm !== undefined && override.radiusKm > 0
      ? override.radiusKm
      : DEFAULT_REGION.radiusKm;

  if (!municipality) {
    return radiusKm === DEFAULT_REGION.radiusKm ? DEFAULT_REGION : { ...DEFAULT_REGION, radiusKm };
  }

  return {
    label: `${municipality.name}/${municipality.state}`,
    ibgeCode: municipality.ibgeCode,
    center: { latitude: municipality.latitude, longitude: municipality.longitude },
    radiusKm,
  };
}
