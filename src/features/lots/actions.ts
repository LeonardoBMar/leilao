"use server";

import { refresh, revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { DILIGENCE_KEYS, type DiligenceKey } from "@/domain/lots/diligence";
import { auditNoticeText } from "@/domain/lots/notice-audit";
import { applyNoticeFeesToDraft, createDraft } from "@/features/analyses/mutations";
import { type ActionState, failure, validationError } from "@/lib/action-state";
import { extractPdfText, MAX_PDF_BYTES } from "@/lib/pdf-text";
import { entityId } from "@/lib/schemas";

import {
  createLot,
  deleteLot,
  type DeleteLotError,
  type LotStateError,
  type SaveLotError,
  saveLotNoticeAudit,
  setLotArchived,
  setLotFollowed,
  toggleLotDiligenceItem,
  updateCurrentBid,
  updateLot,
  updateLotsState,
} from "./mutations";
import { getLot } from "./queries";
import { currentBidInputSchema, lotIdSchema, lotInputSchema } from "./schemas";

const NOT_FOUND = "Lote não encontrado.";
const auctionIdSchema = entityId();

const SAVE_ERRORS = {
  not_found: NOT_FOUND,
  auction_not_found: "Leilão não encontrado.",
  duplicate_lot_number: "Já existe um lote com este número neste leilão.",
} satisfies Record<SaveLotError, string>;

const STATE_ERRORS = { not_found: NOT_FOUND } satisfies Record<LotStateError, string>;

const DELETE_ERRORS = {
  not_found: NOT_FOUND,
  has_history: "Este lote tem análise fixada ou resultado registrado. Arquive-o para preservar o histórico.",
} satisfies Record<DeleteLotError, string>;

export async function createLotAction(auctionId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsedAuctionId = auctionIdSchema.safeParse(auctionId);
  if (!parsedAuctionId.success) return failure(SAVE_ERRORS.auction_not_found);
  const parsed = lotInputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error, formData);

  const result = await createLot(parsedAuctionId.data, parsed.data);
  if (!result.ok) return duplicateOr(result.error, formData);

  // "Cadastrar e analisar": o lote manual sempre precisa de análise; vai direto ao rascunho.
  if (formData.get("intent") === "analyze") {
    const draft = await createDraft(result.value.id);
    if (draft.ok) redirect(`/analise/${draft.value.id}`);
  }
  redirect(`/lotes/${result.value.id}`);
}

export async function updateLotAction(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsedId = lotIdSchema.safeParse(id);
  if (!parsedId.success) return failure(NOT_FOUND);
  const parsed = lotInputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error, formData);

  const result = await updateLot(parsedId.data, parsed.data);
  if (!result.ok) return duplicateOr(result.error, formData);

  refresh();
  return { status: "success", message: "Lote atualizado." };
}

export async function updateCurrentBidAction(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsedId = lotIdSchema.safeParse(id);
  if (!parsedId.success) return failure(NOT_FOUND);
  const parsed = currentBidInputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error, formData);

  const result = await updateCurrentBid(parsedId.data, parsed.data.currentBid ?? null);
  if (!result.ok) return failure(STATE_ERRORS[result.error]);

  refresh();
  return { status: "success", message: "Lance atual atualizado." };
}

export async function setLotFollowedAction(id: string, isFollowed: boolean): Promise<ActionState> {
  const parsedId = lotIdSchema.safeParse(id);
  const parsedFollowed = z.boolean().safeParse(isFollowed);
  if (!parsedId.success) return failure(NOT_FOUND);
  if (!parsedFollowed.success) return failure("Valor inválido.");

  const result = await setLotFollowed(parsedId.data, parsedFollowed.data);
  if (!result.ok) return failure(STATE_ERRORS[result.error]);

  refresh();
  return { status: "success" };
}

