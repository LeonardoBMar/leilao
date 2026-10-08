import { notFound } from "next/navigation";

import { PageHeader } from "@/components/layout/page-header";
import { DEFAULT_REGION } from "@/domain/listings/region";
import { listActiveSources } from "@/features/listings/queries";

import { updateWatchAction } from "../actions";
import { getWatch } from "../queries";
import { watchIdSchema } from "../schemas";
import { watchTitle } from "../summary";
import { WatchForm } from "./watch-form";

export async function WatchEditView({ params }: { params: Promise<{ id: string }> }) {
  const parsed = watchIdSchema.safeParse((await params).id);
  if (!parsed.success) notFound();
  const [watch, sources] = await Promise.all([getWatch(parsed.data), listActiveSources()]);
  if (!watch) notFound();

  return (
    <div className="grid max-w-4xl gap-6">
      <PageHeader
        title="Editar monitor"
        description={`${watchTitle(watch.name, watch.criteria)}. Ao salvar, só lotes que aparecerem depois geram alerta.`}
      />
      <WatchForm
        key={watch.updatedAt.getTime()}
        action={updateWatchAction.bind(null, watch.id)}
        watch={watch}
        sources={sources}
        regionLabel={DEFAULT_REGION.label}
        currentYear={new Date().getUTCFullYear()}
        submitLabel="Salvar alterações"
      />
    </div>
  );
}
