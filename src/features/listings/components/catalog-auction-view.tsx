import { notFound } from "next/navigation";

import { BreadcrumbLink, BreadcrumbPage, Breadcrumbs } from "@/components/layout/breadcrumbs";
import { PageHeader } from "@/components/layout/page-header";
import { Badge, ButtonLink, Skeleton } from "@/components/ui";
import { formatDateTime } from "@/lib/format";

import { getCatalogAuction } from "../queries";
import { catalogAuctionParamsSchema } from "../schemas";
import { CatalogAuctionNumbers } from "./catalog-auctions-view";

type CatalogAuctionParams = Promise<{ source: string; auction: string }>;

/**
 * Cabeçalho do leilão do catálogo (D-42): fonte, data, números e o registro do usuário, se houver. Os anúncios vêm
 * em `listings` (com os filtros da URL). Lê `params` e dados: renderizar dentro de <Suspense>.
 */
export async function CatalogAuctionView({
  params,
  listings,
}: {
  params: CatalogAuctionParams;
  listings: React.ReactNode;
}) {
  const parsed = catalogAuctionParamsSchema.safeParse(await params);
  if (!parsed.success) notFound();
  const auction = await getCatalogAuction(parsed.data);
  if (!auction) notFound();

  return (
    <div className="grid gap-7">
      <Breadcrumbs>
        <BreadcrumbLink href="/leiloes">Leilões</BreadcrumbLink>
        <BreadcrumbPage>{auction.name ?? "Leilão sem nome"}</BreadcrumbPage>
      </Breadcrumbs>

      <PageHeader
        eyebrow={`${auction.sourceName} · ${auction.date ? formatDateTime(auction.date) : "Data não informada"}`}
        title={auction.name ?? "Leilão sem nome"}
        meta={
          <>
            <Badge variant={auction.isOpen ? "default" : "outline"}>{auction.isOpen ? "Aberto" : "Encerrado"}</Badge>
            <CatalogAuctionNumbers item={auction} showMatching={false} />
          </>
        }
        actions={
          auction.userAuctionId ? (
            <ButtonLink href={`/minhas-analises/leiloes/${auction.userAuctionId}`} variant="secondary">
              Ver minhas análises deste leilão
            </ButtonLink>
          ) : null
        }
      />

      {listings}
    </div>
  );
}

export function CatalogAuctionViewSkeleton() {
  return (
    <div className="grid gap-7" aria-hidden="true">
      <Skeleton className="h-5 w-48" />
      <Skeleton className="h-20 w-full max-w-xl" />
      <Skeleton className="h-96" />
    </div>
  );
}
