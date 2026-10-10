import { ExternalLink, Pencil } from "lucide-react";
import { notFound } from "next/navigation";

import { BreadcrumbLink, BreadcrumbPage, Breadcrumbs } from "@/components/layout/breadcrumbs";
import { PageHeader } from "@/components/layout/page-header";
import { Alert, AlertDescription, Badge, ButtonLink, Section, SectionTitle, Skeleton } from "@/components/ui";
import { formatDateTime, formatKm } from "@/lib/format";

import { getLot } from "../queries";
import { lotIdSchema } from "../schemas";
import type { LotDetail } from "../types";
import { BidLimitPanel } from "./bid-limit-panel";
import { FollowSwitch } from "./follow-switch";
import { LotActions } from "./lot-actions";

/** Ficha do lote (SPEC `/lotes/[id]`, DESIGN.md §15.3). Lance e limite primeiro; depois análise, resultado e veículo. */
type LotDetailViewProps = {
  params: Promise<{ id: string }>;
  /** Blocos de análise e resultado, compostos pela rota (outras features não são importadas aqui). */
  analysis: React.ReactNode;
  result: React.ReactNode;
  photos: React.ReactNode;
  /** Próximo passo (analisar, continuar o rascunho ou registrar o resultado), em destaque no cabeçalho. */
  nextAction: React.ReactNode;
};

export async function LotDetailView({ params, analysis, result, photos, nextAction }: LotDetailViewProps) {
  const parsed = lotIdSchema.safeParse((await params).id);
  if (!parsed.success) notFound();
  const lot = await getLot(parsed.data);
  if (!lot) notFound();

  const title = `${lot.brand} ${lot.model} ${lot.modelYear}`;
  const isArchived = lot.archivedAt !== null || lot.auction.archivedAt !== null;

  return (
    <div className="grid gap-7">
      <Breadcrumbs>
        <BreadcrumbLink href="/minhas-analises">Minhas análises</BreadcrumbLink>
        <BreadcrumbLink href={`/minhas-analises/leiloes/${lot.auction.id}`}>{lot.auction.name}</BreadcrumbLink>
        <BreadcrumbPage>Lote {lot.lotNumber}</BreadcrumbPage>
      </Breadcrumbs>

      <PageHeader
        eyebrow={`Lote ${lot.lotNumber} · ${formatDateTime(lot.auction.startsAt)}`}
        title={title}
        description={lot.vehicleVersion ?? undefined}
        meta={isArchived ? <Badge variant="outline">Arquivado</Badge> : undefined}
        actions={
          <>
            <ButtonLink href={`/lotes/${lot.id}/editar`} variant="secondary">
              <Pencil aria-hidden="true" />
              Editar
            </ButtonLink>
            {nextAction}
            <LotActions
              lotId={lot.id}
              lotLabel={`Lote ${lot.lotNumber} — ${title}`}
              isArchived={lot.archivedAt !== null}
              canDelete={lot.fixedAnalysisCount === 0 && lot.resultCount === 0}
            />
          </>
        }
      />

      {isArchived ? (
        <Alert variant="warning">
          <AlertDescription>
            {lot.archivedAt
              ? `Lote arquivado em ${formatDateTime(lot.archivedAt)}.`
              : "O leilão deste lote está arquivado."}{" "}
            Ele não aparece nas visões ativas.
          </AlertDescription>
        </Alert>
      ) : null}

      <BidLimitPanel lot={lot} bidNote={currentBidNote(lot)} />

      <div className="grid gap-9 xl:grid-cols-[minmax(0,1.75fr)_minmax(0,1fr)] xl:gap-14">
        <div className="grid content-start gap-9">
          {analysis}
          {result}
        </div>

        <aside className="grid content-start gap-6" aria-label="Veículo e fotos">
          <Section>
            <SectionTitle>Veículo</SectionTitle>
            <dl className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)] gap-x-4 gap-y-2.5 text-body">
              <Detail label="Marca e modelo">
                {lot.brand} {lot.model}
              </Detail>
              <Detail label="Versão">{lot.vehicleVersion ?? <Unknown />}</Detail>
              <Detail label="Ano fab./modelo">
                <span className="tabular-nums">
                  {lot.manufactureYear ?? "—"} / {lot.modelYear}
                </span>
              </Detail>
              <Detail label="Quilometragem">{lot.mileageKm === null ? <Unknown /> : formatKm(lot.mileageKm)}</Detail>
              <Detail label="Página do lote">
                {lot.lotUrl ? (
                  <a
                    href={lot.lotUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex max-w-full items-center gap-1 text-accent hover:underline"
                  >
                    <span className="truncate">{new URL(lot.lotUrl).hostname}</span>
                    <ExternalLink aria-hidden="true" className="size-4 shrink-0" />
                    <span className="sr-only">(abre em nova aba)</span>
                  </a>
                ) : (
                  <Unknown />
                )}
              </Detail>
            </dl>
          </Section>

          <div className="border-t border-border pt-6">{photos}</div>

          <div className="border-t border-border pt-4">
            <FollowSwitch lotId={lot.id} isFollowed={lot.isFollowed} />
          </div>

          {lot.notes ? (
            <Section className="border-t border-border pt-6">
              <SectionTitle>Observações</SectionTitle>
              <p className="text-body whitespace-pre-line text-foreground">{lot.notes}</p>
            </Section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0 text-foreground">{children}</dd>
    </>
  );
}

function Unknown() {
  return <span className="text-muted">—</span>;
}

export function LotDetailSkeleton() {
  return (
    <div className="grid gap-7" aria-hidden="true">
      <Skeleton className="h-5 w-64" />
      <Skeleton className="h-20" />
      <Skeleton className="h-64" />
      <div className="grid gap-9 xl:grid-cols-[minmax(0,1.75fr)_minmax(0,1fr)] xl:gap-14">
        <Skeleton className="h-96" />
        <Skeleton className="h-96" />
      </div>
    </div>
  );
}

/** Data da observação e, com anúncio ligado, a última leitura do coletor (o lance se atualiza sozinho). */
function currentBidNote(lot: LotDetail): string | undefined {
  const observed = lot.currentBidObservedAt ? `Observado em ${formatDateTime(lot.currentBidObservedAt)}` : null;
  const tracked = lot.tracking
    ? `Acompanhado no ${lot.tracking.sourceName}, lido em ${formatDateTime(lot.tracking.lastCheckedAt)}`
    : null;
  return [observed, tracked].filter(Boolean).join(". ") || undefined;
}
