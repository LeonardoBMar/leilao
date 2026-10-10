import { z } from "zod";

import { entityId } from "@/lib/schemas";

export const ALERTS_PAGE_SIZE = 24;

export const alertIdSchema = entityId();

/**
 * Filtros de "Alertas" (`/alertas?monitor=…&situacao=todos`). Abre nos não lidos, que é o que o contador do menu
 * promete. Nunca lançam: valor inválido vira o padrão.
 */
export const alertFiltersSchema = z
  .object({
    monitor: z.uuid().optional().catch(undefined),
    situacao: z.enum(["nao-lidos", "todos"]).catch("nao-lidos"),
    pagina: z.coerce.number().int().min(1).max(10_000).catch(1),
  })
  .transform(({ monitor, situacao, pagina }) => ({
    watchId: monitor,
    unreadOnly: situacao === "nao-lidos",
    page: pagina,
  }));
export type AlertFilters = z.infer<typeof alertFiltersSchema>;
