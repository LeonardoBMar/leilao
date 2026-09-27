import { notFound } from "next/navigation";

import { PageHeader } from "@/components/layout/page-header";

import { recordResultAction } from "../actions";
import { getLotResultContext } from "../queries";
import { lotIdSchema } from "../schemas";
import { ResultForm } from "./result-form";

export async function ResultFormView({ params }: { params: Promise<{ id: string }> }) {
  const parsed = lotIdSchema.safeParse((await params).id);
  if (!parsed.success) notFound();
  const context = await getLotResultContext(parsed.data);
  if (!context) notFound();

  return (
    <div className="grid max-w-4xl gap-6">
      <PageHeader
        eyebrow={`Lote ${context.lot.lotNumber} · ${context.lot.title}`}
        title={context.current ? "Corrigir resultado" : "Registrar resultado"}
        description={context.lot.auction.name}
      />
      <ResultForm action={recordResultAction.bind(null, context.lot.id)} context={context} />
    </div>
  );
}
