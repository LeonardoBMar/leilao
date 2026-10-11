import type { Route } from "next";

import { toSearchText } from "@/domain/listings/criteria";
import { BRAND_ALIASES } from "@/domain/listings/vehicle-key";
import type { ResearchFilters, ResearchVehicle } from "@/domain/research/filters";

import { researchParams } from "./schemas";

/** Abas do Mercado (D-71): Avaliar um veículo, Panorama do catálogo (a antiga Pesquisa) e Calibração. */
export const MARKET_PATH = "/mercado";
export const PANORAMA_PATH = "/mercado/panorama";
export const CALIBRATION_PATH = "/mercado/calibracao";
/** Os filtros da Pesquisa (D-45) moram no Panorama. */
export const RESEARCH_PATH = PANORAMA_PATH;

export type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Endereço do Panorama com estes filtros (sem os padrões). */
export function researchHref(filters: ResearchFilters): Route {
  const query = new URLSearchParams(researchParams(filters)).toString();
  return (query ? `${RESEARCH_PATH}?${query}` : RESEARCH_PATH) as Route;
}

/**
 * Modelos que casam com o texto digitado: cada palavra é o começo de uma palavra da marca ou do modelo (a sigla da
 * marca também vale: "vw gol"). Modelo com hífen casa por parte ou junto: "t cross", "tcross" e "hrv". Sem texto,
 * os primeiros da lista, que vem do mais vendido ao menos vendido.
 */
export function matchModels<T extends ResearchVehicle>(options: readonly T[], typed: string, limit = 8): T[] {
  const tokens = toSearchText(typed).split(" ").filter(Boolean);
  if (tokens.length === 0) return options.slice(0, limit);
  return options
    .filter(({ brand, model }) => {
      const aliases = Object.keys(BRAND_ALIASES).filter((alias) => BRAND_ALIASES[alias] === brand);
      const words = [...brand.split(" "), ...aliases, model, ...model.split("-"), model.replaceAll("-", "")];
      return tokens.every((token) => words.some((word) => word.startsWith(token)));
    })
    .slice(0, limit);
}
