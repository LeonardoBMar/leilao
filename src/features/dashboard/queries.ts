import "server-only";

import { requireUser } from "@/server/auth";
import { db } from "@/server/db";

import type { DashboardSummary } from "./types";

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const user = await requireUser();
  // Lote ativo: não arquivado e de leilão não arquivado (RF-08).
  const activeLot = { ownerId: user.id, archivedAt: null, auction: { archivedAt: null } };

  const [activeAuctions, activeLots, followedLotsWithoutResult, analyzedLots] = await Promise.all([
    db.auction.count({ where: { ownerId: user.id, archivedAt: null } }),
    db.lot.count({ where: activeLot }),
    db.lot.count({ where: { ...activeLot, isFollowed: true, results: { none: {} } } }),
    db.lot.count({ where: { ...activeLot, analyses: { some: { status: "fixed" } } } }),
  ]);

  return { activeAuctions, activeLots, followedLotsWithoutResult, analyzedLots };
}
