import { describe, expect, it, vi } from "vitest";

import { DEFAULT_EVALUATE_FILTERS } from "@/domain/research/evaluate";
import { DEFAULT_RESEARCH_FILTERS, type ResearchFilters } from "@/domain/research/filters";

/**
 * Teste com banco, só leitura: roda as consultas da Pesquisa contra o catálogo real com
 * `DB_TESTS=1 npx vitest run src/features/research`. Confere que o SQL executa e que as linhas passam pelo Zod; os
 * números dependem do catálogo e não são fixados aqui.
 */
vi.mock("@/server/auth", () => ({
  requireUser: () => Promise.resolve({ id: "00000000-0000-0000-0000-000000000000" }),
}));

describe.skipIf(process.env.DB_TESTS !== "1")("consultas da Pesquisa", () => {
  it("executam no banco e devolvem o formato esperado", async () => {
    // O Next não carrega .env.local com NODE_ENV=test; o Node carrega direto.
    if (!process.env.DATABASE_URL) process.loadEnvFile(".env.local");
    const queries = await import("./queries");
    const { db } = await import("@/server/db");

    const overview = await queries.getResearchOverview();
    expect(overview.sales).toBeGreaterThan(0);

    const facets = await queries.getResearchFacets(DEFAULT_RESEARCH_FILTERS);
    expect(facets.conditions["sem-monta"]).toBeGreaterThan(0);
    expect(facets.categories.carros).toBe(facets.conditions["sem-monta"]);
    expect(facets.models.some((model) => model.label === "Chevrolet Onix")).toBe(true);
    expect(facets.sources.length).toBeGreaterThan(0);
    expect(facets.mileage.known).toBeLessThanOrEqual(facets.mileage.total);
    const [topSource] = facets.sources;
    if (topSource) {
      const bySource = await queries.getResearchFacets({ ...DEFAULT_RESEARCH_FILTERS, source: topSource.id });
      expect(bySource.conditions["sem-monta"]).toBe(topSource.sales);
    }
    const withKm = await queries.getResearchFacets({ ...DEFAULT_RESEARCH_FILTERS, maxKm: 150_000 });
    expect(withKm.conditions["sem-monta"]).toBeLessThanOrEqual(facets.mileage.known);

    const conditions = await queries.getConditionDistribution(DEFAULT_RESEARCH_FILTERS);
    expect(conditions.rows.map((row) => row.condition)).toEqual(["sem-monta", "pequena", "media", "grande", "sucata"]);
    expect(conditions.rows[0]?.summary.kind).toBe("summary");

    const origins = await queries.getOriginDistribution(DEFAULT_RESEARCH_FILTERS);
    expect(origins.rows.map((row) => row.origin)).toEqual([
      "financiamento",
      "seguradora",
      "frota",
      "orgao_publico",
      "outros",
    ]);
    expect(origins.rows.some((row) => row.summary.kind === "summary")).toBe(true);

    const where = await queries.getWhereView(DEFAULT_RESEARCH_FILTERS);
    expect(where.distance.map((row) => row.band)).toEqual(["ate100", "ate300", "mais300", null]);
    expect(where.places.length).toBeGreaterThan(0);

    const map = await queries.getStateMap(DEFAULT_RESEARCH_FILTERS);
    expect(map.states).toHaveLength(27);

    const ranking = await queries.getModelRanking(DEFAULT_RESEARCH_FILTERS);
    expect(ranking.models.length).toBeGreaterThan(0);
    expect(ranking.weeks).toBeGreaterThanOrEqual(1);
    const withAges = ranking.models.find((model) => Object.keys(model.byAge).length > 0);
    expect(withAges?.context.medianBid).toBeGreaterThan(0);

    const onix: ResearchFilters = {
      ...DEFAULT_RESEARCH_FILTERS,
      vehicle: { brand: "CHEVROLET", model: "ONIX" },
      state: "SP",
      metric: "price",
    };
    const [onixMap, detail, sales, curve] = await Promise.all([
      queries.getStateMap(onix),
      queries.getStateDetail(onix),
      queries.getModelSales(onix),
      queries.getBidCurve(DEFAULT_RESEARCH_FILTERS),
    ]);
    expect(onixMap.metric).toBe("price");
    expect(detail?.state).toBe("SP");
    expect(sales?.total).toBeGreaterThan(0);
    expect(curve.points.length).toBeGreaterThan(0);

    // Lances de uma venda: a que tem mais degraus fecha no lance final; id que não é venda dá null.
    const withSteps = sales?.sales.toSorted((x, y) => y.bidSteps - x.bidSteps)[0];
    if (withSteps) {
      const bids = await queries.getSaleBids(withSteps.id);
      expect(bids?.steps.at(-1)?.bid).toBe(withSteps.finalBid);
      expect(bids?.steps.length).toBeGreaterThanOrEqual(1);
    }
    expect(await queries.getSaleBids("00000000-0000-7000-8000-000000000000")).toBeNull();

    // Estado e ano-modelo na barra: contagens por estado, anos do modelo e a faixa de ano no filtro.
    const onixFacets = await queries.getResearchFacets({ ...onix, state: null });
    expect(Object.values(onixFacets.states).reduce((total, n) => total + n, 0)).toBeGreaterThan(0);
    const [newest] = onixFacets.years;
    expect(newest?.sales).toBeGreaterThan(0);
    const inYear = await queries.getModelSales({
      ...onix,
      state: null,
      yearFrom: newest?.year ?? null,
      yearTo: newest?.year ?? null,
    });
    expect(inYear?.total).toBe(newest?.sales);
    expect((await queries.getPriceSummary({ ...onix, state: null })).kind).not.toBe("none");

    // Comparação: modelo × modelo e Brasil × estado, na mesma escala.
    const versus = await queries.getComparison({
      ...DEFAULT_RESEARCH_FILTERS,
      vehicle: { brand: "CHEVROLET", model: "ONIX" },
      compare: { vehicle: { brand: "HYUNDAI", model: "HB20" }, state: null },
    });
    expect(versus?.groups.map((group) => group.label)).toEqual(["Chevrolet Onix", "Hyundai HB20"]);
    const brazilVsState = await queries.getComparison({
      ...DEFAULT_RESEARCH_FILTERS,
      compare: { vehicle: null, state: "SP" },
    });
    expect(brazilVsState?.groups.map((group) => group.label)).toEqual(["Brasil", "São Paulo"]);
    expect(await queries.getComparison(DEFAULT_RESEARCH_FILTERS)).toBeNull();

    // Avaliar: o recorte do domínio sobre as vendas do modelo; as versões ganham o nome da FIPE.
    const evaluation = await queries.getEvaluation(
      { ...DEFAULT_EVALUATE_FILTERS, vehicle: { brand: "CHEVROLET", model: "ONIX" } },
      null,
    );
    expect(evaluation?.answer.kind).toBe("band");
    expect(evaluation?.comparables.length).toBeLessThanOrEqual(evaluation?.modelSales ?? 0);
    const [topVersion] = evaluation?.versions ?? [];
    if (topVersion) expect(evaluation?.versionLabels[topVersion.value]).toBeTruthy();
    expect(await queries.getEvaluation(DEFAULT_EVALUATE_FILTERS, null)).toBeNull();
    const open = await queries.getOpenListingsFor({
      ...DEFAULT_EVALUATE_FILTERS,
      vehicle: { brand: "CHEVROLET", model: "ONIX" },
    });
    expect(open.every((listing) => listing.endsAt === null || listing.endsAt > new Date())).toBe(true);
    expect(await queries.getLotTarget("00000000-0000-7000-8000-000000000000")).toBeNull();
    expect(await queries.getLotMarketReference("00000000-0000-7000-8000-000000000000")).toBeNull();

    await db.$disconnect();
  }, 60_000);
});
