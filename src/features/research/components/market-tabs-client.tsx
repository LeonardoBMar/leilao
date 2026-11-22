"use client";

import type { Route } from "next";
import { useSearchParams } from "next/navigation";

import { LinkTabs } from "@/components/ui";

import { CALIBRATION_PATH, MARKET_PATH, PANORAMA_PATH } from "../search";
import type { MarketTab } from "./market-tabs";

/** Parâmetros compartilhados entre Avaliar e Panorama para preservar o recorte ao alternar abas. */
const SHARED_PARAMS = ["marca", "modelo", "condicao", "anode", "anoate", "kmate"] as const;

function withSharedParams(basePath: string, current: URLSearchParams): Route {
  const next = new URLSearchParams();
  for (const key of SHARED_PARAMS) {
    const value = current.get(key);
    if (value) next.set(key, value);
  }
  const query = next.toString();
  return (query ? `${basePath}?${query}` : basePath) as Route;
}

/** Versão cliente das abas que mantém o modelo e filtros compatíveis ao alternar entre Avaliar e Panorama. */
export function MarketTabsClient({ active }: { active: MarketTab }) {
  const searchParams = useSearchParams();
  return (
    <LinkTabs
      label="Visões do mercado"
      layoutId="market-tabs"
      tabs={[
        { href: withSharedParams(MARKET_PATH, searchParams), label: "Avaliar", active: active === "evaluate" },
        { href: withSharedParams(PANORAMA_PATH, searchParams), label: "Panorama", active: active === "panorama" },
        { href: CALIBRATION_PATH, label: "Calibração", active: active === "calibration" },
      ]}
    />
  );
}
