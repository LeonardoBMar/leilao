import type { Route } from "next";
import { notFound } from "next/navigation";

import { BreadcrumbLink, BreadcrumbPage, Breadcrumbs } from "@/components/layout/breadcrumbs";
import { FreshOnNavigation } from "@/components/layout/fresh-on-navigation";
import { PageHeader } from "@/components/layout/page-header";
import { getAuction } from "@/features/auctions/queries";
import { entityId } from "@/lib/schemas";

import { createLotAction } from "../actions";
import { LotForm } from "./lot-form";

const auctionIdSchema = entityId();

export async function NewLotView({ params }: { params: Promise<{ id: string }> }) {
  const parsed = auctionIdSchema.safeParse((await params).id);
  if (!parsed.success) notFound();
  const auction = await getAuction(parsed.data);
  if (!auction) notFound();

  return (
    <div className="grid max-w-4xl gap-6">
      <Breadcrumbs>
        <BreadcrumbLink href={`/minhas-analises/leiloes/${auction.id}`}>{auction.name}</BreadcrumbLink>
        <BreadcrumbPage>Novo lote</BreadcrumbPage>
      </Breadcrumbs>
      <PageHeader title="Novo lote" description={auction.name} />
      <FreshOnNavigation>
        <LotForm
          action={createLotAction.bind(null, auction.id)}
          cancelHref={`/minhas-analises/leiloes/${auction.id}` as Route}
          submitLabel="Cadastrar lote"
        />
      </FreshOnNavigation>
    </div>
  );
}