export async function setLotArchivedAction(id: string, archived: boolean): Promise<ActionState> {
  const parsedId = lotIdSchema.safeParse(id);
  const parsedArchived = z.boolean().safeParse(archived);
  if (!parsedId.success) return failure(NOT_FOUND);
  if (!parsedArchived.success) return failure("Valor inválido.");

  const result = await setLotArchived(parsedId.data, parsedArchived.data);
  if (!result.ok) return failure(STATE_ERRORS[result.error]);

  refresh();
  return { status: "success", message: parsedArchived.data ? "Lote arquivado." : "Lote reativado." };
}

export type BulkLotOperation = "follow" | "unfollow" | "archive" | "unarchive";

const bulkLotSchema = z.object({
  ids: z.array(lotIdSchema).min(1).max(100),
  operation: z.enum(["follow", "unfollow", "archive", "unarchive"]),
});

const BULK_CHANGES = {
  follow: { isFollowed: true },
  unfollow: { isFollowed: false },
  archive: { archived: true },
  unarchive: { archived: false },
} satisfies Record<BulkLotOperation, { isFollowed: boolean } | { archived: boolean }>;

const BULK_MESSAGES = {
  follow: ["acompanhado", "acompanhados"],
  unfollow: ["deixou de ser acompanhado", "deixaram de ser acompanhados"],
  archive: ["arquivado", "arquivados"],
  unarchive: ["reativado", "reativados"],
} satisfies Record<BulkLotOperation, readonly [string, string]>;

/** Ações em lote da lista de lotes (Minhas análises). */
export async function bulkLotAction(ids: string[], operation: BulkLotOperation): Promise<ActionState> {
  const parsed = bulkLotSchema.safeParse({ ids, operation });
  if (!parsed.success) return failure("Seleção inválida. Recarregue a página e tente de novo.");

  const count = await updateLotsState(parsed.data.ids, BULK_CHANGES[parsed.data.operation]);
  if (count === 0) return failure("Nenhum dos lotes selecionados foi encontrado.");

  refresh();
  const [one, many] = BULK_MESSAGES[parsed.data.operation];
  return { status: "success", message: count === 1 ? `1 lote ${one}.` : `${count} lotes ${many}.` };
}

export async function deleteLotAction(id: string): Promise<ActionState> {
  const parsedId = lotIdSchema.safeParse(id);
  if (!parsedId.success) return failure(NOT_FOUND);

  const result = await deleteLot(parsedId.data);
  if (!result.ok) return failure(DELETE_ERRORS[result.error]);

  redirect(`/minhas-analises/leiloes/${result.value.auctionId}`);
}

const diligenceKeySchema = z.enum(DILIGENCE_KEYS);

/** Marca ou desmarca um item do checklist de diligência pré-lance do lote (D-97). */
export async function toggleDiligenceItemAction(
  lotId: string,
  key: DiligenceKey,
  checked: boolean,
): Promise<ActionState> {
  const parsedId = lotIdSchema.safeParse(lotId);
  const parsedKey = diligenceKeySchema.safeParse(key);
  const parsedChecked = z.boolean().safeParse(checked);
  if (!parsedId.success) return failure(NOT_FOUND);
  if (!parsedKey.success || !parsedChecked.success) return failure("Item de diligência inválido.");

  const result = await toggleLotDiligenceItem(parsedId.data, parsedKey.data, parsedChecked.data);
  if (!result.ok) return failure(STATE_ERRORS[result.error]);

  revalidatePath(`/lotes/${parsedId.data}`);
  revalidatePath("/analise/[id]", "page");
  refresh();
  return { status: "success" };
}

const MAX_NOTICE_FILE_BYTES = MAX_PDF_BYTES;
const MAX_NOTICE_TEXT_CHARS = 250_000;

