import { Calculator, FilePen, GitBranchPlus } from "lucide-react";
import Link from "next/link";

import { Button, Card, CardContent, CardHeader, CardTitle, EmptyState, Money, Skeleton } from "@/components/ui";
import { formatDateTime } from "@/lib/format";

import { listLotAnalyses } from "../queries";
import { AnalysisHistory } from "./analysis-history";
import { CreateAnalysisButton } from "./create-analysis-button";

/** Bloco de análise da ficha do lote: última versão fixada, rascunho aberto e histórico (SPEC `/lotes/[id]`). */
export async function LotAnalysisPanel({ lotId }: { lotId: string }) {
  const versions = await listLotAnalyses(lotId);
  const draft = versions.find((version) => version.status === "draft");
  const latestFixed = versions.find((version) => version.status === "fixed");

  const action = draft ? (
    <Button asChild>
      <Link href={`/analise/${draft.id}`}>
        <FilePen aria-hidden="true" />
        Continuar rascunho v{draft.version}
      </Link>
    </Button>
  ) : (
    <CreateAnalysisButton lotId={lotId} sourceId={latestFixed?.id}>
      {latestFixed ? <GitBranchPlus aria-hidden="true" /> : <Calculator aria-hidden="true" />}
      {latestFixed ? "Revisar premissas" : "Analisar lote"}
    </CreateAnalysisButton>
  );

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
        <CardTitle>Análise financeira</CardTitle>
        {versions.length > 0 ? action : null}
      </CardHeader>
      <CardContent className="grid gap-6">
        {versions.length === 0 ? (
          <EmptyState
            icon={Calculator}
            title="Nenhuma análise"
            description="Calcule quanto pode pagar por este lote considerando custos e margem."
            action={action}
          />
        ) : null}

        {latestFixed ? (
          <div className="grid gap-1">
            <p className="text-caption text-muted">
              Limite da v{latestFixed.version}, fixada em{" "}
              {latestFixed.fixedAt ? formatDateTime(latestFixed.fixedAt) : "—"}
            </p>
            {latestFixed.isViable ? (
              <p className="text-heading-2 text-primary">
                <Money value={latestFixed.maxBid} />
              </p>
            ) : (
              <p className="text-heading-3 text-foreground">Sem lance viável com estas premissas</p>
            )}
            <Link href={`/analise/${latestFixed.id}`} className="w-fit text-caption text-primary hover:underline">
              Ver análise fixada
            </Link>
          </div>
        ) : versions.length > 0 ? (
          <p className="text-body text-muted">Nenhuma versão fixada ainda. Fixe o rascunho para registrar o limite.</p>
        ) : null}

        <AnalysisHistory versions={versions} />
      </CardContent>
    </Card>
  );
}

export function LotAnalysisPanelSkeleton() {
  return <Skeleton className="h-64" aria-hidden="true" />;
}
