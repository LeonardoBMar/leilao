import { z } from "zod";

/**
 * Formas dos dados que o Leilo publica na página do lote (levantamento de 2026-09-27, docs/PLANO-COLETA.md §2).
 * Tolerantes de propósito: campo ausente vira `null`, e só o essencial (id e nome) é obrigatório.
 */

const text = z.string().trim().min(1).nullish().catch(null);
/** Reais. Teto: o maior valor que cabe em centavos numa coluna Int (D-15); acima disso vira `null`. */
const amount = z.number().nonnegative().max(21_474_836).nullish().catch(null);
const year = z.number().int().min(1900).max(2100).nullish().catch(null);
const isoDate = z.iso.datetime({ offset: true }).nullish().catch(null);

/** Lote em `window.__INITIAL_STATE__.elastic.lotePaginaAtualData`. */
export const leiloLotSchema = z.object({
  id: z.uuid(),
  nome: z.string().trim().min(1),
  situacao: text,
  numero: z.union([z.string(), z.number()]).nullish().catch(null),
  tipo: text,
  dataInicio: isoDate,
  dataFim: isoDate,
  fotosUrls: z.array(z.string()).nullish().catch(null),
  leilao: z.object({ id: text, nome: text, data: isoDate }).nullish().catch(null),
  localizacao: z.object({ nome: text, cidade: text, estado: text, endereco: text }).nullish().catch(null),
  veiculo: z
    .object({
      cor: text,
      valorMercado: amount,
      retomada: text,
      anoModelo: year,
      anoFabricacao: year,
      combustivel: text,
      km: z.number().int().nonnegative().max(10_000_000).nullish().catch(null),
      infocarFipeNome: text,
      infocarFipeCodigo: text,
      infocarMarca: text,
      infocarModelo: text,
      possuiChave: z.boolean().nullish().catch(null),
    })
    .nullish()
    .catch(null),
  valor: z
    .object({
      minimo: amount,
      despachante: amount,
      outros: amount,
      remocao: amount,
      depositoDeBens: amount,
      vistoria: amount,
      comissaoPorcentagem: z.number().min(0).max(100).nullish().catch(null),
      lance: z
        .object({ valor: amount, quantidade: z.number().int().nonnegative().nullish().catch(null) })
        .nullish()
        .catch(null),
    })
    .nullish()
    .catch(null),
  comitente: z.object({ nome: text }).nullish().catch(null),
});
export type LeiloLot = z.infer<typeof leiloLotSchema>;

/** Reserva: bloco JSON-LD `Vehicle` (schema.org), que cobre o núcleo se o estado da página mudar. */
export const leiloVehicleLdSchema = z.object({
  "@type": z.union([z.string(), z.array(z.string())]),
  name: z.string().trim().min(1),
  url: z.string(),
  sku: z.union([z.string(), z.number()]).nullish().catch(null),
  image: z.array(z.string()).nullish().catch(null),
  fuelType: text,
  color: text,
  category: text,
  vehicleModelDate: z.union([z.string(), z.number()]).nullish().catch(null),
  mileageFromOdometer: z.object({ value: amount }).nullish().catch(null),
  brand: z.object({ name: text }).nullish().catch(null),
  model: text,
  offers: z
    .object({
      price: amount,
      availability: text,
      availabilityStarts: isoDate,
      availabilityEnds: isoDate,
      availableAtOrFrom: z
        .object({
          name: text,
          address: z.object({ addressLocality: text, addressRegion: text, streetAddress: text }).nullish().catch(null),
        })
        .nullish()
        .catch(null),
    })
    .nullish()
    .catch(null),
});
export type LeiloVehicleLd = z.infer<typeof leiloVehicleLdSchema>;
