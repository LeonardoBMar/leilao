import { z } from "zod";

import {
  checkbox,
  entityId,
  optionalInt,
  optionalPositiveBrlAmount,
  optionalText,
  optionalUrl,
  requiredInt,
  requiredText,
} from "@/lib/schemas";

const YEAR_MESSAGE = "Informe um ano entre 1900 e 2100.";

/** Cadastro e edição de lote (SPEC RF-02, RF-03). O leilão vem do contexto (bind), não do formulário. */
export const lotInputSchema = z
  .object({
    // Número é texto ("0152", "152-A"), sem espaços externos; único por leilão.
    lotNumber: requiredText("Informe o número do lote.").max(30, "Use até 30 caracteres."),
    brand: requiredText("Informe a marca.").max(80, "Use até 80 caracteres."),
    model: requiredText("Informe o modelo.").max(80, "Use até 80 caracteres."),
    vehicleVersion: optionalText().pipe(z.string().max(120, "Use até 120 caracteres.").optional()),
    modelYear: requiredInt(1900, 2100, YEAR_MESSAGE),
    manufactureYear: optionalInt(1900, 2100, YEAR_MESSAGE),
    // Vazio = desconhecida; 0 = zero informado (RF-02).
    mileageKm: optionalInt(0, 5_000_000, "Informe a quilometragem em números inteiros."),
    startingBid: optionalPositiveBrlAmount(),
    currentBid: optionalPositiveBrlAmount(),
    lotUrl: optionalUrl(),
    isFollowed: checkbox(),
    notes: optionalText().pipe(z.string().max(5_000, "Use até 5.000 caracteres.").optional()),
  })
  // No Zod 4 a regra cruzada roda mesmo com campo inválido: só compara quando o ano-modelo é válido.
  .refine(
    (lot) =>
      lot.manufactureYear === undefined || !Number.isInteger(lot.modelYear) || lot.manufactureYear <= lot.modelYear,
    {
      path: ["manufactureYear"],
      message: "O ano de fabricação não pode ser posterior ao ano-modelo.",
    },
  );
export type LotInput = z.infer<typeof lotInputSchema>;

export const lotIdSchema = entityId();

/** Atualização rápida do lance atual na ficha (fluxo principal, passo 7). Vazio limpa o valor. */
export const currentBidInputSchema = z.object({ currentBid: optionalPositiveBrlAmount() });

export const LOTS_PAGE_SIZE = 25;
/** Leilões por página em "Minhas análises" por leilão. */
export const LOT_GROUPS_PAGE_SIZE = 10;

const presence = z.enum(["com", "sem"]).optional().catch(undefined);
const flag = z
  .literal("1")
  .optional()
  .catch(undefined)
  .transform((value) => value === "1");

/** Filtros da lista de lotes. Nunca lançam: valor inválido vira o padrão. */
export const lotFiltersSchema = z
  .object({
    busca: z
      .string()
      .trim()
      .max(100)
      .transform((value) => value || undefined)
      .optional()
      .catch(undefined),
    acompanhados: flag,
    analise: presence,
    resultado: presence,
    arquivados: flag,
    pagina: z.coerce.number().int().min(1).max(10_000).catch(1),
  })
  .transform(({ busca, acompanhados, analise, resultado, arquivados, pagina }) => ({
    search: busca,
    followedOnly: acompanhados,
    analysis: analise,
    result: resultado,
    archived: arquivados,
    page: pagina,
  }));
export type LotFilters = z.infer<typeof lotFiltersSchema>;
