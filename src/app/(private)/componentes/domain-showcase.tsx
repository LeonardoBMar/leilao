import { Card, CardContent, Money, Stat } from "@/components/ui";
import { cents } from "@/domain/money";
import { CatalogAuctionCard } from "@/features/listings/components/catalog-auctions-view";
import { ListingCard } from "@/features/listings/components/listing-card";
import type { CatalogAuctionItem, ListingListItem } from "@/features/listings/types";
import { BidLimitPanel } from "@/features/lots/components/bid-limit-panel";
import { LimitProgress } from "@/features/lots/components/limit-progress";
import type { LotDetail, LotLimit } from "@/features/lots/types";

/*
 * Componentes de domínio com dados fixos de exemplo. Os ids não existem: ações (como atualizar o lance) respondem
 * "não encontrado".
 */
const FIXED_AT = new Date("2026-10-01T13:00:00Z");
const ENDS_AT = new Date("2026-10-14T17:00:00Z");

const limit: LotLimit = { isViable: true, maxBid: cents(4_200_000), version: 2, fixedAt: FIXED_AT };

const listing: ListingListItem = {
  id: "00000000-0000-7000-8000-000000000001",
  sourceName: "Leilo",
  url: "https://example.com/lote/152",
  lotNumber: "152",
  title: "TOYOTA COROLLA XEI 2.0",
  modelYear: 2020,
  mileageKm: 84_000,
  fuel: "Flex",
  recoveryType: null,
  damageLevel: "small",
  conditionFlags: [],
  inspection: null,
  inspectionNotes: null,
  city: "Araraquara",
  state: "SP",
  distanceKm: 38,
  auctionName: "Leilão de veículos de financeiras",
  endsAt: ENDS_AT,
  status: "open",
  currentBid: cents(3_150_000),
  minimumBid: cents(2_500_000),
  bidCount: 12,
  finalBid: null,
  marketValue: cents(9_800_000),
  marketValueOrigin: "source",
  marketValueRefMonth: null,
  photoUrl: null,
  trackable: true,
  trackedLotId: "00000000-0000-7000-8000-000000000002",
  estimate: {
    price: {
      kind: "comparables",
      level: "family",
      sameOrigin: false,
      confidence: "medium",
      saleIds: [],
      n: 7,
      median: cents(3_900_000),
      low: cents(3_600_000),
      high: cents(4_100_000),
    },
    limit: { kind: "estimated", n: 4, maxBid: cents(4_200_000), marketValueFrom: "listing" },
    fit: "comfortable",
  },
};

const auction: CatalogAuctionItem = {
  sourceId: "leilo",
  externalId: "exemplo",
  name: "Leilão de veículos de financeiras",
  sourceName: "Leilo",
  auctionStartsAt: ENDS_AT,
  firstStartsAt: null,
  firstEndsAt: ENDS_AT,
  total: 120,
  open: 96,
  matching: 14,
  analyzed: 2,
  date: ENDS_AT,
  isOpen: true,
};

const lot: LotDetail = {
  id: "00000000-0000-7000-8000-000000000002",
  lotNumber: "152",
  brand: "TOYOTA",
  model: "COROLLA XEI 2.0",
  vehicleVersion: null,
  modelYear: 2020,
  isFollowed: true,
  currentBid: cents(3_150_000),
  currentBidObservedAt: FIXED_AT,
  archivedAt: null,
  auction: {
    id: "00000000-0000-7000-8000-000000000003",
    name: "Leilão de exemplo",
    startsAt: ENDS_AT,
    archivedAt: null,
  },
  limit,
  openDraftId: null,
  hasResult: false,
  manufactureYear: 2019,
  mileageKm: 84_000,
  startingBid: null,
  lotUrl: null,
  notes: null,
  fixedAnalysisCount: 1,
  resultCount: 0,
  updatedAt: FIXED_AT,
  tracking: {
    sourceName: "Leilo",
    lastCheckedAt: FIXED_AT,
    endsAt: ENDS_AT,
    market: { value: cents(9_800_000), origin: "source", refMonth: null },
    price: listing.estimate?.price ?? null,
    fit: "comfortable",
    bidSteps: [
      { observedAt: new Date("2026-10-11T15:00:00Z"), bid: cents(2_600_000) },
      { observedAt: new Date("2026-10-12T03:00:00Z"), bid: cents(2_900_000) },
      { observedAt: FIXED_AT, bid: cents(3_150_000) },
    ],
  },
};

export function DomainShowcase() {
  return (
    <div className="grid min-w-0 gap-10 [&>section]:min-w-0">
      <section aria-labelledby="stat-title" className="grid gap-5">
        <div>
          <h2 id="stat-title" className="text-heading-3">
            Rótulo e valor
          </h2>
          <p className="mt-1 text-body text-foreground-secondary">
            <code>Stat</code> em grade (fichas e números) e <code>DataRow</code> em linhas (resumos).
          </p>
        </div>
        <Card>
          <CardContent>
            <dl className="grid gap-6 sm:grid-cols-4">
              <Stat label="Data e hora">14/10/2026, 14:00</Stat>
              <Stat label="Mercado (da fonte)" size="lg">
                <Money value={cents(9_800_000)} />
              </Stat>
              <Stat label="Preço final" size="heading-3">
                <Money value={cents(3_950_000)} />
              </Stat>
              <Stat label="Meu limite" size="heading-2" note="v2 · fixada em 01/10/2026">
                <Money value={limit.maxBid} />
              </Stat>
            </dl>
          </CardContent>
        </Card>
      </section>

      <section aria-labelledby="limit-title" className="grid gap-5">
        <h2 id="limit-title" className="text-heading-3">
          Lance frente ao limite
        </h2>
        <Card>
          <CardContent className="grid max-w-80 gap-5">
            <LimitProgress limit={limit} bid={cents(3_150_000)} />
            <LimitProgress limit={limit} bid={cents(4_100_000)} />
            <LimitProgress limit={limit} bid={cents(4_600_000)} />
            <LimitProgress limit={null} bid={cents(3_150_000)} />
          </CardContent>
        </Card>
        <BidLimitPanel lot={lot} bidNote="Atualizado pelo coletor em 01/10/2026" />
      </section>

      <section aria-labelledby="listing-title" className="grid gap-5">
        <h2 id="listing-title" className="text-heading-3">
          Anúncio e leilão do catálogo
        </h2>
        <div className="grid gap-6 md:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
          <ListingCard item={listing} />
          <div className="grid content-start gap-6">
            <ListingCard item={listing} compact />
            <CatalogAuctionCard item={auction} params={{}} />
          </div>
        </div>
      </section>
    </div>
  );
}
