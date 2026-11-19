import { z } from "zod";

import type { ResearchVehicle } from "@/domain/research/filters";
import { createBrowserStore } from "@/lib/browser-store";

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
const store = createBrowserStore<readonly ResearchVehicle[]>({
  key: STORAGE_KEY,
  schema: savedSchema,
  fallback: EMPTY,
  normalize: (list) => list.slice(0, RECENT_MODELS_LIMIT),
});

export const subscribeRecentModels = store.subscribe;
export const recentModelsSnapshot = store.getSnapshot;
export const recentModelsServerSnapshot = store.getServerSnapshot;

/** Guarda o modelo escolhido na busca. */
export function rememberModel(vehicle: ResearchVehicle) {
  store.write(withRecentModel(store.read(), vehicle));
}
