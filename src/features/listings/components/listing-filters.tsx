"use client";

import { Search } from "lucide-react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { type FormEvent, useTransition } from "react";

import { Button, Input, SelectField } from "@/components/ui";

import {
  CATEGORY_KEYS,
  CATEGORY_OPTIONS,
  CONDITION_KEYS,
  CONDITION_OPTIONS,
  DEFAULT_CATEGORY,
  DEFAULT_CONDITION,
  DEFAULT_DISTANCE,
  DISTANCE_OPTIONS,
} from "../schemas";

const BASE_PATH = "/descobertos";

/** Valores atuais, exatamente como estão na URL. */
export type ListingFilterValues = {
  busca?: string;
  anoDe?: string;
  anoAte?: string;
  precoAte?: string;
  distancia: string;
  categoria: string;
  condicao: string;
  situacao: "abertos" | "encerrados";
};

/** Distâncias contam a partir da região padrão, que a linha de status da coleta mostra logo acima. */
export function ListingFilters({ values }: { values: ListingFilterValues }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const activeCount = [
    values.busca,
    values.anoDe,
    values.anoAte,
    values.precoAte,
    values.distancia !== DEFAULT_DISTANCE,
    values.categoria !== DEFAULT_CATEGORY,
    values.condicao !== DEFAULT_CONDITION,
    values.situacao !== "abertos",
  ].filter(Boolean).length;

  function navigate(params: URLSearchParams) {
    const query = params.toString();
    startTransition(() => router.push((query ? `${BASE_PATH}?${query}` : BASE_PATH) as Route, { scroll: false }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams();
    for (const [key, value] of new FormData(event.currentTarget)) {
      if (typeof value !== "string" || value.trim() === "") continue;
      // Padrões não vão para a URL.
      const isDefault =
        (key === "distancia" && value === DEFAULT_DISTANCE) ||
        (key === "categoria" && value === DEFAULT_CATEGORY) ||
        (key === "condicao" && value === DEFAULT_CONDITION) ||
        (key === "situacao" && value === "abertos");
      if (isDefault) continue;
      params.set(key, value.trim());
    }
    navigate(params);
  }

  return (
    <form
      role="search"
      aria-label="Filtrar lotes descobertos"
      onSubmit={handleSubmit}
      key={JSON.stringify(values)}
      className="grid gap-4 rounded-lg border border-border bg-surface p-4 md:grid-cols-2 xl:grid-cols-6"
    >
      <Input
        name="busca"
        type="search"
        label="Buscar"
        placeholder="Marca, modelo ou versão"
        defaultValue={values.busca}
        containerClassName="md:col-span-2"
      />
      <Input
        name="anoDe"
        type="number"
        inputMode="numeric"
        label="Ano de"
        min={1900}
        max={2100}
        defaultValue={values.anoDe}
      />
      <Input
        name="anoAte"
        type="number"
        inputMode="numeric"
        label="Ano até"
        min={1900}
        max={2100}
        defaultValue={values.anoAte}
      />
      <Input
        name="precoAte"
        type="number"
        inputMode="numeric"
        label="Lance até (R$)"
        min={1}
        step={1}
        defaultValue={values.precoAte}
      />
      <SelectField
        name="distancia"
        label="Distância"
        defaultValue={values.distancia}
        options={[
          ...DISTANCE_OPTIONS.map((km) => ({ value: km, label: `Até ${km} km` })),
          { value: "todas", label: "Qualquer distância" },
        ]}
      />
      <SelectField
        name="categoria"
        label="Categoria"
        defaultValue={values.categoria}
        options={CATEGORY_KEYS.map((key) => ({ value: key, label: CATEGORY_OPTIONS[key].label }))}
        className="md:col-span-1 xl:col-span-2"
      />
      <SelectField
        name="situacao"
        label="Situação"
        defaultValue={values.situacao}
        options={[
          { value: "abertos", label: "Abertos" },
          { value: "encerrados", label: "Encerrados" },
        ]}
        className="md:col-span-1 xl:col-span-1"
      />
      <SelectField
        name="condicao"
        label="Condição"
        defaultValue={values.condicao}
        options={CONDITION_KEYS.map((key) => ({ value: key, label: CONDITION_OPTIONS[key].label }))}
        className="md:col-span-2 xl:col-span-1"
      />
      <div className="flex flex-wrap items-end gap-3 md:col-span-2 xl:col-span-2 xl:justify-end">
        {activeCount > 0 ? (
          <Button type="button" variant="ghost" onClick={() => navigate(new URLSearchParams())} disabled={isPending}>
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
