import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";

import { BreadcrumbLink, BreadcrumbPage, Breadcrumbs } from "@/components/layout/breadcrumbs";
import { PageHeader } from "@/components/layout/page-header";
import { ButtonLink } from "@/components/ui";
import { UniversalImportForm } from "@/features/lots/components/universal-import-form";

export const metadata: Metadata = { title: "Importar lote externo · Minhas análises · Leilão Tracker" };

export default function ImportLotPage() {
  return (
    <div className="grid gap-6">
      <Breadcrumbs>
        <BreadcrumbLink href="/minhas-analises">Minhas análises</BreadcrumbLink>
        <BreadcrumbPage>Importar lote externo</BreadcrumbPage>
      </Breadcrumbs>

      <PageHeader
        title="Importar lote externo"
        description="Analise veículos de qualquer leiloeiro (Copart, Sodré, Freitas, Milan, Loop, VIP e outros) com casamento FIPE automático."
        actions={
          <ButtonLink href="/minhas-analises" variant="secondary">
            <ArrowLeft aria-hidden="true" />
            Voltar
          </ButtonLink>
        }
      />

      <UniversalImportForm />
    </div>
  );
}
