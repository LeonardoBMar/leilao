"use client";

import type { Route } from "next";
import { useSearchParams } from "next/navigation";
import { useSyncExternalStore } from "react";

import { LinkTabs } from "@/components/ui";

import { CALIBRATION_PATH, MARKET_PATH, PANORAMA_PATH } from "../search";
import {
  marketContextServerSnapshot,
  marketContextSnapshot,
  pickSharedQuery,
  subscribeMarketContext,
} from "../tab-context";
import type { MarketTab } from "./market-tabs";

function withQueryString(basePath: string, query: string): Route {
  return (query ? `${basePath}?${query}` : basePath) as Route;
}

/**
 * Versão cliente das abas que mantém o modelo e filtros compatíveis ao alternar entre Avaliar, Panorama e Calibração
 * (inclusive quando o Avaliar foi aberto por `?lote=<id>` ou ao retornar da Calibração).
 */
export function MarketTabsClient({ active }: { active: MarketTab }) {
  const searchParams = useSearchParams();
  const saved = useSyncExternalStore(subscribeMarketContext, marketContextSnapshot, marketContextServerSnapshot);

  const urlShared = pickSharedQuery(searchParams);
  const shared = urlShared || saved.shared;

  const evaluateQuery =
    active === "evaluate"
      ? searchParams.toString()
      : active === "calibration"
        ? saved.evaluate || saved.shared
        : shared;

  return (
    <LinkTabs
      label="Visões do mercado"
      layoutId="market-tabs"
      tabs={[
        { href: withQueryString(MARKET_PATH, evaluateQuery), label: "Avaliar", active: active === "evaluate" },
        { href: withQueryString(PANORAMA_PATH, shared), label: "Panorama", active: active === "panorama" },
        { href: CALIBRATION_PATH, label: "Calibração", active: active === "calibration" },
      ]}
    />
  );
}
