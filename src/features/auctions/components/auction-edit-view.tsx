import type { Route } from "next";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/layout/page-header";

import { updateAuctionAction } from "../actions";
import { getAuction } from "../queries";
import { auctionIdSchema } from "../schemas";
import { AuctionForm } from "./auction-form";

export async function AuctionEditView({ params }: { params: Promise<{ id: string }> }) {
  const parsed = auctionIdSchema.safeParse((await params).id);
  if (!parsed.success) notFound();
  const auction = await getAuction(parsed.data);
  if (!auction) notFound();

  return (
    <div className="grid max-w-4xl gap-6">
      <PageHeader title="Editar leilão" description={auction.name} />
      <AuctionForm
        key={auction.updatedAt.getTime()}
        action={updateAuctionAction.bind(null, auction.id)}
        auction={auction}
        cancelHref={`/leiloes/${auction.id}` as Route}
        submitLabel="Salvar alterações"
      />
    </div>
  );
}
