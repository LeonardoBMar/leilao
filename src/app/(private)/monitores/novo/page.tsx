import type { Metadata } from "next";

import { FreshOnNavigation } from "@/components/layout/fresh-on-navigation";
import { PageHeader } from "@/components/layout/page-header";
import { DEFAULT_REGION } from "@/domain/listings/region";
import { createWatchAction } from "@/features/watches/actions";
import { WatchForm } from "@/features/watches/components/watch-form";

export const metadata: Metadata = { title: "Novo monitor · Leilão Tracker" };

export default function NewWatchPage() {
  return (
    <div className="grid max-w-4xl gap-6">
      <PageHeader
        title="Novo monitor"
        description="Preencha pelo menos marca ou modelo, um ano ou um lance máximo. O resto é opcional."
      />
      <FreshOnNavigation>
        <WatchForm action={createWatchAction} regionLabel={DEFAULT_REGION.label} submitLabel="Criar monitor" />
      </FreshOnNavigation>
    </div>
  );
}
