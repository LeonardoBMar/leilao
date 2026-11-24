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
        <Stat label="Região ativa" size="lg" note={`Raio de ${preferences.region.radiusKm} km`}>
          {preferences.region.label}
        </Stat>
        <Stat label="Margem e reserva ativas" size="lg" note={`Reserva de ${formatBps(activeReserve)}`}>
          {formatBps(activeMargin)}
        </Stat>
        <Stat
          label="Situação"
          size="body"
          note={
            preferences.raw.updatedAt
              ? `Atualizado em ${formatDateTime(preferences.raw.updatedAt)}`
              : "Nenhuma sobrescrita salva"
          }
        >
          <Badge variant={preferences.hasOverrides ? "primary" : "default"}>
            {preferences.hasOverrides ? "Personalizado" : "Padrão do sistema"}
          </Badge>
        </Stat>
      </dl>

      <PreferencesForm key={preferences.raw.updatedAt?.toISOString() ?? "defaults"} preferences={preferences} />
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
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    </div>
  );
}
