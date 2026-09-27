import { ExternalLink, Pencil, Plus } from "lucide-react";
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
  Skeleton,
} from "@/components/ui";
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
    <div className="grid gap-6">
      <nav aria-label="Trilha" className="text-caption text-muted">
        <Link href="/leiloes" className="hover:text-foreground hover:underline">
          Leilões
        </Link>
        <span aria-hidden="true"> / </span>
        <span className="text-foreground">{auction.name}</span>
      </nav>

      <PageHeader
        title={auction.name}
        description={`${formatDateTime(auction.startsAt)} · ${auction.auctioneer}`}
        actions={
          <>
            <Button asChild variant="secondary">
              <Link href={`/leiloes/${auction.id}/editar`}>
                <Pencil aria-hidden="true" />
                Editar
              </Link>
            </Button>
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

      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <section aria-labelledby="auction-lots" className="grid content-start gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="auction-lots" className="text-heading-2 text-foreground">
              Lotes
            </h2>
            <Button asChild>
              <Link href={`/leiloes/${auction.id}/lotes/novo`}>
                <Plus aria-hidden="true" />
                Adicionar lote
              </Link>
            </Button>
          </div>
          {lots}
        </section>

        <Card>
          <CardHeader>
            <CardTitle>Dados do evento</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 text-body">
              <Detail label="Status">
                <Badge variant={STATUS_BADGE_VARIANTS[auction.status]}>{STATUS_LABELS[auction.status]}</Badge>
              </Detail>
              <Detail label="Origem">{ORIGIN_LABELS[auction.origin]}</Detail>
              <Detail label="Data e hora">{formatDateTime(auction.startsAt)}</Detail>
              <Detail label="Local">{location || "Não informado"}</Detail>
              <Detail label="Edital">
                <ExternalAnchor href={auction.noticeUrl} />
              </Detail>
              <Detail label="Plataforma">
                <ExternalAnchor href={auction.platformUrl} />
              </Detail>
              {auction.notes ? (
                <Detail label="Observações">
                  <p className="whitespace-pre-line">{auction.notes}</p>
                </Detail>
              ) : null}
            </dl>
          </CardContent>
        </Card>
      </div>
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
      className="inline-flex max-w-full items-center gap-1 text-primary hover:underline"
    >
      <span className="truncate">{new URL(href).hostname}</span>
      <ExternalLink aria-hidden="true" className="size-4 shrink-0" />
      <span className="sr-only">(abre em nova aba)</span>
    </a>
  );
}

export function AuctionDetailSkeleton() {
  return (
    <div className="grid gap-6" aria-hidden="true">
      <Skeleton className="h-5 w-48" />
      <Skeleton className="h-16" />
      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <Skeleton className="h-64" />
        <Skeleton className="h-96" />
      </div>
    </div>
  );
}
