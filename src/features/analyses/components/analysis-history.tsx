import type { Route } from "next";
import Link from "next/link";

import { Badge, Money, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui";
import { formatDateTime } from "@/lib/format";

import type { AnalysisVersion } from "../types";

/** Versões da análise de um lote (RF-05). Rolagem horizontal no mobile (DESIGN.md §5.11). */
export function AnalysisHistory({
  versions,
  currentId,
  compareId,
}: {
  versions: AnalysisVersion[];
  currentId?: string;
  compareId?: string;
}) {
  if (versions.length === 0) return null;
  const showCompare = currentId !== undefined && versions.length > 1;

  return (
    <div className="overflow-x-auto">
      <Table className="min-w-120">
        <TableHeader>
          <TableRow>
            <TableHead>Versão</TableHead>
            <TableHead>Situação</TableHead>
            <TableHead>Data</TableHead>
            <TableHead className="text-right">Lance máximo</TableHead>
            {showCompare ? <TableHead className="text-right">Comparar</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {versions.map((version) => {
            const isCurrent = version.id === currentId;
            const isComparing = compareId !== undefined && version.id === compareId;
            return (
              <TableRow key={version.id} aria-current={isCurrent ? "true" : undefined}>
                <TableCell className="font-mono text-label">
                  {isCurrent ? (
                    <span>v{version.version} (esta)</span>
                  ) : (
                    <Link href={`/analise/${version.id}`} className="text-accent hover:underline">
                      v{version.version}
                    </Link>
                  )}
                </TableCell>
                <TableCell>
                  <span className="flex flex-wrap gap-1">
                    {version.status === "fixed" ? <Badge>Fixada</Badge> : <Badge variant="warning">Rascunho</Badge>}
                    {version.knownResultAtCreation ? <Badge variant="warning">Retrospectiva</Badge> : null}
                  </span>
                </TableCell>
                <TableCell className="whitespace-nowrap tabular-nums">
                  {formatDateTime(version.fixedAt ?? version.updatedAt)}
                </TableCell>
                <TableCell className="text-right font-semibold">
                  {version.status === "fixed" && version.isViable === false ? (
                    <span className="text-muted">Sem lance viável</span>
                  ) : (
                    <Money value={version.maxBid} />
                  )}
                </TableCell>
                {showCompare ? (
                  <TableCell className="text-right whitespace-nowrap">
                    {isCurrent ? (
                      <span className="text-caption text-muted">—</span>
                    ) : isComparing ? (
                      <Link href={`/analise/${currentId}`} className="text-label text-muted hover:underline">
                        Fechar
                      </Link>
                    ) : (
                      <Link
                        href={`/analise/${currentId}?comparar=${version.id}` as Route}
                        className="text-label text-accent hover:underline"
                      >
                        Comparar
                      </Link>
                    )}
                  </TableCell>
                ) : null}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
