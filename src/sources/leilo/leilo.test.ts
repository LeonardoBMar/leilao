import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { finalBidOf } from "@/domain/listings/collect";
import { isFinalStatus } from "@/domain/listings/types";

import { listingContractProblems } from "../shared/contract";
import { parseLeiloSitemap } from "./discover";
import { leiloDetailsFromRaw, leiloListingUrl, parseLeiloListingPage } from "./parse";

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

  it("cumpre o contrato comum dos adaptadores", () => {
    expect(
      listingContractProblems(listing, { externalId: listing.externalId, url: leiloListingUrl(listing.externalId) }),
    ).toEqual([]);
  });

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

describe("parseLeiloListingPage — condição declarada pelo leiloeiro", () => {
  const withNotes = (html: string, descricao: string, laudo = "AUSENTE") =>
    html
      .replace(/"descricao":"[^"]*"/, `"descricao":"${descricao}"`)
      .replace(/"laudoCautelarResultado":"[^"]*"/, `"laudoCautelarResultado":"${laudo}"`);

  it("lote sem classificação: descrição guardada, nada deduzido", () => {
    const listing = parseOk(soldPage);
    expect(listing.description).toMatch(/^IPVA 2026 PAGO \/ REMOCAO R\$ 400/);
    expect(listing.condition).toEqual({ damageLevel: null, flags: [], inspection: null, inspectionNotes: null });
  });

  it("lê monta, marcações e laudo cautelar", () => {
    const listing = parseOk(withNotes(soldPage, "   MEDIA MONTA / CIRCULACAO VEDADA", "APROVADO COM OBSERVAÇÕES"));
    expect(listing.condition).toMatchObject({
      damageLevel: "medium",
      flags: ["circulation_banned"],
      inspection: "approved_with_notes",
    });
  });

  it("categoria Sucatas é sucata mesmo sem o termo na descrição", () => {
    const listing = parseOk(soldPage.replace(/"tipo":"[^"]*"/, `"tipo":"Sucatas"`));
    expect(listing.condition.damageLevel).toBe("salvage");
  });

  it("rederiva do dado bruto guardado o mesmo que a coleta extraiu", () => {
    const listing = parseOk(withNotes(openPage, "PEQUENA MONTA / POSSUI GNV", "REPROVADO"));
    expect(leiloDetailsFromRaw(listing.raw, now)).toEqual({
      description: listing.description,
      condition: listing.condition,
      status: listing.status,
      sourceStatus: listing.sourceStatus,
    });
    expect(leiloDetailsFromRaw({ nome: "sem id" }, now)).toBeNull();
  });
});

describe("parseLeiloListingPage — desfechos do leilão de 28/09/2026", () => {
  const after = new Date("2026-09-29T12:00:00Z");

  it.each([
    ["lote-aguardando-pagamento.html", "AgPagamento", "sold", 1_440_000],
    ["lote-condicional.html", "Condicional", "conditional", 4_200_000],
    ["lote-condicional-negada.html", "CondicionalNegada", "unsold", 4_450_000],
    ["lote-nao-arrematado.html", "NaoArrematado", "unsold", null],
  ] as const)("%s: %s vira %s, com o lance final do encerramento", (file, situacao, status, finalBid) => {
    const listing = parseOk(fixture(file), after);
    expect(listing.sourceStatus).toBe(situacao);
    expect(listing.status).toBe(status);
    expect(finalBidOf(listing)).toBe(finalBid);
  });

  it("sem lance, não arrematado não tem lance atual (o inicial fica como referência)", () => {
    const listing = parseOk(fixture("lote-nao-arrematado.html"), after);
    expect(listing.currentBid).toBeNull();
    expect(listing.minimumBid).toBe(100_000);
  });

  it("condicional segue sendo revisitado; vendido e não vendido não", () => {
    expect(isFinalStatus(parseOk(fixture("lote-condicional.html"), after).status)).toBe(false);
    expect(isFinalStatus(parseOk(fixture("lote-aguardando-pagamento.html"), after).status)).toBe(true);
    expect(isFinalStatus(parseOk(fixture("lote-condicional-negada.html"), after).status)).toBe(true);
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
