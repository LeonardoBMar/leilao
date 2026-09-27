import Link from "next/link";

import { Badge, Money, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui";
import { formatDateTime } from "@/lib/format";

import type { AnalysisVersion } from "../types";

/** Versões da análise de um lote (RF-05). Rolagem horizontal no mobile (DESIGN.md §5.11). */
export function AnalysisHistory({ versions, currentId }: { versions: AnalysisVersion[]; currentId?: string }) {
  if (versions.length === 0) return null;

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-surface">
      <Table className="min-w-140">
        <TableHeader>
          <TableRow>
            <TableHead>Versão</TableHead>
            <TableHead>Situação</TableHead>
            <TableHead>Data</TableHead>
            <TableHead className="text-right">Lance máximo</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {versions.map((version) => (
            <TableRow key={version.id} aria-current={version.id === currentId ? "true" : undefined}>
              <TableCell className="font-semibold">
                {version.id === currentId ? (
                  <span>v{version.version} (esta)</span>
                ) : (
                  <Link href={`/analise/${version.id}`} className="text-primary hover:underline">
                    v{version.version}
                  </Link>
                )}
              </TableCell>
              <TableCell>
                <span className="flex flex-wrap gap-1">
                  {version.status === "fixed" ? <Badge variant="success">Fixada</Badge> : <Badge>Rascunho</Badge>}
                  {version.knownResultAtCreation ? <Badge variant="warning">Retrospectiva</Badge> : null}
                </span>
              </TableCell>
              <TableCell className="whitespace-nowrap tabular-nums">
                {formatDateTime(version.fixedAt ?? version.updatedAt)}
              </TableCell>
              <TableCell className="text-right">
                {version.status === "fixed" && version.isViable === false ? (
                  <span className="text-muted">Sem lance viável</span>
                ) : (
                  <Money value={version.maxBid} />
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
