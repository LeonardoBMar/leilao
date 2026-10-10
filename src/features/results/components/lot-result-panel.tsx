import { ExternalLink } from "lucide-react";
import Link from "next/link";

import {
  Alert,
  AlertDescription,
  Badge,
  EmptyState,
  Money,
  Section,
  SectionHeader,
  SectionTitle,
  Skeleton,
  Stat,
} from "@/components/ui";
import { formatDateTime } from "@/lib/format";

import { recordResultAction } from "../actions";
import { OUTCOME_LABELS, PERSONAL_OUTCOME_LABELS, TIMING_LABELS } from "../labels";
import { getLotResultContext } from "../queries";
import type { ResultRevision, ResultTracking } from "../types";
import { ResultComparison } from "./result-comparison";
import { ResultDialog } from "./result-dialog";

/** Bloco de resultado da ficha do lote: revisão vigente, comparação e histórico de correções (RF-06). */
export async function LotResultPanel({ lotId }: { lotId: string }) {
  const context = await getLotResultContext(lotId);
  if (!context) return null;
  const { current, revisions, tracking } = context;
  const toConfirm = !current && tracking?.outcome.kind === "to_confirm";

  // A ficha fica preservada entre navegações (D-24): cada revisão nova recomeça o formulário.
  const action = (
    <ResultDialog key={current?.revision ?? 0} action={recordResultAction.bind(null, lotId)} context={context} />
  );

  return (
    <Section>
      <SectionHeader>
        <SectionTitle>Resultado</SectionTitle>
        {current ? action : null}
      </SectionHeader>
      <div className="grid gap-6">
        {current ? (
          <>
            <CurrentResult result={current} />
            {revisions.length > 1 ? <Corrections revisions={revisions} /> : null}
          </>
        ) : (
          <EmptyState
            variant="inline"
            title={toConfirm ? "Resultado a confirmar" : "Sem resultado registrado"}
            description={pendingDescription(tracking)}
            action={action}
          />
        )}
      </div>
    </Section>
  );
}

function CurrentResult({ result }: { result: ResultRevision }) {
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge>{OUTCOME_LABELS[result.outcome]}</Badge>
        <span className="text-caption text-muted">
          {PERSONAL_OUTCOME_LABELS[result.personalOutcome]}
          {result.source === "collector" ? " · registrado pelo coletor" : ""}
        </span>
        {result.analysis ? (
          <Badge variant={result.analysisTiming === "prior" ? "success" : "warning"}>
            {TIMING_LABELS[result.analysisTiming]}
            {result.analysisTiming === "prior" && result.priorDeclared ? " (declarada)" : ""}
          </Badge>
        ) : null}
      </div>

      {result.analysis && result.analysisTiming !== "prior" ? (
        <Alert variant="warning">
          <AlertDescription>
            {result.analysisTiming === "retrospective"
              ? "A análise vinculada é retrospectiva (feita ou fixada depois do desfecho) e não entra no indicador de decisões anteriores ao resultado."
              : "Não é possível afirmar que a análise antecedeu o desfecho. Ela não entra no indicador de decisões anteriores ao resultado."}
          </AlertDescription>
        </Alert>
      ) : null}

      <dl className="grid gap-4 border-y border-border py-4 sm:grid-cols-3">
        <Stat size="heading-3" label="Preço final">
          <Money value={result.finalBid} />
        </Stat>
        <Stat size="heading-3" label="Limite da análise vinculada">
          {result.analysis ? (
            <Link href={`/analise/${result.analysis.id}`} className="text-accent hover:underline">
              {result.analysis.isViable ? <Money value={result.analysis.maxBid} /> : "Sem lance viável"} · v
              {result.analysis.version}
            </Link>
          ) : (
            <span className="text-muted">Nenhuma</span>
          )}
        </Stat>
        <Stat size="heading-3" label="Desfecho em">
          {result.eventAt ? formatDateTime(result.eventAt) : <span className="text-muted">—</span>}
        </Stat>
      </dl>

      <ResultComparison result={result} />

      {result.decisionReason || result.notes || result.sourceUrl || result.sourceNotes ? (
        <dl className="grid gap-3 text-body">
          {result.decisionReason ? (
            <Stat label="Motivo da decisão" valueClassName="whitespace-pre-line">
              {result.decisionReason}
            </Stat>
          ) : null}
          {result.notes ? (
            <Stat label="Observações" valueClassName="whitespace-pre-line">
              {result.notes}
            </Stat>
          ) : null}
          {result.sourceUrl || result.sourceNotes ? (
            <Stat label="Fonte" valueClassName="whitespace-pre-line">
              {result.sourceUrl ? (
                <a
                  href={result.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-accent hover:underline"
                >
                  {new URL(result.sourceUrl).hostname}
                  <ExternalLink aria-hidden="true" className="size-4" />
                  <span className="sr-only">(abre em nova aba)</span>
                </a>
              ) : null}
              {result.sourceNotes ? <span className="block">{result.sourceNotes}</span> : null}
            </Stat>
          ) : null}
        </dl>
      ) : null}

      <p className="text-caption text-muted">
        Revisão {result.revision} registrada em {formatDateTime(result.recordedAt)}.
      </p>
    </div>
  );
}

/** O que falta para o resultado, conforme o anúncio ligado (etapa 4). Sem anúncio, o registro é manual. */
function pendingDescription(tracking: ResultTracking | null): string {
  if (!tracking) return "Registre o desfecho após o encerramento para comparar com o seu limite.";
  const { outcome, sourceName } = tracking;
  switch (outcome.kind) {
    case "pending":
      return `O resultado é registrado sozinho quando o lote encerrar no ${sourceName}.`;
    case "final":
      return `O ${sourceName} já informou o desfecho; o coletor registra na próxima coleta. Se preferir, registre agora.`;
    case "to_confirm":
      return outcome.reason === "conditional"
        ? `O ${sourceName} deixou a venda como condicional, à espera do vendedor. Se o site confirmar, o resultado entra sozinho; se souber antes, confirme aqui.`
        : `O ${sourceName} não informou o desfecho. Confirme a partir do último lance coletado.`;
  }
}

/** Histórico de correções: revisões anteriores preservadas com data e motivo (CA-14). */
function Corrections({ revisions }: { revisions: ResultRevision[] }) {
  return (
    <details className="border-t border-border pt-4">
      <summary className="cursor-pointer text-label text-foreground">
        Histórico de correções ({revisions.length - 1})
      </summary>
      <ol className="mt-4 grid gap-4">
        {revisions.map((revision) => (
          <li key={revision.id} className="grid gap-1 text-body">
            <p className="font-semibold text-foreground">
              Revisão {revision.revision} · {formatDateTime(revision.recordedAt)}
              {revision.revision === revisions[0]?.revision ? " (vigente)" : ""}
            </p>
            <p className="text-foreground-secondary">
              {OUTCOME_LABELS[revision.outcome]} · preço final <Money value={revision.finalBid} />
            </p>
            {revision.correctionReason ? (
              <p className="text-caption text-muted">Motivo: {revision.correctionReason}</p>
            ) : null}
          </li>
        ))}
      </ol>
    </details>
  );
}

export function LotResultPanelSkeleton() {
  return <Skeleton className="h-56" aria-hidden="true" />;
}
