import { ExternalLink, Gavel, Pencil, Plus } from "lucide-react";
import { notFound } from "next/navigation";

import { BreadcrumbLink, BreadcrumbPage, Breadcrumbs } from "@/components/layout/breadcrumbs";
import { PageHeader } from "@/components/layout/page-header";
import {
  Alert,
  AlertDescription,
  Badge,
  ButtonLink,
  Card,
  Section,
  SectionHeader,
  SectionTitle,
  Skeleton,
} from "@/components/ui";
import { catalogAuctionPath } from "@/features/listings/search";
import { formatDateTime } from "@/lib/format";

import { ORIGIN_LABELS, STATUS_BADGE_VARIANTS, STATUS_LABELS } from "../labels";
import { getAuction } from "../queries";
import { auctionIdSchema } from "../schemas";
import { AuctionActions } from "./auction-actions";

type AuctionDetailViewProps = {
  params: Promise<{ id: string }>;
  /** Lista de lotes, composta pela rota (a feature de lotes não é importada aqui). */
  lots: React.ReactNode;
};

export async function AuctionDetailView({ params, lots }: AuctionDetailViewProps) {
  const parsed = auctionIdSchema.safeParse((await params).id);
  if (!parsed.success) notFound();
  const auction = await getAuction(parsed.data);
  if (!auction) notFound();

  const location = [auction.city, auction.state].filter(Boolean).join(" — ");

  return (
    <div className="grid gap-7">
      <Breadcrumbs>
        <BreadcrumbLink href="/minhas-analises?vista=leilao">Minhas análises</BreadcrumbLink>
        <BreadcrumbPage>{auction.name}</BreadcrumbPage>
      </Breadcrumbs>

      <PageHeader
        eyebrow={`${ORIGIN_LABELS[auction.origin]} · ${formatDateTime(auction.startsAt)}`}
        title={auction.name}
        description={auction.auctioneer}
        meta={
          <>
            <Badge variant={STATUS_BADGE_VARIANTS[auction.status]}>{STATUS_LABELS[auction.status]}</Badge>
            {auction.archivedAt ? <Badge variant="warning">Arquivado</Badge> : null}
          </>
        }
        actions={
          <>
            {auction.catalog ? (
              <ButtonLink href={catalogAuctionPath(auction.catalog)} variant="secondary">
                <Gavel aria-hidden="true" />
                Todos os lotes do leilão
              </ButtonLink>
            ) : null}
            <ButtonLink href={`/minhas-analises/leiloes/${auction.id}/editar`} variant="secondary">
              <Pencil aria-hidden="true" />
              Editar
            </ButtonLink>
            <AuctionActions
              auctionId={auction.id}
              auctionName={auction.name}
              isArchived={auction.archivedAt !== null}
              canDelete={auction.totalLotCount === 0}
            />
          </>
        }
      />

      {auction.archivedAt ? (
        <Alert variant="warning">
          <AlertDescription>
            Leilão arquivado em {formatDateTime(auction.archivedAt)}. Ele e seus lotes não aparecem nas visões ativas.
          </AlertDescription>
        </Alert>
      ) : null}

      <Card variant="summary" aria-label="Dados do evento" className="p-5 md:px-8 md:py-6">
        <dl className="grid gap-x-8 gap-y-4 text-body sm:grid-cols-2 xl:grid-cols-4">
          <Detail label="Data e hora">{formatDateTime(auction.startsAt)}</Detail>
          <Detail label="Local">{location || <span className="text-muted">Não informado</span>}</Detail>
          <Detail label="Edital">
            <ExternalAnchor href={auction.noticeUrl} />
          </Detail>
          <Detail label="Plataforma">
            <ExternalAnchor href={auction.platformUrl} />
          </Detail>
          {auction.notes ? (
            <div className="grid gap-1 sm:col-span-2 xl:col-span-4">
              <dt className="text-caption text-muted">Observações</dt>
              <dd className="whitespace-pre-line text-foreground-secondary">{auction.notes}</dd>
            </div>
          ) : null}
        </dl>
      </Card>

      <Section aria-labelledby="auction-lots">
        <SectionHeader>
          <SectionTitle id="auction-lots">Lotes</SectionTitle>
          <ButtonLink href={`/minhas-analises/leiloes/${auction.id}/lotes/novo`}>
            <Plus aria-hidden="true" />
            Adicionar lote
          </ButtonLink>
        </SectionHeader>
        {lots}
      </Section>
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

/** Link externo seguro: só http/https (validado no cadastro), em nova aba, sem `opener` (SPEC §11). */
function ExternalAnchor({ href }: { href: string | null }) {
  if (!href) return <span className="text-muted">Não informado</span>;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex max-w-full items-center gap-1 text-accent hover:underline"
    >
      <span className="truncate">{new URL(href).hostname}</span>
      <ExternalLink aria-hidden="true" className="size-4 shrink-0" />
      <span className="sr-only">(abre em nova aba)</span>
    </a>
  );
}

export function AuctionDetailSkeleton() {
  return (
    <div className="grid gap-7" aria-hidden="true">
      <Skeleton className="h-5 w-48" />
      <Skeleton className="h-20" />
      <Skeleton className="h-24" />
      <Skeleton className="h-96" />
    </div>
  );
}
