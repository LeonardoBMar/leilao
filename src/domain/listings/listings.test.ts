import { describe, expect, it } from "vitest";

import { boundingBox, distanceKm } from "./geo";
import { municipalityKey, normalizePlaceName, splitBrandModel } from "./place";
import { DEFAULT_REGION } from "./region";
import {
  AFTER_END_DELAY_MS,
  GIVE_UP_AFTER_END_MS,
  MAX_CHECK_FAILURES,
  nextCheckAt,
  OPEN_REFRESH_MS,
  PENDING_REFRESH_MS,
  retryAfterFailure,
} from "./schedule";

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

  it("o retângulo de pré-filtro contém todo o círculo", () => {
    const box = boundingBox(saoCarlos, 150);
    const north = { latitude: box.maxLatitude, longitude: saoCarlos.longitude };
    const east = { latitude: saoCarlos.latitude, longitude: box.maxLongitude };
    expect(distanceKm(saoCarlos, north)).toBeGreaterThanOrEqual(150 - 1e-6);
    expect(distanceKm(saoCarlos, east)).toBeGreaterThanOrEqual(150);
    // Ponto do círculo no lado mais distante do equador (sul) cabe na largura do retângulo.
    const southEdge = { latitude: box.minLatitude + 0.3, longitude: saoCarlos.longitude };
    const southEast = { latitude: southEdge.latitude, longitude: box.maxLongitude };
    expect(distanceKm(saoCarlos, southEast)).toBeGreaterThan(150);
  });
});

describe("nextCheckAt — agenda de revisitas", () => {
  const now = at("2026-09-27T12:00:00Z");
  const endsAt = at("2026-09-28T14:00:00Z");

  it("desfecho definitivo não é revisitado", () => {
    for (const status of ["sold", "unsold", "withdrawn"] as const) {
      expect(nextCheckAt({ status, endsAt, inRegion: true, now })).toBeNull();
    }
  });

  it("aberto na região: atualiza o lance a cada 6 h", () => {
    expect(nextCheckAt({ status: "open", endsAt, inRegion: true, now })).toEqual(plus(now, OPEN_REFRESH_MS));
  });

  it("aberto na região perto do fim: volta 1 h depois do fim, não antes", () => {
    const nearEnd = at("2026-09-28T12:00:00Z");
    expect(nextCheckAt({ status: "open", endsAt, inRegion: true, now: nearEnd })).toEqual(
      plus(endsAt, AFTER_END_DELAY_MS),
    );
  });

  it("aberto fora da região: só volta depois do fim, para gravar o arremate", () => {
    expect(nextCheckAt({ status: "open", endsAt, inRegion: false, now })).toEqual(plus(endsAt, AFTER_END_DELAY_MS));
  });

  it("condicional ou ainda aberto depois do fim: revisita diária", () => {
    const afterEnd = plus(endsAt, 3 * AFTER_END_DELAY_MS);
    expect(nextCheckAt({ status: "conditional", endsAt, inRegion: false, now: afterEnd })).toEqual(
      plus(afterEnd, PENDING_REFRESH_MS),
    );
    expect(nextCheckAt({ status: "open", endsAt, inRegion: true, now: afterEnd })).toEqual(
      plus(afterEnd, PENDING_REFRESH_MS),
    );
  });

  it("desiste depois de 14 dias do fim sem desfecho definitivo", () => {
    const late = plus(endsAt, GIVE_UP_AFTER_END_MS + 1);
    expect(nextCheckAt({ status: "unknown", endsAt, inRegion: true, now: late })).toBeNull();
  });

  it("sem data de fim: 6 h na região, diário fora dela", () => {
    expect(nextCheckAt({ status: "open", endsAt: null, inRegion: true, now })).toEqual(plus(now, OPEN_REFRESH_MS));
    expect(nextCheckAt({ status: "open", endsAt: null, inRegion: false, now })).toEqual(plus(now, PENDING_REFRESH_MS));
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
