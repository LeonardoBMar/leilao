import { ExternalLink, Pencil } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/layout/page-header";
import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Money,
  Skeleton,
} from "@/components/ui";
import { formatDate, formatDateTime } from "@/lib/format";

import { updateCurrentBidAction } from "../actions";
import { getLot } from "../queries";
import { lotIdSchema } from "../schemas";
import { CurrentBidForm } from "./current-bid-form";
import { FollowSwitch } from "./follow-switch";
import { LimitBadge } from "./limit-badge";
import { LotActions } from "./lot-actions";

const integer = new Intl.NumberFormat("pt-BR");

/** Ficha do lote (SPEC `/lotes/[id]`, DESIGN.md §15.3). Valores observados e limite antes das notas. */
type LotDetailViewProps = {
  params: Promise<{ id: string }>;
  /** Blocos de análise e resultado, compostos pela rota (outras features não são importadas aqui). */
  analysis: React.ReactNode;
  result: React.ReactNode;
  photos: React.ReactNode;
};

export async function LotDetailView({ params, analysis, result, photos }: LotDetailViewProps) {
  const parsed = lotIdSchema.safeParse((await params).id);
  if (!parsed.success) notFound();
  const lot = await getLot(parsed.data);
  if (!lot) notFound();

  const title = `${lot.brand} ${lot.model} ${lot.modelYear}`;
  const isArchived = lot.archivedAt !== null || lot.auction.archivedAt !== null;

  return (
    <div className="grid gap-6">
      <nav aria-label="Trilha" className="text-caption text-muted">
        <Link href="/leiloes" className="hover:text-foreground hover:underline">
          Leilões
        </Link>
        <span aria-hidden="true"> / </span>
        <Link href={`/leiloes/${lot.auction.id}`} className="hover:text-foreground hover:underline">
          {lot.auction.name}
        </Link>
        <span aria-hidden="true"> / </span>
        <span className="text-foreground">Lote {lot.lotNumber}</span>
      </nav>

      <PageHeader
        eyebrow={`Lote ${lot.lotNumber}`}
        title={title}
        description={[lot.vehicleVersion, `${lot.auction.name} · ${formatDateTime(lot.auction.startsAt)}`]
          .filter(Boolean)
          .join(" · ")}
        actions={
          <>
            <Button asChild variant="secondary">
              <Link href={`/lotes/${lot.id}/editar`}>
                <Pencil aria-hidden="true" />
                Editar
              </Link>
            </Button>
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

      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <div className="grid content-start gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Lances e limite</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-6">
              <dl className="grid gap-4 sm:grid-cols-3">
                <Stat label="Lance inicial">
                  <Money value={lot.startingBid} />
                </Stat>
                <Stat
                  label="Lance atual"
                  note={
                    lot.currentBidObservedAt ? `Observado em ${formatDateTime(lot.currentBidObservedAt)}` : undefined
                  }
                >
                  <Money value={lot.currentBid} />
                </Stat>
                <Stat
                  label="Meu limite"
                  note={
                    lot.limit
                      ? `Análise v${lot.limit.version} fixada em ${formatDate(lot.limit.fixedAt)}`
                      : "Sem análise fixada"
                  }
                >
                  <Money value={lot.limit?.maxBid ?? null} className="text-primary" />
                </Stat>
              </dl>
              <div>
                <LimitBadge limit={lot.limit} bid={lot.currentBid} />
              </div>
              <CurrentBidForm action={updateCurrentBidAction.bind(null, lot.id)} currentBid={lot.currentBid} />
            </CardContent>
          </Card>

          {analysis}

          {result}
        </div>

        <div className="grid content-start gap-6">
          <Card>
            <CardContent className="pt-6">
              <FollowSwitch lotId={lot.id} isFollowed={lot.isFollowed} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Veículo</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-4 text-body">
                <Detail label="Marca e modelo">
                  {lot.brand} {lot.model}
                </Detail>
                <Detail label="Versão">{lot.vehicleVersion ?? <Unknown />}</Detail>
                <Detail label="Ano (fabricação/modelo)">
                  {lot.manufactureYear ?? "—"}/{lot.modelYear}
                </Detail>
                <Detail label="Quilometragem">
                  {lot.mileageKm === null ? <Unknown /> : `${integer.format(lot.mileageKm)} km`}
                </Detail>
                <Detail label="Página do lote">
                  {lot.lotUrl ? (
                    <a
                      href={lot.lotUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex max-w-full items-center gap-1 text-primary hover:underline"
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
            </CardContent>
          </Card>

          {photos}

          {lot.notes ? (
            <Card>
              <CardHeader>
                <CardTitle>Observações</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-body whitespace-pre-line text-foreground">{lot.notes}</p>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-caption text-muted">
        <Badge variant="outline">Atualizado em {formatDateTime(lot.updatedAt)}</Badge>
      </div>
    </div>
  );
}

function Stat({ label, note, children }: { label: string; note?: string; children: React.ReactNode }) {
  return (
    <div className="grid content-start gap-1">
      <dt className="text-caption text-muted">{label}</dt>
      <dd className="text-heading-3 text-foreground">{children}</dd>
      {note ? <dd className="text-caption text-muted">{note}</dd> : null}
    </div>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1">
      <dt className="text-caption text-muted">{label}</dt>
      <dd className="text-foreground">{children}</dd>
    </div>
  );
}

function Unknown() {
  return <span className="text-muted">Não informado</span>;
}

export function LotDetailSkeleton() {
  return (
    <div className="grid gap-6" aria-hidden="true">
      <Skeleton className="h-5 w-64" />
      <Skeleton className="h-20" />
      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <Skeleton className="h-96" />
        <Skeleton className="h-96" />
      </div>
    </div>
  );
}
