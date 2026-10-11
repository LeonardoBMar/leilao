import { formatRatio } from "@/lib/format";

/** Formatos de valor dos gráficos client, escolhidos pelo nome (um Server Component não passa função ao cliente). */
export const CHART_FORMATS = { ratio: formatRatio } as const satisfies Record<string, (value: number) => string>;

export type ChartFormat = keyof typeof CHART_FORMATS;
