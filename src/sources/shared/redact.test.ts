import { describe, expect, it } from "vitest";

import { redactVehicleIds } from "./redact";

describe("redactVehicleIds", () => {
  it("apaga placa completa (antiga e Mercosul), chassi e Renavam", () => {
    const text =
      "Veículo Hyundai/Elantra GLSR, placa CED-8398, gasolina, chassi KMHJF31RPSU925302 e renavam 00649734696. " +
      "Outro: PLACA: BRA2E19, RENAVAM Nº: 12345678901";
    expect(redactVehicleIds(text)).toBe(
      "Veículo Hyundai/Elantra GLSR, placa [removido], gasolina, chassi [removido] e renavam [removido]. " +
        "Outro: PLACA: [removido], RENAVAM Nº: [removido]",
    );
  });

  it("mantém placa já mascarada pela fonte, anos, valores e modelos", () => {
    const text =
      "I/BYD DOLPHIN MINI GS EV, 24/25, PLACA: E__-___2, ELETR/FONTE EXT, PRETA - R$ 2.350,00 - IVECO 30S13CS";
    expect(redactVehicleIds(text)).toBe(text);
  });
});
