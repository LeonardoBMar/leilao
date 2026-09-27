import type { Coordinates } from "./geo";

/**
 * Região de interesse do coletor enquanto não há monitores por usuário (docs/PLANO-COLETA.md, etapa 1):
 * dentro dela o lance em andamento é acompanhado; fora, o anúncio só é revisitado para gravar o arremate.
 * Coordenadas da sede do município (prisma/data/municipalities.csv).
 */
export const DEFAULT_REGION = {
  label: "São Carlos/SP",
  ibgeCode: 3548906,
  center: { latitude: -22.0174, longitude: -47.886 } satisfies Coordinates,
  radiusKm: 150,
} as const;
