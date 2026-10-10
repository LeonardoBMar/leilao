import { Calculator, FilePen, GitBranchPlus } from "lucide-react";
import Link from "next/link";

import { ButtonLink, EmptyState, Section, SectionHeader, SectionTitle, Skeleton } from "@/components/ui";

import { listLotAnalyses } from "../queries";
import { AnalysisHistory } from "./analysis-history";
import { CreateAnalysisButton } from "./create-analysis-button";

/** Bloco de análise da ficha do lote: última versão fixada, rascunho aberto e histórico (SPEC `/lotes/[id]`). */
export async function LotAnalysisPanel({ lotId }: { lotId: string }) {
  const versions = await listLotAnalyses(lotId);
  const draft = versions.find((version) => version.status === "draft");
  const latestFixed = versions.find((version) => version.status === "fixed");

  const action = draft ? (
    <ButtonLink href={`/analise/${draft.id}`} variant="secondary">
      <FilePen aria-hidden="true" />
      Continuar rascunho v{draft.version}
    </ButtonLink>
  ) : (
    <CreateAnalysisButton lotId={lotId} sourceId={latestFixed?.id} variant="secondary">
      {latestFixed ? <GitBranchPlus aria-hidden="true" /> : <Calculator aria-hidden="true" />}
      {latestFixed ? "Revisar premissas" : "Analisar lote"}
    </CreateAnalysisButton>
  );

  return (
    <Section>
      <SectionHeader>
        <SectionTitle>Análise financeira</SectionTitle>
        {versions.length > 0 ? (
          <div className="flex flex-wrap items-center gap-3">
            {latestFixed ? (
              <Link href={`/analise/${latestFixed.id}`} className="text-label text-accent hover:underline">
                Abrir v{latestFixed.version}
              </Link>
            ) : null}
            {action}
          </div>
        ) : null}
      </SectionHeader>
      <div className="grid gap-5">
        {versions.length === 0 ? (
          <EmptyState
            variant="inline"
            title="Nenhuma análise"
            description="Calcule quanto pode pagar por este lote considerando custos e margem."
            action={action}
          />
        ) : null}

        {versions.length > 0 && !latestFixed ? (
          <p className="text-body text-muted">Nenhuma versão fixada ainda. Fixe o rascunho para registrar o limite.</p>
        ) : null}

        <AnalysisHistory versions={versions} />
      </div>
    </Section>
  );
}

export function LotAnalysisPanelSkeleton() {
  return <Skeleton className="h-64" aria-hidden="true" />;
}
