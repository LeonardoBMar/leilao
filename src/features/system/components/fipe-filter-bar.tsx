"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button, Input, SelectField } from "@/components/ui";

import { type FipeQueueFilters, fipeQueueFiltersSchema } from "../schemas";

function buildFipeUrl(next: Partial<FipeQueueFilters>, current: FipeQueueFilters): Route {
  const merged = { ...current, ...next };
  const params = new URLSearchParams();
  if (merged.situacao !== "none") params.set("situacao", merged.situacao);
  if (merged.origem !== "todas") params.set("origem", merged.origem);
  if (merged.busca) params.set("busca", merged.busca);
  if (merged.item) params.set("item", merged.item);
  if (merged.tipo) params.set("tipo", String(merged.tipo));
  if (merged.marca) params.set("marca", merged.marca);
  const query = params.toString();
  return (query ? `/sistema/fipe?${query}` : "/sistema/fipe") as Route;
}

export function FipeFilterBar({ filters }: { filters: FipeQueueFilters }) {
  const router = useRouter();
  const [searchText, setSearchText] = useState(filters.busca ?? "");

  function apply(next: Partial<FipeQueueFilters>) {
    router.push(buildFipeUrl({ ...next, item: undefined, tipo: undefined, marca: undefined }, filters));
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        apply({ busca: searchText.trim() || undefined });
      }}
      className="flex flex-wrap items-end gap-3"
    >
      <div className="min-w-52 flex-1">
        <Input
          label="Buscar veículo"
          placeholder="Ex.: GOL, CIVIC, ONIX…"
          value={searchText}
          onChange={(event) => setSearchText(event.target.value)}
        />
      </div>

      <div className="w-44">
        <SelectField
          label="Situação"
          value={filters.situacao}
          onValueChange={(value) => {
            const parsed = fipeQueueFiltersSchema.shape.situacao.safeParse(value);
            if (parsed.success) apply({ situacao: parsed.data });
          }}
          options={[
            { value: "none", label: "Sem casamento" },
            { value: "version", label: "Versão" },
            { value: "family", label: "Família" },
            { value: "todos", label: "Todas" },
          ]}
        />
      </div>

      <div className="w-40">
        <SelectField
          label="Origem"
          value={filters.origem}
          onValueChange={(value) => {
            const parsed = fipeQueueFiltersSchema.shape.origem.safeParse(value);
            if (parsed.success) apply({ origem: parsed.data });
          }}
          options={[
            { value: "todas", label: "Todas" },
            { value: "auto", label: "Automática" },
            { value: "manual", label: "Manual" },
          ]}
        />
      </div>

      <div className="flex gap-2">
        <Button type="submit" variant="secondary">
          Filtrar
        </Button>
        {filters.situacao !== "none" || filters.origem !== "todas" || filters.busca ? (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setSearchText("");
              router.push("/sistema/fipe");
            }}
          >
            Limpar
          </Button>
        ) : null}
      </div>
    </form>
  );
}
