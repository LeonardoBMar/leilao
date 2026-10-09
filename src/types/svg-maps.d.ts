/**
 * Tipos do `@svg-maps/brazil` (D-45). O pacote importa os tipos de `svg-maps__common`, que não é publicado: o formato
 * vem do README do svg-maps.
 */
declare module "svg-maps__common" {
  export type Location = { id: string; name: string; path: string };
  export type Map = { label: string; viewBox: string; locations: Location[] };
}
