import { describe, expect, it } from "vitest";

import { bps, cents } from "@/domain/money";

import { parseExternalLot } from "./universal";

describe("parseExternalLot", () => {
  it("extrai lote da Copart a partir de texto colado e redige placa/chassi/Renavam", () => {
    const parsed = parseExternalLot({
      url: "https://www.copart.com.br/lot/984512",
      content: `
        TOYOTA COROLLA XEI 2.0 FLEX 2021/2022
        Lote: 984512 · Média Monta · Hodômetro: 48.500 km
        Lance atual: R$ 62.500,00 · Comissão: 5% · Taxa administrativa: R$ 1.850,00
        Pátio: Guarulhos/SP · Leilão em 28/11/2026 14:00
        Placa BRA2E19, Chassi 9BRBD3HE8N0123456, Renavam 01234567890.
      `,
    });

    expect(parsed.parserId).toBe("copart");
    expect(parsed.auctioneer).toBe("Copart Brasil");
    expect(parsed.lotNumber).toBe("984512");
    expect(parsed.brand).toBe("TOYOTA");
    expect(parsed.model).toBe("COROLLA XEI");
    expect(parsed.vehicleVersion).toBe("2.0");
    expect(parsed.manufactureYear).toBe(2021);
    expect(parsed.modelYear).toBe(2022);
    expect(parsed.mileageKm).toBe(48_500);
    expect(parsed.fuel).toBe("Flex");
    expect(parsed.damageLevel).toBe("medium");
    expect(parsed.currentBidCents).toBe(cents(6_250_000));
    expect(parsed.commissionRateBps).toBe(bps(500));
    expect(parsed.otherFeesCents).toBe(cents(185_000));
    expect(parsed.city).toBe("Guarulhos");
    expect(parsed.state).toBe("SP");
    expect(parsed.startsAtIso).toBe("2026-11-28T17:00:00.000Z");
    expect(parsed.confidence).toBe("high");
    expect(parsed.notes).not.toContain("BRA2E19");
    expect(parsed.notes).not.toContain("9BRBD3HE8N0123456");
    expect(parsed.notes).not.toContain("01234567890");
    expect(parsed.notes).toContain("[removido]");
  });

  it("extrai lote via HTML com JSON-LD Vehicle e OpenGraph de leiloeiro genérico", () => {
    const html = `
      <html>
        <head>
          <meta property="og:title" content="HONDA CIVIC EXL 2.0 2020" />
          <meta property="og:description" content="Recuperado de financiamento. Retirada em Campinas/SP." />
          <script type="application/ld+json">
            {
              "@type": "Vehicle",
              "brand": { "name": "Honda" },
              "model": "CIVIC EXL",
              "vehicleModelDate": 2020,
              "mileageFromOdometer": { "value": 72000 },
              "offers": { "price": "58900.00" }
            }
          </script>
        </head>
        <body>Lote nº 45 — Sodré Santoro — Gasolina</body>
      </html>
    `;

    const parsed = parseExternalLot({ url: "https://www.sodresantoro.com.br/lote/45", content: html });
    expect(parsed.parserId).toBe("sodre");
    expect(parsed.auctioneer).toBe("Sodré Santoro");
    expect(parsed.lotNumber).toBe("45");
    expect(parsed.brand).toBe("HONDA");
    expect(parsed.model).toBe("CIVIC EXL");
    expect(parsed.modelYear).toBe(2020);
    expect(parsed.mileageKm).toBe(72_000);
    expect(parsed.currentBidCents).toBe(cents(5_890_000));
    expect(parsed.damageLevel).toBeNull();
    expect(parsed.city).toBe("Campinas");
    expect(parsed.state).toBe("SP");
    expect(parsed.isMotorcycle).toBe(false);
    expect(parsed.confidence).toBe("high");
  });

  it("identifica moto (Yamaha / Fazer) e leiloeiros VIP, Milan, Loop e Palácio", () => {
    const moto = parseExternalLot({
      url: "https://www.vipleiloes.com.br/veiculo/77",
      content: "YAMAHA FAZER FZ25 2023/2024 12.000 km Lance inicial R$ 9.500,00 Sucata",
    });
    expect(moto.parserId).toBe("vip");
    expect(moto.brand).toBe("YAMAHA");
    expect(moto.isMotorcycle).toBe(true);
    expect(moto.damageLevel).toBe("salvage");
    expect(moto.currentBidCents).toBe(cents(950_000));

    expect(
      parseExternalLot({ url: "https://www.milanleiloes.com.br/lote/1", content: "Fiat Argo 2022" }).parserId,
    ).toBe("milan");
    expect(parseExternalLot({ url: "https://www.loopleiloes.com.br/lote/2", content: "VW Polo 2023" }).parserId).toBe(
      "loop",
    );
    expect(
      parseExternalLot({ url: "https://www.palaciodosleiloes.com.br/lote/3", content: "Chevrolet Onix 2021" }).parserId,
    ).toBe("palacio");
  });

  it("retorna baixa confiança para texto insuficiente e ignora URLs com protocolo inseguro", () => {
    const weak = parseExternalLot({ url: "javascript:alert(1)", content: "Lote sem informações do veículo" });
    expect(weak.lotUrl).toBeNull();
    expect(weak.brand).toBeNull();
    expect(weak.confidence).toBe("low");
  });

  it("rejeita data impossível (31/02), decodifica entidades HTML pt-BR e suporta @graph / script truncado", () => {
    const html = `
      <html>
        <head>
          <script type="application/ld+json">
            {
              "@graph": [
                { "@type": "Organization", "name": "Site Exemplo" },
                { "@type": "Vehicle", "brand": "Fiat", "model": "ARGO DRIVE", "vehicleModelDate": 2023 }
              ]
            }
          </script>
        </head>
        <body>Sodr&eacute; Santoro &mdash; M&eacute;dia Monta · 31/02/2026<script>var secret = "nao deve vazar";</body>
      </html>
    `;
    const parsed = parseExternalLot({ content: html });
    expect(parsed.parserId).toBe("sodre");
    expect(parsed.brand).toBe("FIAT");
    expect(parsed.model).toBe("ARGO DRIVE");
    expect(parsed.damageLevel).toBe("medium");
    expect(parsed.startsAtIso).toBeNull();
    expect(parsed.notes).not.toContain("nao deve vazar");
  });
});
