import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CatalogMunicipality } from "@/server/catalog-values";

const mockRequireUser = vi.fn();
const mockLoadAllMunicipalities = vi.fn<() => Promise<CatalogMunicipality[]>>();

vi.mock("@/server/auth", () => ({
  requireUser: () => mockRequireUser(),
}));

vi.mock("@/server/catalog-values", () => ({
  loadAllMunicipalities: () => mockLoadAllMunicipalities(),
}));

vi.mock("@/server/db", () => ({ db: {} }));

import { searchMunicipalities } from "./queries";

describe("searchMunicipalities", () => {
  beforeEach(() => {
    mockRequireUser.mockResolvedValue({ id: "user-1" });
    const padding: CatalogMunicipality[] = Array.from({ length: 22 }, (_, i) => {
      const suffix = String(i + 1).padStart(2, "0");
      return {
        ibgeCode: 1000 + i,
        name: `Águas de São ${suffix}`,
        state: "MG",
        nameKey: `AGUAS DE SAO ${suffix}`,
        latitude: -20,
        longitude: -45,
      };
    });
    mockLoadAllMunicipalities.mockResolvedValue([
      ...padding,
      {
        ibgeCode: 3548906,
        name: "São Carlos",
        state: "SP",
        nameKey: "SAO CARLOS",
        latitude: -22.01,
        longitude: -47.88,
      },
      { ibgeCode: 3550308, name: "São Paulo", state: "SP", nameKey: "SAO PAULO", latitude: -23.55, longitude: -46.63 },
    ]);
  });

  it("prioriza municípios que começam com o termo antes de limitar em 20 resultados", async () => {
    const results = await searchMunicipalities("sao");
    expect(results).toHaveLength(20);
    expect(results[0]?.label).toBe("São Carlos/SP");
    expect(results[1]?.label).toBe("São Paulo/SP");
  });

  it("filtra por UF quando informada após barra ou vírgula", async () => {
    const results = await searchMunicipalities("sao/sp");
    expect(results.map((item) => item.label)).toEqual(["São Carlos/SP", "São Paulo/SP"]);
  });
});
