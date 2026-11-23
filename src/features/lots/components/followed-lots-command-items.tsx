import type { Route } from "next";

import { CommandPaletteItems, type QuickJumpItem } from "@/components/layout/command-palette-store";

import { getFollowedLotsBase } from "../queries";

const MAX_COMMAND_LOTS = 15;

/**
 * Alimenta a paleta de comandos (`⌘K`) com os lotes acompanhados ativos (D-87).
 * Reaproveita `getFollowedLotsBase` (memo em `React.cache`), sem consulta extra ao banco. Renderizar em `<Suspense>`.
 */
export async function FollowedLotsCommandItems() {
  const rows = await getFollowedLotsBase();
  if (rows.length === 0) return null;

  const items: QuickJumpItem[] = rows.slice(0, MAX_COMMAND_LOTS).map((row) => ({
    href: `/lotes/${row.id}` as Route,
    label: `${row.brand} ${row.model} ${row.modelYear}`,
    meta: `Lote ${row.lotNumber} · ${row.auction.name}`,
    keywords: `${row.lotNumber} ${row.brand} ${row.model} ${row.vehicleVersion ?? ""} ${row.auction.name}`,
  }));

  return <CommandPaletteItems items={items} />;
}
