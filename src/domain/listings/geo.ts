export type Coordinates = { latitude: number; longitude: number };

/** Raio da Terra da fórmula de haversine; o SQL de distância usa o mesmo. */
export const EARTH_RADIUS_KM = 6371;
/** Na esfera de `EARTH_RADIUS_KM`, a mesma usada por `distanceKm`: ≈ 111,19 km. */
const KM_PER_LATITUDE_DEGREE = (2 * Math.PI * EARTH_RADIUS_KM) / 360;

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

/** Distância em linha reta (fórmula de haversine), em km. A distância de estrada é maior. */
export function distanceKm(from: Coordinates, to: Coordinates): number {
  const dLat = toRadians(to.latitude - from.latitude);
  const dLng = toRadians(to.longitude - from.longitude);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(from.latitude)) * Math.cos(toRadians(to.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

/**
 * Retângulo que contém o círculo de `radiusKm` em volta do centro. Serve de pré-filtro barato no banco;
 * o filtro exato é `distanceKm`.
 */
export function boundingBox(center: Coordinates, radiusKm: number) {
  const latDelta = radiusKm / KM_PER_LATITUDE_DEGREE;
  // O grau de longitude encolhe longe do equador: usa a latitude do círculo mais distante dele.
  const farthestLatitude = Math.min(Math.abs(center.latitude) + latDelta, 89);
  const lngDelta = radiusKm / (KM_PER_LATITUDE_DEGREE * Math.cos(toRadians(farthestLatitude)));
  return {
    minLatitude: center.latitude - latDelta,
    maxLatitude: center.latitude + latDelta,
    minLongitude: center.longitude - lngDelta,
    maxLongitude: center.longitude + lngDelta,
  };
}
