/**
 * Chave de comparação de nomes de lugar: sem acento, maiúsculas e espaços simples.
 * "São Carlos", "SAO CARLOS" e " são  carlos " viram "SAO CARLOS".
 */
export function normalizePlaceName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['’`]/g, "")
    .replace(/-/g, " ")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Separa "MARCA/MODELO" do jeito que os leiloeiros costumam escrever ("HYUNDAI/HB20 COMFORT (4P)").
 * Sem barra, não dá para saber onde termina a marca: devolve só o modelo.
 */
export function splitBrandModel(title: string): { brand: string | null; model: string | null } {
  const trimmed = title.trim();
  const slash = trimmed.indexOf("/");
  if (slash <= 0 || slash === trimmed.length - 1) return { brand: null, model: trimmed || null };
  return { brand: trimmed.slice(0, slash).trim(), model: trimmed.slice(slash + 1).trim() };
}

/**
 * Chave para casar a cidade da fonte com o município do IBGE: (nome normalizado, UF).
 * O Distrito Federal tem um único município (Brasília); as fontes escrevem a região administrativa
 * ("TAGUATINGA", "CEILANDIA"), então todo lugar do DF vira Brasília.
 */
export function municipalityKey(city: string, state: string): string {
  const uf = state.trim().toUpperCase();
  return `${uf === "DF" ? "BRASILIA" : normalizePlaceName(city)}|${uf}`;
}
