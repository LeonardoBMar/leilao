import type { Metadata } from "next";

import { PageHeader } from "@/components/layout/page-header";

import { ChartShowcase } from "./chart-showcase";
import { ComponentShowcase } from "./component-showcase";
import { DomainShowcase } from "./domain-showcase";

export const metadata: Metadata = { title: "Componentes · Leilão Tracker" };

/** Referência visual das primitivas (DESIGN.md) enquanto não há Storybook. Fora da navegação. */
export default function ComponentsPage() {
  return (
    <div className="grid gap-10">
      <PageHeader
        eyebrow="Design system"
        title="Componentes"
        description="Primitivas de @/components/ui com seus estados, alinhadas ao DESIGN.md."
      />
      <ComponentShowcase />
      <DomainShowcase />
      <ChartShowcase />
    </div>
  );
}
