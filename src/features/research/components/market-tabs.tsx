import { Suspense } from "react";

import { LinkTabs } from "@/components/ui";

import { CALIBRATION_PATH, MARKET_PATH, type MarketTab, PANORAMA_PATH } from "../search";
import { MarketTabsClient } from "./market-tabs-client";

export type { MarketTab };

function StaticMarketTabs({ active }: { active: MarketTab }) {
  return (
    <LinkTabs
      label="Visões do mercado"
      layoutId="market-tabs"
      tabs={[
        { href: MARKET_PATH, label: "Avaliar", active: active === "evaluate" },
        { href: PANORAMA_PATH, label: "Panorama", active: active === "panorama" },
        { href: CALIBRATION_PATH, label: "Calibração", active: active === "calibration" },
      ]}
    />
  );
}

/**
 * Abas do Mercado (D-71): **Avaliar** responde quanto um veículo costuma sair; **Panorama** mostra o catálogo inteiro
 * (a antiga Pesquisa, D-45); **Calibração** compara os limites do usuário com os resultados. Alternar entre Avaliar e
 * Panorama preserva modelo e filtros compatíveis da URL.
 */
export function MarketTabs({ active }: { active: MarketTab }) {
  return (
    <Suspense fallback={<StaticMarketTabs active={active} />}>
      <MarketTabsClient active={active} />
    </Suspense>
  );
}
