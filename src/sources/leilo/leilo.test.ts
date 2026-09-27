import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { parseLeiloSitemap } from "./discover";
import { leiloListingUrl, parseLeiloListingPage } from "./parse";

const fixture = (name: string) => readFileSync(join(import.meta.dirname, "fixtures", name), "utf8");
const soldPage = fixture("lote-vendido.html");
const openPage = fixture("lote-aberto.html");
const now = new Date("2026-09-27T12:00:00Z");

/** Página sem o estado serializado: sobra só o JSON-LD. */
const withoutState = (html: string) => html.replace(/<script>window\.__INITIAL_STATE__[\s\S]*?<\/script>/, "");
const withSituacao = (html: string, situacao: string) => html.replace(/"situacao":"[^"]*"/, `"situacao":"${situacao}"`);

function parseOk(html: string, at = now) {
  const result = parseLeiloListingPage(html, at);
  if (!result.ok) throw new Error(`parse falhou: ${result.error}`);
  return result.value;
}

describe("parseLeiloListingPage — lote vendido (lote 64, 21/09/2026)", () => {
  const listing = parseOk(soldPage);

  it("identifica o lote pela URL canônica", () => {
    expect(listing.externalId).toBe("0e06aced-c58f-452b-9050-661048524204");
    expect(listing.url).toBe("https://leilo.com.br/lote/0e06aced-c58f-452b-9050-661048524204/");
    expect(listing.lotNumber).toBe("64");
  });

  it("lê o veículo, preferindo o nome completo do combustível do JSON-LD", () => {
    expect(listing.title).toBe("HYUNDAI/HB20 COMFORT (4P)");
    expect(listing.vehicle).toMatchObject({
      brand: "HYUNDAI",
      model: "HB20 COMFORT (4P)",
      fipeCode: "015088-6",
      modelYear: 2014,
      manufactureYear: 2014,
      mileageKm: 15908,
      fuel: "Flex",
      color: "Branca",
      category: "Carros",
      recoveryType: "Recuperado de Financiamento",
      hasKey: true,
    });
  });

  it("registra o arremate: vendido, lance final e número de lances, em centavos", () => {
    expect(listing.status).toBe("sold");
    expect(listing.sourceStatus).toBe("Pago");
    expect(listing.currentBid).toBe(2_390_000);
    expect(listing.bidCount).toBe(4);
    expect(listing.minimumBid).toBe(2_270_000);
    expect(listing.endsAt).toEqual(new Date("2026-09-21T18:32:08.000Z"));
  });

  it("guarda valor de mercado e custos da fonte (sugestão rotulada, D-30)", () => {
    expect(listing.marketValue).toBe(4_124_700);
    expect(listing.costs).toEqual({
      commissionRate: 500,
      dispatcherFee: 5_000,
      removalFee: 40_000,
      storageFee: 235_000,
      inspectionFee: 0,
      otherFees: 0,
    });
  });

  it("lê pátio, leilão e vendedor", () => {
    expect(listing.location).toMatchObject({ yardName: "PATIO SAO CARLOS-SP", city: "SÃO CARLOS", state: "SP" });
    expect(listing.auction.name).toBe("LEILÃO DE VEÍCULOS SUL_SUDESTE - 21.09.26");
    expect(listing.sellerName).toBe("CREDITAS SOLUCOES FINANCEIRAS LTDA");
  });

  it("guarda fotos à parte e o original sem quem deu lance", () => {
    expect(listing.photoUrls).toHaveLength(3);
    expect(listing.photoUrls.every((url) => url.startsWith("https://"))).toBe(true);
    const raw = JSON.stringify(listing.raw);
    expect(raw).not.toContain("fotosUrls");
    expect(raw).not.toContain("apelido");
    expect(raw).toContain('"situacao":"Pago"');
  });
});

describe("parseLeiloListingPage — lote aberto sem lances", () => {
  const listing = parseOk(openPage);

  it("fica aberto, sem lance atual, com o lance inicial", () => {
    expect(listing.status).toBe("open");
    expect(listing.sourceStatus).toBe("LiberadoLeilao");
    expect(listing.currentBid).toBeNull();
    expect(listing.bidCount).toBeNull();
    expect(listing.minimumBid).toBe(4_000_000);
    expect(listing.endsAt).toEqual(new Date("2026-09-28T14:33:30.000Z"));
  });
});

