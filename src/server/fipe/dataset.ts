import "server-only";

import { parseFipeDataset } from "@/domain/listings/fipe-dataset";
import { monthOf } from "@/domain/listings/fipe-match";

import { COLLECTOR_USER_AGENT } from "../collector/http";
import { db } from "../db";
import { fipeTableCode, importedMonths } from "./catalog";
import { notFromSource } from "./matches";

/**
 * Importação da tabela FIPE do mês (D-51) a partir do dataset fipeX no Hugging Face (CC0): um arquivo de ~5 MB por
 * mês com a tabela inteira (~51 mil preços), publicado no começo do mês. Substitui a API da FIPE, que recusa o
 * GitHub Actions (HTTP 403). A coleta chama `ensureFipeCatalog` a cada execução; só baixa quando falta um mês.
 */
export const FIPE_DATASET_URL = "https://huggingface.co/datasets/alanwgt/fipex-veiculos-brasil/resolve/main";

/** Primeiro mês do catálogo: o mais antigo de que os anúncios precisavam na troca (setembro de 2026). */
export const FIPE_FIRST_MONTH = new Date(Date.UTC(2026, 8, 1));

/** Menos que isso não é a tabela inteira (outubro/2026 tem 49.299 preços com ano-modelo). */
const MIN_PRICES = 20_000;
const INSERT_CHUNK = 2_000;
const DOWNLOAD_TIMEOUT_MS = 2 * 60_000;

export type FipeImportResult =
  | { kind: "imported"; month: string; prices: number; requeued: number }
  | { kind: "unpublished"; month: string }
  | { kind: "failed"; month: string; error: string };

export function fipeDatasetUrl(month: Date): string {
  const [year, number] = fipeTableCode(month).split("-");
  return `${FIPE_DATASET_URL}/${year}/${number}/fipex-prices.csv`;
}

/**
 * Importa os meses que faltam, do mais novo ao mais antigo, até `maxMonths` por chamada. Mês ainda não publicado
 * fica para a próxima execução. Nunca lança: a falha volta como resultado, para a coleta registrar só um aviso.
 */
export async function ensureFipeCatalog(input: {
  now: Date;
  maxMonths?: number;
  fetcher?: typeof fetch;
}): Promise<FipeImportResult[]> {
  const { now, maxMonths = 2, fetcher = fetch } = input;
  let present: Set<number>;
  try {
    present = new Set((await importedMonths()).map((month) => month.getTime()));
  } catch (error) {
    return [{ kind: "failed", month: fipeTableCode(monthOf(now)), error: describe(error) }];
  }
  const missing: Date[] = [];
  for (let month = monthOf(now); month >= FIPE_FIRST_MONTH; month = previousMonth(month)) {
    if (!present.has(month.getTime())) missing.push(month);
  }
  const results: FipeImportResult[] = [];
  for (const month of missing.slice(0, maxMonths)) results.push(await importFipeMonth(month, fetcher));
  return results;
}

/**
 * Baixa e grava a tabela de um mês, substituindo a que houver, numa transação (nunca fica meio mês). Os anúncios
 * cujo valor veio de uma tabela anterior por falta desta voltam à fila, para receber o valor do mês certo.
 */
export async function importFipeMonth(month: Date, fetcher: typeof fetch = fetch): Promise<FipeImportResult> {
  const code = fipeTableCode(month);
  try {
    const response = await fetcher(fipeDatasetUrl(month), {
      headers: { "User-Agent": COLLECTOR_USER_AGENT },
      signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
    });
    if (response.status === 404) return { kind: "unpublished", month: code };
    if (!response.ok) return { kind: "failed", month: code, error: `dataset: HTTP ${response.status}` };
    const parsed = parseFipeDataset(await response.text(), month);
    if (parsed === null) return { kind: "failed", month: code, error: "dataset: colunas fora do formato esperado" };
    if (parsed.otherMonth > 0) {
      return { kind: "failed", month: code, error: `dataset: ${parsed.otherMonth} preços de outro mês no arquivo` };
    }
    if (parsed.prices.length < MIN_PRICES) {
      return { kind: "failed", month: code, error: `dataset: só ${parsed.prices.length} preços (tabela incompleta)` };
    }

    const requeued = await db.$transaction(
      async (tx) => {
        await tx.fipePrice.deleteMany({ where: { referenceMonth: month } });
        for (let start = 0; start < parsed.prices.length; start += INSERT_CHUNK) {
          await tx.fipePrice.createMany({
            data: parsed.prices.slice(start, start + INSERT_CHUNK).map(({ value, ...price }) => ({
              ...price,
              valueCents: value,
            })),
          });
        }
        // Anúncio deste mês em diante (aberto visto agora, encerrado agora) casado numa tabela anterior ou sem valor.
        const { count } = await tx.listing.updateMany({
          where: {
            marketValueCheckedAt: { not: null },
            AND: [
              notFromSource,
              { OR: [{ marketValueRefMonth: null }, { marketValueRefMonth: { lt: month } }] },
              { OR: [{ firstSeenAt: { gte: month } }, { endsAt: { gte: month } }] },
            ],
          },
          data: { marketValueCheckedAt: null },
        });
        return count;
      },
      { maxWait: 30_000, timeout: 5 * 60_000 },
    );
    return { kind: "imported", month: code, prices: parsed.prices.length, requeued };
  } catch (error) {
    return { kind: "failed", month: code, error: describe(error) };
  }
}

function previousMonth(month: Date): Date {
  return new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() - 1, 1));
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message.trim().split("\n").at(-1) || error.name : String(error);
}
