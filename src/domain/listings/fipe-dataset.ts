import { type Cents, cents } from "../money";
import type { FipeVehicleType } from "./fipe-match";

/**
 * Tabela FIPE do mês no formato do dataset fipeX (D-51): um arquivo por mês, separado por tabulação, com uma linha por
 * versão, ano-modelo e combustível. Puro: o servidor baixa o arquivo e grava as linhas que esta leitura devolve.
 */

export type FipeDatasetPrice = {
  referenceMonth: Date;
  vehicleType: FipeVehicleType;
  fipeCode: string;
  brandName: string;
  modelName: string;
  modelYear: number;
  fuelCode: number;
  value: Cents;
};

const VEHICLE_TYPES: Readonly<Record<string, FipeVehicleType>> = { carro: 1, moto: 2, caminhão: 3 };

/** Siglas do dataset nos códigos da FIPE: 1 gasolina … 6 híbrido, como a API; 7 gás natural (só o dataset tem). */
const FUEL_CODES: Readonly<Record<string, number>> = { g: 1, e: 2, d: 3, l: 4, f: 5, h: 6, n: 7 };

const COLUMNS = [
  "tipo_veiculo",
  "codigo_fipe",
  "nome_modelo",
  "nome_marca",
  "sigla_combustivel",
  "ano_modelo",
  "valor_centavos",
  "mes_referencia",
  "ano_referencia",
] as const;

export type FipeDatasetParse = {
  prices: FipeDatasetPrice[];
  /** Linhas puladas: zero-km (sem ano-modelo, a FIPE as trata à parte) e linhas fora do formato. */
  skipped: number;
  /** Linhas de outro mês que não o pedido: o arquivo não é o esperado. */
  otherMonth: number;
};

/** Lê o arquivo do mês. `null` se o cabeçalho não tiver as colunas esperadas (o formato mudou). */
export function parseFipeDataset(text: string, month: Date): FipeDatasetParse | null {
  const lines = text.split(/\r?\n/);
  const header = (lines[0] ?? "").split("\t").map((name) => name.trim());
  const index = new Map(COLUMNS.map((name) => [name, header.indexOf(name)]));
  if ([...index.values()].some((position) => position < 0)) return null;

  const result: FipeDatasetParse = { prices: [], skipped: 0, otherMonth: 0 };
  for (const line of lines.slice(1)) {
    if (line.trim() === "") continue;
    const fields = line.split("\t").map(unquote);
    const field = (name: (typeof COLUMNS)[number]) => fields[index.get(name) ?? -1] ?? "";
    const rowMonth = Date.UTC(Number(field("ano_referencia")), Number(field("mes_referencia")) - 1, 1);
    if (rowMonth !== month.getTime()) {
      result.otherMonth++;
      continue;
    }
    const vehicleType = VEHICLE_TYPES[field("tipo_veiculo")];
    const fuelCode = FUEL_CODES[field("sigla_combustivel")];
    const modelYear = Number(field("ano_modelo"));
    const value = Number(field("valor_centavos"));
    const fipeCode = field("codigo_fipe");
    const brandName = field("nome_marca");
    const modelName = field("nome_modelo");
    const valid =
      vehicleType !== undefined &&
      fuelCode !== undefined &&
      field("ano_modelo") !== "" &&
      Number.isInteger(modelYear) &&
      modelYear >= 1900 &&
      modelYear <= 2100 &&
      Number.isSafeInteger(value) &&
      value > 0 &&
      fipeCode !== "" &&
      brandName !== "" &&
      modelName !== "";
    if (!valid) {
      result.skipped++;
      continue;
    }
    result.prices.push({
      referenceMonth: month,
      vehicleType,
      fipeCode,
      brandName,
      modelName,
      modelYear,
      fuelCode,
      value: cents(value),
    });
  }
  return result;
}

/** Campo entre aspas (o arquivo cita os nomes com espaço no começo): tira as aspas e os espaços das pontas. */
function unquote(field: string): string {
  const trimmed = field.trim();
  const quoted = trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"');
  return (quoted ? trimmed.slice(1, -1).replaceAll('""', '"') : trimmed).trim();
}
