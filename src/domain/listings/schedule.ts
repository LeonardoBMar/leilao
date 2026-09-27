import { isFinalStatus, type ListingStatus } from "./types";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** Depois do fim, espera 1 h para a fonte consolidar o desfecho antes de revisitar. */
export const AFTER_END_DELAY_MS = HOUR;
/** Anúncio aberto na região de interesse: lance atualizado a cada 6 h. */
export const OPEN_REFRESH_MS = 6 * HOUR;
/** Desfecho pendente (condicional, desconhecido ou aberto além do fim): revisita diária. */
export const PENDING_REFRESH_MS = DAY;
/** Passado este prazo do fim sem desfecho definitivo, para de revisitar. */
export const GIVE_UP_AFTER_END_MS = 14 * DAY;
/** Falhas seguidas de acesso ao anúncio antes de desistir. */
export const MAX_CHECK_FAILURES = 5;

type ScheduleInput = {
  status: ListingStatus;
  endsAt: Date | null;
  /** Dentro da região de algum interesse (ex.: 150 km de São Carlos): vale acompanhar o lance. */
  inRegion: boolean;
  now: Date;
};

/**
 * Quando revisitar o anúncio (docs/PLANO-COLETA.md §4). `null`: não precisa mais voltar.
 * Fora da região, o lance em andamento não importa: só volta depois do fim, para gravar o arremate.
 */
export function nextCheckAt({ status, endsAt, inRegion, now }: ScheduleInput): Date | null {
  if (isFinalStatus(status)) return null;
  const at = (ms: number) => new Date(now.getTime() + ms);

  if (!endsAt) return at(inRegion ? OPEN_REFRESH_MS : PENDING_REFRESH_MS);
  if (now.getTime() > endsAt.getTime() + GIVE_UP_AFTER_END_MS) return null;

  const afterEnd = new Date(endsAt.getTime() + AFTER_END_DELAY_MS);
  if (status === "open" && now < afterEnd) {
    if (!inRegion) return afterEnd;
    return new Date(Math.min(afterEnd.getTime(), now.getTime() + OPEN_REFRESH_MS));
  }
  // Encerrado (ou deveria estar) sem desfecho definitivo.
  return at(PENDING_REFRESH_MS);
}

/** Espera crescente depois de uma falha de acesso: 1 h, 2 h, 4 h… e desiste após MAX_CHECK_FAILURES. */
export function retryAfterFailure(failures: number, now: Date): Date | null {
  if (failures >= MAX_CHECK_FAILURES) return null;
  return new Date(now.getTime() + 2 ** Math.max(0, failures - 1) * HOUR);
}
