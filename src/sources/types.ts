import type { ListingInput } from "@/domain/listings/types";
import type { Result } from "@/lib/result";

/** Anúncio encontrado na descoberta (sitemap ou lista da fonte), antes de baixar a página. */
export type DiscoveredListing = { externalId: string; url: string; lastModified: Date | null };

export type ListingDetails = Pick<ListingInput, "description" | "condition" | "status" | "sourceStatus">;

/** Página sem os dados esperados (a fonte mudou o formato) ou com dados inválidos. */
export type ParseError = "missing_data" | "invalid_data";

/** Resposta de uma requisição à fonte. `status` nulo: erro de rede ou tempo esgotado. */
export type FetchOutcome = { ok: true; text: string } | { ok: false; status: number | null; error: string };

/**
 * Acesso à fonte que o coletor entrega ao adaptador (D-37): uma requisição por vez, com intervalo mínimo,
 * identificação e novas tentativas (`src/server/collector/http.ts`). O adaptador decide **quais** requisições faz;
 * **como** elas são feitas é sempre do coletor, igual para todas as fontes.
 */
export type SourceHttp = {
  get: (url: string) => Promise<FetchOutcome>;
  /** Formulário (`application/x-www-form-urlencoded`), como as consultas internas de alguns sites. */
  post: (url: string, form: Readonly<Record<string, string>>) => Promise<FetchOutcome>;
};

/**
 * Resultado da descoberta. `complete`: a lista inteira foi lida; só então "não visto agora" significa
 * "saiu da lista da fonte" (`goneStatus`). Falhas parciais vão em `errors` e não impedem o resto.
 */
export type Discovery = { listings: DiscoveredListing[]; complete: boolean; errors: { url: string; error: string }[] };

/**
 * Leitura de um anúncio. `gone`: a fonte diz que a página não existe mais (HTTP 404, redireciona para outro anúncio ou
 * equivalente); o coletor decide
 * se isso é desfecho (anúncio encerrado) ou falha (`goneStatus`).
 */
export type ListingFetch = { ok: true; value: ListingInput } | { ok: false; gone: boolean; error: string };

/**
 * Contrato de um adaptador de fonte (D-27, D-37). Uma fonte nova é um adaptador novo, registrado em `./index.ts`;
 * o coletor não muda. O adaptador não importa rede nem banco: recebe `SourceHttp` e devolve dado validado no
 * formato único (`ListingInput`), que o coletor confere com `listingContractProblems` antes de gravar.
 */
export type SourceAdapter = {
  /** Igual a `sources.id` no banco (o coletor cadastra a fonte na primeira execução). */
  id: string;
  /** Nome exibido no app (ex.: leiloeiro do lote criado por "Adicionar à análise"). */
  name: string;
  baseUrl: string;
  /**
   * Teto próprio de anúncios lidos por execução, abaixo do geral (`--max-visits`), para a fonte que gasta mais
   * requisições por anúncio caber no tempo do job agendado.
   */
  maxVisitsPerRun?: number;
  /** URL canônica do anúncio, para revisitar depois que ele sai da lista da fonte. */
  listingUrl: (externalId: string) => string;
  /** Lista os anúncios disponíveis agora. */
  discover: (http: SourceHttp, now: Date) => Promise<Discovery>;
  /** Baixa e lê um anúncio. `now` decide se um anúncio com situação desconhecida já deveria ter encerrado. */
  fetchListing: (http: SourceHttp, externalId: string, now: Date) => Promise<ListingFetch>;
  /**
   * Rederiva do dado bruto já guardado (`listings.raw`) campos cuja extração mudou depois da coleta (descrição,
   * condição, situação), sem baixar a página. Serve também quando a página já saiu do ar.
   * `null`: o dado bruto não tem a forma esperada.
   */
  detailsFromRaw: (raw: unknown, now: Date) => ListingDetails | null;
};

/** Lê uma página já baixada; `ParseError` vira mensagem de falha da execução. */
export type PageParser = (html: string, now: Date) => Result<ListingInput, ParseError>;
