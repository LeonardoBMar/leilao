import { LinkTabs } from "@/components/ui";

import { CATALOG_AUCTIONS_PATH, CATALOG_LISTINGS_PATH, withQuery } from "../search";

/** Abas de "Leilões" (D-42): os mesmos filtros, agrupados por leilão ou soltos. */
export function CatalogTabs({
  active,
  params,
}: {
  active: "auctions" | "listings";
  params: Record<string, string | undefined>;
}) {
  return (
    <LinkTabs
      label="Visões de leilões"
      tabs={[
        { href: withQuery(CATALOG_AUCTIONS_PATH, params), label: "Por leilão", active: active === "auctions" },
        { href: withQuery(CATALOG_LISTINGS_PATH, params), label: "Todos os veículos", active: active === "listings" },
      ]}
    />
  );
}
