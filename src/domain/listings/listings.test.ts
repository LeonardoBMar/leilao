import { describe, expect, it } from "vitest";

import { distanceKm } from "./geo";
import { municipalityKey, normalizePlaceName, splitBrandModel, stateCode } from "./place";
import { DEFAULT_REGION, resolveRegion } from "./region";
import {
  AFTER_END_DELAY_MS,
  GIVE_UP_AFTER_END_MS,
  MAX_CHECK_FAILURES,
  nextCheckAt,
  OPEN_REFRESH_MS,
  PENDING_REFRESH_MS,
  retryAfterFailure,
} from "./schedule";
import { toListingCategory } from "./types";

describe("toListingCategory", () => {
  it("só aceita o vocabulário comum, escrito igual; o resto vira null (não se adivinha)", () => {
    expect(toListingCategory("Carros")).toBe("Carros");
    expect(toListingCategory("Utilitarios")).toBe("Utilitarios");
    expect(toListingCategory("Automóveis")).toBeNull();
    expect(toListingCategory("carros")).toBeNull();
    expect(toListingCategory(null)).toBeNull();
    expect(toListingCategory(undefined)).toBeNull();
  });
});

const at = (iso: string) => new Date(iso);
const plus = (date: Date, ms: number) => new Date(date.getTime() + ms);

describe("normalizePlaceName", () => {
  it.each([
    ["São Carlos", "SAO CARLOS"],
    ["SÃO CARLOS", "SAO CARLOS"],
    ["  são   carlos ", "SAO CARLOS"],
    ["Santa Bárbara d'Oeste", "SANTA BARBARA DOESTE"],
    ["Embu-Guaçu", "EMBU GUACU"],
  ])("%s → %s", (input, expected) => {
    expect(normalizePlaceName(input)).toBe(expected);
  });
});

describe("stateCode", () => {
  it("aceita nome por extenso (com ou sem acento) ou sigla; o resto é null", () => {
    expect(stateCode("SÃO PAULO")).toBe("SP");
    expect(stateCode("Espírito Santo")).toBe("ES");
    expect(stateCode("mato grosso do sul")).toBe("MS");
    expect(stateCode("pr")).toBe("PR");
    expect(stateCode("ÁGUA FRIA")).toBeNull();
  });
});

describe("municipalityKey", () => {
  it("normaliza nome e UF", () => {
    expect(municipalityKey("São Carlos", "sp")).toBe("SAO CARLOS|SP");
  });

  it("no DF, a região administrativa vira Brasília (único município do IBGE)", () => {
    expect(municipalityKey("TAGUATINGA", "DF")).toBe("BRASILIA|DF");
    expect(municipalityKey("Brasília", "DF")).toBe("BRASILIA|DF");
  });
});

describe("splitBrandModel", () => {
  it("separa marca e modelo pela primeira barra", () => {
    expect(splitBrandModel("HYUNDAI/HB20 COMFORT (4P)")).toEqual({ brand: "HYUNDAI", model: "HB20 COMFORT (4P)" });
    expect(splitBrandModel("VW/GOL 1.0 (2P/4P)")).toEqual({ brand: "VW", model: "GOL 1.0 (2P/4P)" });
  });

  it("sem barra não inventa marca", () => {
    expect(splitBrandModel("MOTONIVELADORA 120K")).toEqual({ brand: null, model: "MOTONIVELADORA 120K" });
    expect(splitBrandModel("/SEM MARCA")).toEqual({ brand: null, model: "/SEM MARCA" });
    expect(splitBrandModel("   ")).toEqual({ brand: null, model: null });
  });
});

describe("distanceKm", () => {
  const saoCarlos = DEFAULT_REGION.center;

  it("é zero no mesmo ponto e simétrica", () => {
    const araraquara = { latitude: -21.7845, longitude: -48.178 };
    expect(distanceKm(saoCarlos, saoCarlos)).toBe(0);
    expect(distanceKm(saoCarlos, araraquara)).toBeCloseTo(distanceKm(araraquara, saoCarlos), 9);
  });

  it("São Carlos → Araraquara ≈ 39 km e → São Paulo ≈ 200 km, em linha reta", () => {
    expect(distanceKm(saoCarlos, { latitude: -21.7845, longitude: -48.178 })).toBeCloseTo(39.4, 0);
    expect(distanceKm(saoCarlos, { latitude: -23.5329, longitude: -46.6395 })).toBeCloseTo(207, -1);
  });
});

