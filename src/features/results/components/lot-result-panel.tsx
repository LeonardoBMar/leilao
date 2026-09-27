import { ExternalLink, FilePen, Trophy } from "lucide-react";
import Link from "next/link";

import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Money,
  Skeleton,
} from "@/components/ui";
import { formatDateTime } from "@/lib/format";

import { OUTCOME_LABELS, PERSONAL_OUTCOME_LABELS, TIMING_LABELS } from "../labels";
import { getLotResultContext } from "../queries";
import type { ResultRevision } from "../types";
import { ResultComparison } from "./result-comparison";

/** Bloco de resultado da ficha do lote: revisão vigente, comparação e histórico de correções (RF-06). */
export async function LotResultPanel({ lotId }: { lotId: string }) {
  const context = await getLotResultContext(lotId);
  if (!context) return null;
  const { current, revisions } = context;

  const action = (
    <Button asChild variant={current ? "secondary" : "primary"}>
      <Link href={`/lotes/${lotId}/resultado`}>
        {current ? <FilePen aria-hidden="true" /> : <Trophy aria-hidden="true" />}
        {current ? "Corrigir resultado" : "Registrar resultado"}
      </Link>
    </Button>
  );

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
        <CardTitle>Resultado</CardTitle>
        {current ? action : null}
      </CardHeader>
      <CardContent className="grid gap-6">
        {current ? (
          <>
            <CurrentResult result={current} />
            {revisions.length > 1 ? <Corrections revisions={revisions} /> : null}
          </>
        ) : (
          <EmptyState
            icon={Trophy}
            title="Sem resultado registrado"
            description="Registre o desfecho após o encerramento para comparar com o seu limite."
            action={action}
          />
        )}
      </CardContent>
    </Card>
  );
}

function CurrentResult({ result }: { result: ResultRevision }) {
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-2">
        <Badge variant={result.outcome === "sold" ? "primary" : "default"}>{OUTCOME_LABELS[result.outcome]}</Badge>
        <Badge variant="outline">{PERSONAL_OUTCOME_LABELS[result.personalOutcome]}</Badge>
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

      <dl className="grid gap-4 sm:grid-cols-3">
        <Stat label="Preço final">
          <Money value={result.finalBid} />
        </Stat>
        <Stat label="Limite da análise vinculada">
          {result.analysis ? (
            <Link href={`/analise/${result.analysis.id}`} className="text-primary hover:underline">
              {result.analysis.isViable ? <Money value={result.analysis.maxBid} /> : "Sem lance viável"} · v
              {result.analysis.version}
            </Link>
          ) : (
            <span className="text-muted">Nenhuma</span>
          )}
        </Stat>
        <Stat label="Desfecho em">
          {result.eventAt ? formatDateTime(result.eventAt) : <span className="text-muted">Não informado</span>}
        </Stat>
      </dl>

      <ResultComparison result={result} />

      {result.decisionReason || result.notes || result.sourceUrl || result.sourceNotes ? (
        <dl className="grid gap-3 border-t border-border pt-4 text-body">
          {result.decisionReason ? <Text label="Motivo da decisão">{result.decisionReason}</Text> : null}
          {result.notes ? <Text label="Observações">{result.notes}</Text> : null}
          {result.sourceUrl || result.sourceNotes ? (
            <Text label="Fonte">
              {result.sourceUrl ? (
                <a
                  href={result.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  {new URL(result.sourceUrl).hostname}
                  <ExternalLink aria-hidden="true" className="size-4" />
                  <span className="sr-only">(abre em nova aba)</span>
                </a>
              ) : null}
              {result.sourceNotes ? <span className="block">{result.sourceNotes}</span> : null}
            </Text>
          ) : null}
        </dl>
      ) : null}

      <p className="text-caption text-muted">
        Revisão {result.revision} registrada em {formatDateTime(result.recordedAt)}.
      </p>
    </div>
  );
}

/** Histórico de correções: revisões anteriores preservadas com data e motivo (CA-14). */
function Corrections({ revisions }: { revisions: ResultRevision[] }) {
  return (
    <details className="rounded-lg border border-border p-4">
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

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid content-start gap-1">
      <dt className="text-caption text-muted">{label}</dt>
      <dd className="text-heading-3 text-foreground">{children}</dd>
    </div>
  );
}

function Text({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1">
      <dt className="text-caption text-muted">{label}</dt>
      <dd className="whitespace-pre-line text-foreground">{children}</dd>
    </div>
  );
}

export function LotResultPanelSkeleton() {
  return <Skeleton className="h-56" aria-hidden="true" />;
}
