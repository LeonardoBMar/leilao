import { z } from "zod";

/**
 * Schemas dos dados publicados nos chunks RSC (`self.__next_f`) do novo site Next.js do Pátio Estadual São Carlos.
 * Apenas os campos usados entram na validação; `metadados` (placa, chassi, Renavam) e dados de licitantes ficam de fora.
 */
export const patioListItemSchema = z.looseObject({
  id: z.coerce.string(),
  status: z.string(),
  fechamentoIso: z.string().nullish().catch(null),
});
export type PatioListItem = z.infer<typeof patioListItemSchema>;

export const patioLotListSchema = z.looseObject({
  itens: z.array(patioListItemSchema),
  pagina: z.coerce.number().int().positive(),
  porPagina: z.coerce.number().int().positive(),
  total: z.coerce.number().int().nonnegative(),
});
export type PatioLotList = z.infer<typeof patioLotListSchema>;

export const patioImageSchema = z.looseObject({
  src: z.string(),
  alt: z.string().nullish().catch(null),
});

export const patioLotSchema = z.looseObject({
  id: z.coerce.string(),
  titulo: z.string(),
  auctionId: z.coerce.string(),
  numero: z.coerce.number().int().nullish().catch(null),
  categoria: z.string().nullish().catch(null),
  status: z.string(),
  lanceAtualCentavos: z.coerce.number().int().nullish().catch(null),
  lanceInicialCentavos: z.coerce.number().int().nullish().catch(null),
  valorFipeCentavos: z.coerce.number().int().nullish().catch(null),
  qtdLances: z.coerce.number().int().nonnegative().catch(0),
  aberturaIso: z.string().nullish().catch(null),
  fechamentoIso: z.string().nullish().catch(null),
  descricao: z.string().nullish().catch(null),
  condicoesVenda: z.string().nullish().catch(null),
  imagens: z.array(patioImageSchema).catch([]),
});
export type PatioLot = z.infer<typeof patioLotSchema>;

export const patioAuctionSchema = z.looseObject({
  id: z.coerce.string(),
  titulo: z.string().nullish().catch(null),
  comitente: z.string().nullish().catch(null),
  aberturaIso: z.string().nullish().catch(null),
  fechamentoIso: z.string().nullish().catch(null),
  taxaAdministrativa: z.union([z.string(), z.number()]).nullish().catch(null),
  outrosCustos: z.union([z.string(), z.number()]).nullish().catch(null),
});
export type PatioAuction = z.infer<typeof patioAuctionSchema>;

/** Formato legado (`atualizar_leiloes.php`), mantido só para `detailsFromRaw` reler `raw` histórico no `db:reparse`. */
const legacyDateParts = z.object({
  dia: z.string(),
  mes: z.string(),
  ano: z.string(),
  hora: z.string(),
  min: z.string(),
  seg: z.string(),
});

export const patioLegacyLiveLotSchema = z.looseObject({
  box_id: z.coerce.string(),
  situacao: z.coerce.number().int(),
  cronometro: z.object({ data: z.object({ fim: legacyDateParts }) }),
});
export type PatioLegacyDateParts = z.infer<typeof legacyDateParts>;
