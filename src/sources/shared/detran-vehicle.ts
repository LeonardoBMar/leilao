// Marca e modelo no formato do registro nacional de veículos ("VW/GOL 1.6", "I/FIAT SIENA"), o mesmo que os Detrans
// escrevem nos lotes (Detran-MG, Detran-SC).

import { nonEmpty } from "./extract";

/**
 * Prefixos antes da barra que não são a marca: importado (`I/`, `IMP/`) e montadora (`JTA/SUZUKI`, `Y/YAMAHA`).
 * Nesses casos a marca é a primeira palavra depois da barra.
 */
const PREFIXES = new Set(["I", "IMP", "JTA", "Y"]);
const BRAND_NAMES: Readonly<Record<string, string>> = {
  CHEV: "CHEVROLET",
  MMC: "MITSUBISHI",
  "M.BENZ": "MERCEDES-BENZ",
  MBENZ: "MERCEDES-BENZ",
  "M BENZ": "MERCEDES-BENZ",
};

/** "VW/GOL 1.6" → VW + GOL 1.6; "I/FIAT SIENA" → FIAT + SIENA; "JTA-SUZUKI/GSR150I" → SUZUKI + GSR150I. */
export function splitDetranVehicle(text: string | null): { brand: string | null; model: string | null } {
  if (text === null) return { brand: null, model: null };
  const clean = text.replace(/\s+/g, " ").trim().toUpperCase();
  const slash = clean.indexOf("/");
  if (slash < 0) return { brand: null, model: nonEmpty(clean) };
  const prefix = clean.slice(0, slash).trim();
  const rest = clean.slice(slash + 1).trim();
  if (PREFIXES.has(prefix)) {
    const [first = "", ...others] = rest.split(" ");
    return { brand: brandName(first), model: nonEmpty(others.join(" ")) };
  }
  const dashed = prefix.split("-");
  const brand = dashed.length > 1 && PREFIXES.has(dashed[0] ?? "") ? dashed.slice(1).join("-") : prefix;
  return { brand: brandName(brand), model: nonEmpty(rest) };
}

function brandName(brand: string): string | null {
  return nonEmpty(BRAND_NAMES[brand] ?? brand);
}
