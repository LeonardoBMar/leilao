import type { Route } from "next";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/layout/page-header";
import { getAuction } from "@/features/auctions/queries";
import { entityId } from "@/lib/schemas";

import { createLotAction, updateLotAction } from "../actions";
import { getLot } from "../queries";
import { lotIdSchema } from "../schemas";
import { LotForm } from "./lot-form";

const auctionIdSchema = entityId();

export async function NewLotView({ params }: { params: Promise<{ id: string }> }) {
  const parsed = auctionIdSchema.safeParse((await params).id);
  if (!parsed.success) notFound();
  const auction = await getAuction(parsed.data);
  if (!auction) notFound();

  return (
    <div className="grid max-w-4xl gap-6">
      <PageHeader title="Novo lote" description={`${auction.name} · Campos com * são obrigatórios.`} />
      <LotForm
        action={createLotAction.bind(null, auction.id)}
        cancelHref={`/leiloes/${auction.id}` as Route}
        submitLabel="Cadastrar lote"
      />
    </div>
  );
}

export async function EditLotView({ params }: { params: Promise<{ id: string }> }) {
  const parsed = lotIdSchema.safeParse((await params).id);
  if (!parsed.success) notFound();
  const lot = await getLot(parsed.data);
  if (!lot) notFound();

  return (
    <div className="grid max-w-4xl gap-6">
      <PageHeader title="Editar lote" description={`Lote ${lot.lotNumber} · ${lot.auction.name}`} />
      <LotForm
        action={updateLotAction.bind(null, lot.id)}
        lot={lot}
        cancelHref={`/lotes/${lot.id}` as Route}
        submitLabel="Salvar alterações"
      />
    </div>
  );
}