describe("parseLeiloListingPage — situação desconhecida não é adivinhada", () => {
  it("antes do fim: aberto; depois do fim: desconhecido", () => {
    const page = withSituacao(openPage, "SituacaoNova");
    expect(parseOk(page).status).toBe("open");
    const listing = parseOk(page, new Date("2026-09-29T12:00:00Z"));
    expect(listing.status).toBe("unknown");
    expect(listing.sourceStatus).toBe("SituacaoNova");
  });
});

describe("parseLeiloListingPage — reserva pelo JSON-LD", () => {
  it("sem o estado da página, lê o núcleo e não inventa lance", () => {
    const listing = parseOk(withoutState(openPage));
    expect(listing.externalId).toBe("c47ca240-ac53-472c-9aaf-f8a45364eba9");
    expect(listing.vehicle).toMatchObject({ brand: "CHEVROLET", model: "ONIX 10TMT LT1", modelYear: 2022 });
    expect(listing.location).toMatchObject({ city: "SÃO CARLOS", state: "SP" });
    expect(listing.status).toBe("open");
    expect(listing.sourceStatus).toBe("ld:InStock");
    expect(listing.currentBid).toBeNull();
  });

  it("vendido só pelo JSON-LD fica desconhecido: SoldOut não diz se foi venda ou condicional", () => {
    const listing = parseOk(withoutState(soldPage));
    expect(listing.status).toBe("unknown");
    expect(listing.sourceStatus).toBe("ld:SoldOut");
  });
});

describe("parseLeiloListingPage — dados estranhos da fonte não derrubam a coleta", () => {
  it("valor que não cabe em centavos vira desconhecido, sem lançar", () => {
    const page = soldPage.replace('"valorMercado":41247', '"valorMercado":1e12');
    expect(parseOk(page).marketValue).toBeNull();
  });

  it("ano fora da faixa vira desconhecido (o banco recusaria)", () => {
    const page = soldPage.replace('"anoFabricacao":2014', '"anoFabricacao":20140');
    expect(parseOk(page).vehicle.manufactureYear).toBeNull();
  });

  it("foto de outra origem é descartada: só o CDN liberado na CSP", () => {
    const page = soldPage.replace(
      "https://leilo.cdndp.com.br/v1/arquivo/2026/9/18/1789736490563",
      "https://outro-site.example/v1/arquivo/2026/9/18/1789736490563",
    );
    expect(parseOk(page).photoUrls).toHaveLength(2);
  });

  it("reserva sem o id do lote na URL é recusada, não inventa id", () => {
    const page = withoutState(openPage).replaceAll(
      "https://leilo.com.br/lote/c47ca240-ac53-472c-9aaf-f8a45364eba9/",
      "https://leilo.com.br/busca/",
    );
    expect(parseLeiloListingPage(page, now)).toEqual({ ok: false, error: "invalid_data" });
  });
});

describe("parseLeiloListingPage — página fora do formato", () => {
  it("sem estado nem JSON-LD: dados ausentes", () => {
    expect(parseLeiloListingPage("<html><body>Manutenção</body></html>", now)).toEqual({
      ok: false,
      error: "missing_data",
    });
  });

  it("estado sem o lote válido e sem JSON-LD: dados inválidos", () => {
    const html = '<script>window.__INITIAL_STATE__={"elastic":{"lotePaginaAtualData":{"nome":"X"}}}</script>';
    expect(parseLeiloListingPage(html, now)).toEqual({ ok: false, error: "invalid_data" });
  });
});

describe("parseLeiloSitemap", () => {
  it("lê os lotes com a última alteração", () => {
    const found = parseLeiloSitemap(fixture("sitemap-lotes.xml"));
    expect(found).toHaveLength(3);
    expect(found[0]).toEqual({
      externalId: "c8315b79-7e0c-4c8b-a336-dd8ac8788014",
      url: "https://leilo.com.br/lote/c8315b79-7e0c-4c8b-a336-dd8ac8788014/",
      lastModified: new Date("2026-09-26T19:23:50.000Z"),
    });
  });

  it("ignora o que não é lote e não repete o mesmo lote", () => {
    const id = "0e06aced-c58f-452b-9050-661048524204";
    const xml = `<urlset>
      <url><loc>https://leilo.com.br/leilao/sao-paulo/</loc></url>
      <url><loc>${leiloListingUrl(id)}</loc><lastmod>data-invalida</lastmod></url>
      <url><loc>${leiloListingUrl(id)}</loc></url>
    </urlset>`;
    expect(parseLeiloSitemap(xml)).toEqual([{ externalId: id, url: leiloListingUrl(id), lastModified: null }]);
  });
});
