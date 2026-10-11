import { ClipboardCheck } from "lucide-react";

import { ButtonLink } from "@/components/ui";
import { AddToTrackerButton } from "@/features/listings/components/add-to-tracker-button";
import type { OpenListingAction } from "@/features/research/components/evaluate-open-listings";

/** Lote aberto no Avaliar: já analisado leva à análise; senão, "Adicionar à análise" (o fluxo de Leilões). */
export const openListingAction: OpenListingAction = (listing) => {
  if (listing.trackedLotId !== null) {
    return (
      <ButtonLink href={`/lotes/${listing.trackedLotId}`} variant="secondary" size="sm">
        <ClipboardCheck aria-hidden="true" />
        Ver minha análise
      </ButtonLink>
    );
  }
  return listing.trackable ? <AddToTrackerButton listingId={listing.id} /> : null;
};
