import { Badge, Skeleton, Stat } from "@/components/ui";
import { DEFAULT_COSTS } from "@/domain/finance/defaults";
import { formatBps, formatDateTime } from "@/lib/format";

import { getUserPreferences } from "../queries";
import { PreferencesForm } from "./preferences-form";

export async function PreferencesView() {
  const preferences = await getUserPreferences();
  const activeMargin = preferences.costOverrides.desiredMarginRateBps ?? DEFAULT_COSTS.desiredMarginRate;
  const activeReserve = preferences.costOverrides.riskReserveRateBps ?? DEFAULT_COSTS.riskReserveRate;

  return (
    <div className="grid gap-8">
      <dl className="grid gap-4 border-y border-border py-4 sm:grid-cols-3">
        <Stat
          label="Região ativa"
          size="lg"
          note={<span className="tabular-nums">Raio de {preferences.region.radiusKm.toLocaleString("pt-BR")} km</span>}
        >
          {preferences.region.label}
        </Stat>
        <Stat
          label="Margem e reserva ativas"
          size="lg"
          note={<span className="tabular-nums">Reserva de {formatBps(activeReserve)}</span>}
        >
          <span className="tabular-nums">{formatBps(activeMargin)}</span>
        </Stat>
        <Stat
          label="Situação"
          size="body"
          note={
            preferences.raw.updatedAt ? (
              <span className="tabular-nums">Atualizado em {formatDateTime(preferences.raw.updatedAt)}</span>
            ) : (
              "Nenhuma sobrescrita salva"
            )
          }
        >
          <Badge variant="default">{preferences.hasOverrides ? "Personalizado" : "Padrão do sistema"}</Badge>
        </Stat>
      </dl>

      <PreferencesForm preferences={preferences} />
    </div>
  );
}

export function PreferencesSkeleton() {
  return (
    <div className="grid gap-8">
      <div className="grid gap-4 border-y border-border py-4 sm:grid-cols-3">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
      </div>
      <div className="grid gap-4">
        <Skeleton className="h-6 w-36" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      </div>
      <div className="grid gap-6 border-t border-border pt-6">
        <Skeleton className="h-6 w-56" />
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
        <div className="grid gap-4 border-t border-border pt-5 md:grid-cols-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
        <div className="grid gap-4 border-t border-border pt-5 sm:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      </div>
      <div className="flex items-center justify-between border-t border-border pt-5">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-9 w-40" />
      </div>
    </div>
  );
}