/** Executa auditoria determinística de edital (texto colado ou PDF/TXT) e salva o resumo no lote (D-97). */
export async function auditLotNoticeAction(
  lotId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsedId = lotIdSchema.safeParse(lotId);
  if (!parsedId.success) return failure(NOT_FOUND);

  const fileEntry = formData.get("noticeFile");
  const rawTextEntry = formData.get("noticeText");
  let sourceLabel = "Texto colado";
  let text = typeof rawTextEntry === "string" ? rawTextEntry.trim() : "";

  if (fileEntry instanceof File && fileEntry.size > 0) {
    if (fileEntry.size > MAX_NOTICE_FILE_BYTES) {
      return failure("O arquivo excede o limite de 4 MB. Cole o trecho relevante do edital abaixo.", formData);
    }
    const lowerName = fileEntry.name.toLowerCase();
    const isPdf = fileEntry.type === "application/pdf" || lowerName.endsWith(".pdf");
    const isTxt = fileEntry.type === "text/plain" || lowerName.endsWith(".txt");
    if (!isPdf && !isTxt) {
      return failure("Envie um arquivo PDF ou TXT, ou cole o texto do edital abaixo.", formData);
    }
    sourceLabel = fileEntry.name.slice(0, 120);
    if (isPdf) {
      const buffer = Buffer.from(await fileEntry.arrayBuffer());
      text = extractPdfText(buffer);
      if (text.length < 20) {
        return failure(
          "Não foi possível extrair texto deste PDF (pode ser escaneado como imagem). Copie e cole o texto do edital abaixo.",
          formData,
        );
      }
    } else {
      text = (await fileEntry.text()).trim();
    }
  }

  if (text.length < 20) {
    return failure("Cole ao menos um trecho do edital (mínimo de 20 caracteres) ou envie um PDF.", formData);
  }
  if (text.length > MAX_NOTICE_TEXT_CHARS) {
    text = text.slice(0, MAX_NOTICE_TEXT_CHARS);
  }

  const auditResult = auditNoticeText(text);
  const saved = await saveLotNoticeAudit(parsedId.data, {
    auditedAt: new Date().toISOString(),
    sourceLabel,
    result: auditResult,
  });
  if (!saved.ok) return failure(STATE_ERRORS[saved.error], formData);

  revalidatePath(`/lotes/${parsedId.data}`);
  refresh();
  const total = auditResult.findings.length;
  return {
    status: "success",
    message:
      total === 0
        ? "Edital auditado: nenhuma cláusula crítica padrão identificada."
        : total === 1
          ? "Edital auditado: 1 ponto identificado."
          : `Edital auditado: ${total} pontos identificados.`,
  };
}

/** Limpa a auditoria de edital salva no lote (D-97). */
export async function clearLotNoticeAuditAction(lotId: string): Promise<ActionState> {
  const parsedId = lotIdSchema.safeParse(lotId);
  if (!parsedId.success) return failure(NOT_FOUND);
  const result = await saveLotNoticeAudit(parsedId.data, null);
  if (!result.ok) return failure(STATE_ERRORS[result.error]);

  revalidatePath(`/lotes/${parsedId.data}`);
  refresh();
  return { status: "success", message: "Auditoria de edital removida." };
}

/** Leva comissão, taxa administrativa e teto de débitos encontrados no edital para o rascunho da análise (D-97). */
export async function applyNoticeFeesToDraftAction(lotId: string): Promise<ActionState> {
  const parsedId = lotIdSchema.safeParse(lotId);
  if (!parsedId.success) return failure(NOT_FOUND);

  const lot = await getLot(parsedId.data);
  if (!lot) return failure(NOT_FOUND);
  const fees = lot.noticeAudit?.result.extractedFees;
  if (!fees || (fees.commissionRateBps === null && fees.adminFeesCents === null && fees.debtsCapCents === null)) {
    return failure("Nenhuma taxa aplicável encontrada na auditoria salva.");
  }

  const applied = await applyNoticeFeesToDraft(parsedId.data, fees);
  if (!applied.ok) return failure(NOT_FOUND);

  revalidatePath(`/lotes/${parsedId.data}`);
  revalidatePath(`/analise/${applied.value.analysisId}`);
  redirect(`/analise/${applied.value.analysisId}`);
}

/** Número repetido é erro do campo, para aparecer junto do "Número do lote" (CA-02). */
function duplicateOr(error: SaveLotError, formData: FormData): ActionState {
  const state = failure(SAVE_ERRORS[error], formData);
  if (error !== "duplicate_lot_number" || state.status !== "error") return state;
  return { ...state, message: "Revise os campos destacados.", fieldErrors: { lotNumber: [SAVE_ERRORS[error]] } };
}
