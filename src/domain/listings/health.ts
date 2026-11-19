const MINUTE = 60 * 1000;

/** O workflow tem limite de 20 min: execução "em andamento" há mais de 30 min foi interrompida. */
export const RUN_INTERRUPTED_AFTER_MS = 30 * MINUTE;
/** Agendamento de 12 em 12 horas + folga para fila do GitHub: sem coleta concluída há 14 h, está atrasada. */
export const COLLECTION_LATE_AFTER_MS = 14 * 60 * MINUTE;

export type CollectorHealth = "never" | "running" | "ok" | "late" | "failed";

type LastRun = { status: "running" | "succeeded" | "failed"; startedAt: Date; finishedAt: Date | null };

/**
 * Saúde da coleta para mostrar no app (docs/PLANO-COLETA.md, etapa 1: falha visível no app).
 * Cobre o que o registro sozinho não mostra: execução que nunca terminou e agendamento que parou.
 */
export function collectorHealth(lastRun: LastRun | null, now: Date): CollectorHealth {
  if (!lastRun) return "never";
  const age = (date: Date) => now.getTime() - date.getTime();
  if (lastRun.status === "running") return age(lastRun.startedAt) > RUN_INTERRUPTED_AFTER_MS ? "failed" : "running";
  if (lastRun.status === "failed") return "failed";
  return age(lastRun.finishedAt ?? lastRun.startedAt) > COLLECTION_LATE_AFTER_MS ? "late" : "ok";
}

/** Da melhor para a pior: a saúde de várias fontes é a da pior delas. */
const SEVERITY: readonly CollectorHealth[] = ["ok", "running", "late", "failed"];

/** Saúde da coleta com várias fontes (D-37): a pior entre as últimas execuções de cada uma. Nenhuma: `never`. */
export function overallHealth(healths: readonly CollectorHealth[]): CollectorHealth {
  const known = healths.filter((health) => health !== "never");
  if (known.length === 0) return "never";
  return known.reduce((worst, health) => (SEVERITY.indexOf(health) > SEVERITY.indexOf(worst) ? health : worst));
}
