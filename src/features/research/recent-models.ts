import { z } from "zod";

import type { ResearchVehicle } from "@/domain/research/filters";

/**
 * Modelos pesquisados por último, para a busca sugeri-los antes dos mais vendidos. Ficam no `localStorage` deste
 * navegador: é conveniência, então qualquer falha de leitura ou escrita cai na lista dos mais vendidos.
 */
const STORAGE_KEY = "leilao:recent-models";

/** Quantos modelos são lembrados. */
export const RECENT_MODELS_LIMIT = 5;

const savedSchema = z.array(z.object({ brand: z.string(), model: z.string() }));

/** O modelo vai para a frente da lista, sem repetição, e a lista não passa do limite. */
export function withRecentModel(
  list: readonly ResearchVehicle[],
  vehicle: ResearchVehicle,
  limit = RECENT_MODELS_LIMIT,
): ResearchVehicle[] {
  const others = list.filter((item) => item.brand !== vehicle.brand || item.model !== vehicle.model);
  return [{ brand: vehicle.brand, model: vehicle.model }, ...others].slice(0, limit);
}

const EMPTY: readonly ResearchVehicle[] = [];
let cache: readonly ResearchVehicle[] | null = null;
const listeners = new Set<() => void>();

function read(): readonly ResearchVehicle[] {
  if (cache) return cache;
  try {
    const parsed = savedSchema.safeParse(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]"));
    cache = parsed.success ? parsed.data.slice(0, RECENT_MODELS_LIMIT) : EMPTY;
  } catch {
    cache = EMPTY;
  }
  return cache;
}

export function subscribeRecentModels(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export const recentModelsSnapshot = read;
export const recentModelsServerSnapshot = () => EMPTY;

/** Guarda o modelo escolhido na busca. */
export function rememberModel(vehicle: ResearchVehicle) {
  cache = withRecentModel(read(), vehicle);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch {
    // Sem armazenamento (aba privada, bloqueio): vale só nesta sessão da página.
  }
  for (const listener of listeners) listener();
}
