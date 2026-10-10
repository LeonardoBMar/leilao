import { recordResultAction } from "../actions";
import { getLotResultContext } from "../queries";
import { ResultDialog } from "./result-dialog";

type RecordResultButtonProps = {
  lotId: string;
  label?: string;
  variant?: "primary" | "secondary" | "ghost" | "link";
  size?: "sm" | "md";
};

/** Abre o modal de resultado fora da ficha (ex.: pendências do dashboard). Lote inexistente: nada. */
export async function RecordResultButton({ lotId, ...props }: RecordResultButtonProps) {
  const context = await getLotResultContext(lotId);
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
