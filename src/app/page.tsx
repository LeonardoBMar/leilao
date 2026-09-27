import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui";

import { ComponentShowcase } from "./component-showcase";

export default function Home() {
  return (
    <main className="min-h-screen">
      <div className="border-b border-border bg-surface">
        <div className="mx-auto flex h-16 max-w-7xl items-center px-4 md:px-6 lg:px-8">
          <span className="text-body font-semibold tracking-tight text-foreground">Leilão Tracker</span>
          <Badge className="ml-3" variant="primary">
            UI foundation
          </Badge>
        </div>
      </div>
      <div className="mx-auto grid max-w-7xl min-w-0 gap-10 px-4 py-6 md:px-6 md:py-8 lg:px-8 lg:py-10">
        <PageHeader
          eyebrow="Design system"
          title="Base visual pronta para o produto"
          description="Componentes reutilizáveis alinhados ao DESIGN.md, com estados acessíveis e APIs pequenas para os próximos fluxos do Leilão Tracker."
        />
        <ComponentShowcase />
      </div>
    </main>
  );
}
