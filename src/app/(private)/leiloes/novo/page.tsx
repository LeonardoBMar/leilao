import type { Metadata } from "next";

import { FreshOnNavigation } from "@/components/layout/fresh-on-navigation";
import { PageHeader } from "@/components/layout/page-header";
import { createAuctionAction } from "@/features/auctions/actions";
import { AuctionForm } from "@/features/auctions/components/auction-form";

export const metadata: Metadata = { title: "Novo leilão · Leilão Tracker" };

export default function NewAuctionPage() {
  return (
    <div className="grid max-w-4xl gap-6">
      <PageHeader title="Novo leilão" description="Campos com * são obrigatórios." />
      <FreshOnNavigation>
        <AuctionForm action={createAuctionAction} cancelHref="/leiloes" submitLabel="Cadastrar leilão" />
      </FreshOnNavigation>
    </div>
  );
}
