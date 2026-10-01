"use client";

import { Search } from "lucide-react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { type FormEvent, useTransition } from "react";

import { Button, Checkbox, Input, SelectField } from "@/components/ui";

const ALL = "todos";

/** Valores atuais, exatamente como estão na URL. */
export type LotFilterValues = {
  busca?: string;
  acompanhados: boolean;
  analise?: "com" | "sem";
  resultado?: "com" | "sem";
  arquivados: boolean;
};

type LotFiltersProps = {
  values: LotFilterValues;
  /** Rota da listagem: `/lotes` ou `/leiloes/<id>`. */
  basePath: string;
};

export function LotFilters({ values, basePath }: LotFiltersProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const activeCount = [values.busca, values.acompanhados, values.analise, values.resultado].filter(Boolean).length;

  function navigate(params: URLSearchParams) {
    const query = params.toString();
    startTransition(() => router.push((query ? `${basePath}?${query}` : basePath) as Route, { scroll: false }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams();
    for (const [key, value] of new FormData(event.currentTarget)) {
      if (typeof value === "string" && value.trim() !== "" && value !== ALL) params.set(key, value.trim());
    }
    navigate(params);
  }

  function handleClear() {
    const params = new URLSearchParams();
    if (values.arquivados) params.set("arquivados", "1");
    navigate(params);
  }

  return (
    <form
      role="search"
      aria-label="Filtrar lotes"
      onSubmit={handleSubmit}
      key={JSON.stringify(values)}
      className="grid gap-4 border-b border-border pb-5 md:grid-cols-2 xl:grid-cols-[2fr_1fr_1fr]"
    >
      <Input
        name="busca"
        type="search"
        label="Buscar"
        placeholder="Buscar por lote, marca ou modelo"
        defaultValue={values.busca}
        containerClassName="md:col-span-2 xl:col-span-1"
      />
      <SelectField
        name="analise"
        label="Análise"
        defaultValue={values.analise ?? ALL}
        options={[
          { value: ALL, label: "Todas" },
          { value: "com", label: "Com análise fixada" },
          { value: "sem", label: "Sem análise fixada" },
        ]}
      />
      <SelectField
        name="resultado"
        label="Resultado"
        defaultValue={values.resultado ?? ALL}
        options={[
          { value: ALL, label: "Todos" },
          { value: "com", label: "Com resultado" },
          { value: "sem", label: "Sem resultado" },
        ]}
      />
      <div className="flex flex-wrap gap-x-6 md:col-span-2 xl:col-span-2">
        <Checkbox name="acompanhados" value="1" label="Somente acompanhados" defaultChecked={values.acompanhados} />
        <Checkbox name="arquivados" value="1" label="Somente arquivados" defaultChecked={values.arquivados} />
      </div>
      <div className="flex flex-wrap items-end gap-3 xl:justify-end">
        {activeCount > 0 ? (
          <Button type="button" variant="ghost" onClick={handleClear} disabled={isPending}>
            Limpar filtros ({activeCount})
          </Button>
        ) : null}
        <Button type="submit" loading={isPending} loadingLabel="Filtrando…">
          <Search aria-hidden="true" />
          Filtrar
        </Button>
      </div>
    </form>
  );
}
