import { ClipboardList } from "lucide-react";

import { ButtonLink, Card } from "@/components/ui";
import { DEFAULT_EVALUATE_FILTERS } from "@/domain/research/evaluate";

import { getEvaluateLotShortcuts } from "../queries";
import { evaluateHref } from "../search";
import type { ResearchModelOption } from "../types";
import { RecentModelLinks } from "./recent-model-links";

/** Mais vendidos sugeridos na entrada. */
const TOP_MODELS = 4;

/**
 * Entrada do Avaliar sem veículo (docs/PLANO-MERCADO.md §5.2): a pergunta da tela e atalhos para o que o usuário
 * costuma avaliar — os próprios lotes (abrem com o lote como alvo), os modelos buscados por último e os mais vendidos.
 */
export async function EvaluateEntry({ models }: { models: readonly ResearchModelOption[] }) {
  const lots = await getEvaluateLotShortcuts();
  const top = models.slice(0, TOP_MODELS);
  return (
    <Card className="grid gap-6 p-5 md:p-6">
      <div className="grid gap-1">
        <h2 className="text-heading-2 text-foreground">Quanto este veículo costuma sair em leilão?</h2>
        <p className="text-body text-muted">
          Busque um modelo acima ou comece por um dos seus lotes: a faixa vem das vendas parecidas do catálogo.
        </p>
      </div>
      {lots.length === 0 ? null : (
        <section aria-labelledby="entrada-lotes" className="grid gap-2.5 rounded-md bg-surface-subtle p-4">
          <h3 id="entrada-lotes" className="text-label font-medium text-foreground">
            Seus lotes em acompanhamento
          </h3>
          <div className="flex flex-wrap gap-2">
            {lots.map((lot) => (
              <ButtonLink
                key={lot.id}
                href={evaluateHref({ ...DEFAULT_EVALUATE_FILTERS, lot: lot.id })}
                variant="secondary"
                size="sm"
              >
                <ClipboardList aria-hidden="true" />
                {lot.label}
              </ButtonLink>
            ))}
          </div>
        </section>
      )}
      <RecentModelLinks />
      {top.length === 0 ? null : (
        <section aria-labelledby="entrada-mais-vendidos" className="grid gap-2">
          <h3 id="entrada-mais-vendidos" className="text-label text-foreground">
            Mais vendidos no último ano
          </h3>
          <div className="flex flex-wrap gap-2">
            {top.map((model) => (
              <ButtonLink
                key={`${model.brand}|${model.model}`}
                href={evaluateHref({
                  ...DEFAULT_EVALUATE_FILTERS,
                  vehicle: { brand: model.brand, model: model.model },
                })}
                variant="secondary"
                size="sm"
              >
                {model.label}
                <span className="text-muted tabular-nums">{model.sales.toLocaleString("pt-BR")}</span>
              </ButtonLink>
            ))}
          </div>
        </section>
      )}
    </Card>
  );
}
