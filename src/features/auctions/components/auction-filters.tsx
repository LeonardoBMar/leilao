"use client";

import { Search } from "lucide-react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { type FormEvent, useTransition } from "react";

import { Button, Checkbox, Input, SelectField } from "@/components/ui";

import { ORIGIN_OPTIONS, STATUS_OPTIONS } from "../labels";

const ALL = "todos";

/** Valores atuais, exatamente como estão na URL. */
export type AuctionFilterValues = {
  busca?: string;
  origem?: string;
  status?: string;
  de?: string;
  ate?: string;
  ordem: "asc" | "desc";
  arquivados: boolean;
};

export function AuctionFilters({ values }: { values: AuctionFilterValues }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const activeCount = [values.busca, values.origem, values.status, values.de, values.ate].filter(Boolean).length;

  function navigate(params: URLSearchParams) {
    const query = params.toString();
    startTransition(() => router.push((query ? `/leiloes?${query}` : "/leiloes") as Route));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams();
    for (const [key, value] of new FormData(event.currentTarget)) {
      // Página volta para 1 ao filtrar; vazios e "todos" não vão para a URL.
      if (typeof value === "string" && value.trim() !== "" && value !== ALL && key !== "pagina") {
        params.set(key, value.trim());
      }
    }
    if (params.get("ordem") === "asc") params.delete("ordem");
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
      aria-label="Filtrar leilões"
      onSubmit={handleSubmit}
      // Remonta com os valores da URL após navegar (ex.: "Limpar filtros").
      key={JSON.stringify(values)}
      className="grid gap-4 rounded-lg border border-border bg-surface p-4 md:grid-cols-2 xl:grid-cols-[2fr_1fr_1fr_1fr_1fr]"
    >
      <Input
        name="busca"
        type="search"
        label="Buscar"
        placeholder="Nome ou organizador"
        defaultValue={values.busca}
        containerClassName="md:col-span-2 xl:col-span-1"
      />
      <SelectField
        name="origem"
        label="Origem"
        defaultValue={values.origem ?? ALL}
        options={[{ value: ALL, label: "Todas" }, ...ORIGIN_OPTIONS]}
      />
      <SelectField
        name="status"
        label="Status"
        defaultValue={values.status ?? ALL}
        options={[{ value: ALL, label: "Todos" }, ...STATUS_OPTIONS]}
      />
      <Input name="de" type="date" label="De" defaultValue={values.de} />
      <Input name="ate" type="date" label="Até" defaultValue={values.ate} />
      <SelectField
        name="ordem"
        label="Ordenar por data"
        defaultValue={values.ordem}
        options={[
          { value: "asc", label: "Mais antigos primeiro" },
          { value: "desc", label: "Mais recentes primeiro" },
        ]}
      />
      <Checkbox
        name="arquivados"
        value="1"
        label="Mostrar somente arquivados"
        defaultChecked={values.arquivados}
        containerClassName="self-end"
      />
      <div className="flex flex-wrap items-end gap-3 md:col-span-2 xl:col-span-3 xl:justify-end">
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
