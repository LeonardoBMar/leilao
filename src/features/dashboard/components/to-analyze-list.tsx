"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import Link from "next/link";
import { type ReactNode, useState } from "react";

import { Button } from "@/components/ui";
import { CATALOG_LISTINGS_PATH, withQuery } from "@/features/listings/search";

type ToAnalyzeListProps = {
  /** Primeiros lotes visíveis sem expandir (renderizados no servidor). */
  initial: ReactNode[];
  /** Demais lotes que cabem no limite, revelados inline ao expandir. */
  extra: ReactNode[];
  /** Quantos lotes ainda ficaram além do limite carregado na home. */
  beyondLoaded: number;
};

/** Lista expansível de "Para analisar agora": mantém o critério "cabe no limite" sem jogar o usuário no catálogo genérico. */
export function ToAnalyzeList({ initial, extra, beyondLoaded }: ToAnalyzeListProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="grid gap-5">
      <ul className="grid gap-5">
        {initial}
        {expanded ? extra : null}
      </ul>

      {extra.length > 0 || beyondLoaded > 0 ? (
        <div className="flex flex-wrap items-center gap-4">
          {extra.length > 0 ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              aria-expanded={expanded}
              onClick={() => setExpanded((current) => !current)}
            >
              {expanded ? (
                <>
                  Mostrar menos
                  <ChevronUp aria-hidden="true" />
                </>
              ) : (
                <>
                  Ver mais {extra.length} {extra.length === 1 ? "lote" : "lotes"} que cabem no limite
                  <ChevronDown aria-hidden="true" />
                </>
              )}
            </Button>
          ) : null}

          {expanded && beyondLoaded > 0 ? (
            <Link
              href={withQuery(CATALOG_LISTINGS_PATH, { analisados: "esconder" })}
              className="w-fit text-label text-accent hover:underline"
            >
              +{beyondLoaded} além dos 24 exibidos · Abrir catálogo completo
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
