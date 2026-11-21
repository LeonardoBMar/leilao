import { recordResultAction } from "../actions";
import { getLotResultContext } from "../queries";
import type { LotResultContext } from "../types";
import { ResultDialog } from "./result-dialog";

type RecordResultButtonProps = {
  lotId: string;
  /** Contexto pré-carregado em lote (evita N+1 em listas). Se omitido, busca sob demanda. */
  context?: LotResultContext;
  label?: string;
  variant?: "primary" | "secondary" | "ghost" | "link";
  size?: "sm" | "md";
};

/** Abre o modal de resultado fora da ficha (ex.: pendências do dashboard). Lote inexistente: nada. */
export async function RecordResultButton({ lotId, context: preloaded, ...props }: RecordResultButtonProps) {
  const context = preloaded ?? (await getLotResultContext(lotId));
  if (!context) return null;
  return (
    <ResultDialog
      key={context.current?.revision ?? 0}
      action={recordResultAction.bind(null, lotId)}
      context={context}
      {...props}
    />
  );
}
