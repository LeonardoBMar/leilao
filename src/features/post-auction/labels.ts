import type { ComponentProps } from "react";

import type { Badge } from "@/components/ui";
import type { ExpenseCategory, PostAuctionStatus } from "@/domain/post-auction/pnl";

type BadgeVariant = NonNullable<ComponentProps<typeof Badge>["variant"]>;

export const POST_AUCTION_STATUS_LABELS = {
  acquired: "Arrematado",
  in_transit: "Em transporte",
  in_repair: "Em preparação / oficina",
  ready_for_sale: "Pronto para venda",
  listed: "Anunciado",
  sold: "Vendido",
} satisfies Record<PostAuctionStatus, string>;

export const POST_AUCTION_STATUS_VARIANTS = {
  acquired: "outline",
  in_transit: "default",
  in_repair: "warning",
  ready_for_sale: "primary",
  listed: "primary",
  sold: "success",
} satisfies Record<PostAuctionStatus, BadgeVariant>;

export const EXPENSE_CATEGORY_LABELS = {
  auction_commission: "Comissão do leiloeiro",
  auction_fees: "Taxas do leilão / pátio",
  debts: "Débitos (IPVA / multas)",
  transport: "Transporte / guincho",
  documentation: "Documentação / despachante",
  repair: "Reparos / oficina / peças",
  tires: "Pneus",
  service: "Revisão / manutenção",
  selling: "Comercialização / anúncios",
  tax: "Impostos na revenda",
  other: "Outras despesas",
} satisfies Record<ExpenseCategory, string>;