describe("resolveRegion", () => {
  const campinas = {
    ibgeCode: 3509502,
    name: "Campinas",
    state: "SP",
    latitude: -22.9056,
    longitude: -47.0608,
  };

  it("sem override ou com campos nulos volta exatamente para DEFAULT_REGION", () => {
    expect(resolveRegion()).toEqual(DEFAULT_REGION);
    expect(resolveRegion(null)).toEqual(DEFAULT_REGION);
    expect(resolveRegion({ municipality: null, radiusKm: null })).toEqual(DEFAULT_REGION);
  });

  it("sobrescreve apenas o raio mantendo o município padrão", () => {
    expect(resolveRegion({ radiusKm: 250 })).toEqual({
      ...DEFAULT_REGION,
      radiusKm: 250,
    });
  });

  it("sobrescreve o município e usa o raio padrão quando raio não informado", () => {
    expect(resolveRegion({ municipality: campinas })).toEqual({
      label: "Campinas/SP",
      ibgeCode: 3509502,
      center: { latitude: -22.9056, longitude: -47.0608 },
      radiusKm: DEFAULT_REGION.radiusKm,
    });
  });

  it("sobrescreve município e raio juntos", () => {
    expect(resolveRegion({ municipality: campinas, radiusKm: 80 })).toEqual({
      label: "Campinas/SP",
      ibgeCode: 3509502,
      center: { latitude: -22.9056, longitude: -47.0608 },
      radiusKm: 80,
    });
  });
});

describe("nextCheckAt — agenda de revisitas", () => {
  const now = at("2026-09-27T12:00:00Z");
  const endsAt = at("2026-09-28T14:00:00Z");

  it("desfecho definitivo não é revisitado", () => {
    for (const status of ["sold", "unsold", "withdrawn"] as const) {
      expect(nextCheckAt({ status, endsAt, inRegion: true, hasPhotos: true, now })).toBeNull();
    }
  });

  it("aberto na região: atualiza o lance a cada 6 h", () => {
    expect(nextCheckAt({ status: "open", endsAt, inRegion: true, hasPhotos: true, now })).toEqual(
      plus(now, OPEN_REFRESH_MS),
    );
  });

  it("aberto na região perto do fim: volta 1 h depois do fim, não antes", () => {
    const nearEnd = at("2026-09-28T12:00:00Z");
    expect(nextCheckAt({ status: "open", endsAt, inRegion: true, hasPhotos: true, now: nearEnd })).toEqual(
      plus(endsAt, AFTER_END_DELAY_MS),
    );
  });

  it("aberto fora da região: só volta depois do fim, para gravar o arremate", () => {
    expect(nextCheckAt({ status: "open", endsAt, inRegion: false, hasPhotos: true, now })).toEqual(
      plus(endsAt, AFTER_END_DELAY_MS),
    );
  });

  it("aberto fora da região ainda sem foto: volta todo dia até as fotos aparecerem", () => {
    expect(nextCheckAt({ status: "open", endsAt, inRegion: false, hasPhotos: false, now })).toEqual(
      plus(now, PENDING_REFRESH_MS),
    );
    const nearEnd = at("2026-09-28T12:00:00Z");
    expect(nextCheckAt({ status: "open", endsAt, inRegion: false, hasPhotos: false, now: nearEnd })).toEqual(
      plus(endsAt, AFTER_END_DELAY_MS),
    );
  });

  it("condicional ou ainda aberto depois do fim: revisita diária", () => {
    const afterEnd = plus(endsAt, 3 * AFTER_END_DELAY_MS);
    expect(nextCheckAt({ status: "conditional", endsAt, inRegion: false, hasPhotos: true, now: afterEnd })).toEqual(
      plus(afterEnd, PENDING_REFRESH_MS),
    );
    expect(nextCheckAt({ status: "open", endsAt, inRegion: true, hasPhotos: true, now: afterEnd })).toEqual(
      plus(afterEnd, PENDING_REFRESH_MS),
    );
  });

  it("desiste depois de 14 dias do fim sem desfecho definitivo", () => {
    const late = plus(endsAt, GIVE_UP_AFTER_END_MS + 1);
    expect(nextCheckAt({ status: "unknown", endsAt, inRegion: true, hasPhotos: true, now: late })).toBeNull();
  });

  it("sem data de fim: 6 h na região, diário fora dela", () => {
    expect(nextCheckAt({ status: "open", endsAt: null, inRegion: true, hasPhotos: true, now })).toEqual(
      plus(now, OPEN_REFRESH_MS),
    );
    expect(nextCheckAt({ status: "open", endsAt: null, inRegion: false, hasPhotos: true, now })).toEqual(
      plus(now, PENDING_REFRESH_MS),
    );
  });
});

describe("retryAfterFailure", () => {
  const now = at("2026-09-27T12:00:00Z");
  const hours = (n: number) => plus(now, n * 60 * 60 * 1000);

  it("espera 1 h, 2 h, 4 h… e desiste no limite", () => {
    expect(retryAfterFailure(1, now)).toEqual(hours(1));
    expect(retryAfterFailure(2, now)).toEqual(hours(2));
    expect(retryAfterFailure(3, now)).toEqual(hours(4));
    expect(retryAfterFailure(MAX_CHECK_FAILURES, now)).toBeNull();
  });
});
