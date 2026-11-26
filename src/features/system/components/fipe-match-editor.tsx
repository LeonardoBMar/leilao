"use client";

import { RotateCcw, X } from "lucide-react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useActionState, useState } from "react";

import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  ButtonLink,
  Card,
  Checkbox,
  Input,
  SelectField,
  toast,
} from "@/components/ui";
import type { FipeVehicleType } from "@/domain/listings/fipe-match";
import { type ActionState, idleState } from "@/lib/action-state";
import { formatShortMonth } from "@/lib/format";

import { revertFipeMatchToAutoAction, saveManualFipeMatchAction } from "../actions";
import { FIPE_KIND_LABELS, FIPE_VEHICLE_TYPE_LABELS, fipeReasonLabel } from "../labels";
import type { FipeQueueFilters } from "../schemas";
import type { SystemFipeMatchEditor } from "../types";

type FipeMatchEditorProps = {
  editor: SystemFipeMatchEditor;
  filters: FipeQueueFilters;
};

function editorUrl(
  filters: FipeQueueFilters,
  overrides: { item?: string; tipo?: FipeVehicleType; marca?: string },
): Route {
  const params = new URLSearchParams();
  if (filters.situacao !== "revisao") params.set("situacao", filters.situacao);
  if (filters.origem !== "todas") params.set("origem", filters.origem);
  if (filters.busca) params.set("busca", filters.busca);
  if (overrides.item) params.set("item", overrides.item);
  if (overrides.tipo) params.set("tipo", String(overrides.tipo));
  if (overrides.marca) params.set("marca", overrides.marca);
  const query = params.toString();
  return (query ? `/sistema/fipe?${query}` : "/sistema/fipe") as Route;
}

const VEHICLE_TYPE_BY_KEY: Record<string, FipeVehicleType> = { "1": 1, "2": 2, "3": 3 };

export function FipeMatchEditor({ editor, filters }: FipeMatchEditorProps) {
  const router = useRouter();
  const { match, tableMonth, selectedType, selectedBrand, brands, candidates } = editor;
  const [selectedCodes, setSelectedCodes] = useState<string[]>(() =>
    match.models.map((model) => model.code).filter((code) => candidates.some((candidate) => candidate.code === code)),
  );
  const [candidateFilter, setCandidateFilter] = useState("");
  const [lastAction, setLastAction] = useState<"save" | "none" | "reset" | null>(null);
  const [saveState, saveModelsAction, savingModels] = useActionState(async (prev: ActionState, formData: FormData) => {
    setLastAction("save");
    const next = await saveManualFipeMatchAction(prev, formData);
    if (next.status === "success" && next.message) toast.success(next.message);
    else if (next.status === "error" && next.message) toast.error(next.message);
    return next;
  }, idleState);
  const [noneState, markNoneAction, markingNone] = useActionState(async (prev: ActionState, formData: FormData) => {
    setLastAction("none");
    const next = await saveManualFipeMatchAction(prev, formData);
    if (next.status === "success") {
      setSelectedCodes([]);
      if (next.message) toast.success(next.message);
    } else if (next.status === "error" && next.message) {
      toast.error(next.message);
    }
    return next;
  }, idleState);
  const [resetState, resetAction, resetting] = useActionState(async (prev: ActionState, formData: FormData) => {
    setLastAction("reset");
    const next = await revertFipeMatchToAutoAction(prev, formData);
    if (next.status === "success" && next.message) toast.success(next.message);
    else if (next.status === "error" && next.message) toast.error(next.message);
    return next;
  }, idleState);

  const query = candidateFilter.trim().toLowerCase();
  const visibleCandidates = query
    ? candidates.filter(
        (candidate) => candidate.label.toLowerCase().includes(query) || candidate.code.toLowerCase().includes(query),
      )
    : candidates;
  const validSelectedCodes = selectedCodes.filter((code) => candidates.some((candidate) => candidate.code === code));
  const latestState =
    lastAction === "save" ? saveState : lastAction === "none" ? noneState : lastAction === "reset" ? resetState : null;
  const activeError = latestState?.status === "error" && latestState.message ? latestState.message : null;

  function toggleCode(code: string) {
    setSelectedCodes((current) =>
      current.includes(code) ? current.filter((item) => item !== code) : [...current, code],
    );
  }

  const closeHref = editorUrl(filters, {});

  return (
    <Card className="grid gap-4 border-border-strong p-4 md:p-5" aria-label="Corrigir correlação FIPE">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-mono text-body font-semibold text-foreground">{match.vehicleKey}</h2>
            <Badge variant={match.origin === "manual" ? "default" : "outline"}>
              {match.origin === "manual" ? "Manual" : "Automática"}
            </Badge>
            <Badge variant={match.kind === "none" ? "warning" : "success"}>{FIPE_KIND_LABELS[match.kind]}</Badge>
          </div>
          <p className="text-caption text-muted">
            Afeta <strong className="font-medium text-foreground tabular-nums">{match.listings}</strong>{" "}
            {match.listings === 1 ? "anúncio" : "anúncios"} sem valor da fonte
            {match.kind === "none" ? ` · Motivo: ${fipeReasonLabel(match.reason)}` : ""}
            {tableMonth ? ` · Tabela ${formatShortMonth(tableMonth)}` : ""}
          </p>
        </div>
        <ButtonLink href={closeHref} variant="ghost" size="sm" aria-label="Fechar editor FIPE">
          <X aria-hidden="true" className="size-4" />
          Fechar
        </ButtonLink>
      </div>

      {!tableMonth ? (
        <Alert variant="warning">
          <AlertDescription>
            Nenhuma tabela FIPE importada no banco. Rode <code>npm run db:fipe-import</code> antes de corrigir.
          </AlertDescription>
        </Alert>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <SelectField
              label="Tipo na FIPE"
              value={String(selectedType ?? 1)}
              onValueChange={(value) => {
                const nextType = VEHICLE_TYPE_BY_KEY[value];
                if (!nextType) return;
                setSelectedCodes([]);
                router.replace(editorUrl(filters, { item: match.id, tipo: nextType }));
              }}
              options={([1, 2, 3] as const).map((type) => ({
                value: String(type),
                label: FIPE_VEHICLE_TYPE_LABELS[type],
              }))}
            />

            <SelectField
              label="Marca na FIPE"
              placeholder="Escolha a marca na FIPE"
              value={selectedBrand ?? ""}
              onValueChange={(brand) => {
                setSelectedCodes([]);
                router.replace(editorUrl(filters, { item: match.id, tipo: selectedType ?? 1, marca: brand }));
              }}
              options={brands.map((brand) => ({ value: brand.code, label: brand.label }))}
            />
          </div>

          {selectedBrand ? (
            <div className="grid gap-2.5">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div className="min-w-52 flex-1">
                  <Input
                    label={`Versões FIPE para ${match.modelYear} (${candidates.length})`}
                    placeholder="Filtrar versões por nome ou código…"
                    value={candidateFilter}
                    onChange={(event) => setCandidateFilter(event.target.value)}
                  />
                </div>
                <p className="text-caption text-muted tabular-nums">
                  {validSelectedCodes.length === 0
                    ? "Nenhuma selecionada"
                    : validSelectedCodes.length === 1
                      ? "1 selecionada (versão)"
                      : `${validSelectedCodes.length} selecionadas (família)`}
                </p>
              </div>

              {visibleCandidates.length === 0 ? (
                <p className="rounded-md border border-border bg-background px-3 py-4 text-center text-caption text-muted">
                  Nenhuma versão FIPE encontrada para esta marca, ano {match.modelYear} e combustível.
                </p>
              ) : (
                <div className="max-h-60 overflow-y-auto rounded-md border border-border bg-background p-1.5">
                  <ul className="grid gap-0.5">
                    {visibleCandidates.map((candidate) => {
                      const checked = selectedCodes.includes(candidate.code);
                      return (
                        <li key={candidate.code} className="rounded-sm px-1.5 hover:bg-primary-subtle/60">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={() => toggleCode(candidate.code)}
                            label={
                              <span className="flex w-full min-w-0 items-center justify-between gap-3">
                                <span className="min-w-0 flex-1 truncate">{candidate.label}</span>
                                <span className="shrink-0 font-mono text-caption text-muted">{candidate.code}</span>
                              </span>
                            }
                          />
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <p className="text-caption text-muted">
              Escolha a marca na FIPE acima para listar as versões disponíveis para o ano {match.modelYear}.
            </p>
          )}

          {activeError ? (
            <Alert variant="error">
              <AlertDescription>{activeError}</AlertDescription>
            </Alert>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
            <div className="flex flex-wrap items-center gap-2">
              <form action={saveModelsAction}>
                <input type="hidden" name="matchId" value={match.id} />
                <input type="hidden" name="mode" value="models" />
                {selectedType ? <input type="hidden" name="vehicleType" value={String(selectedType)} /> : null}
                {selectedBrand ? <input type="hidden" name="brandCode" value={selectedBrand} /> : null}
                {validSelectedCodes.map((code) => (
                  <input key={code} type="hidden" name="modelCodes" value={code} />
                ))}
                <Button
                  type="submit"
                  disabled={validSelectedCodes.length === 0 || !selectedBrand || markingNone || resetting}
                  loading={savingModels}
                  loadingLabel="Salvando…"
                >
                  Salvar correlação
                </Button>
              </form>

              <form action={markNoneAction}>
                <input type="hidden" name="matchId" value={match.id} />
                <input type="hidden" name="mode" value="none" />
                <Button
                  type="submit"
                  variant="secondary"
                  disabled={savingModels || resetting}
                  loading={markingNone}
                  loadingLabel="Salvando…"
                >
                  Marcar sem FIPE
                </Button>
              </form>
            </div>

            {match.origin === "manual" ? (
              <form action={resetAction}>
                <input type="hidden" name="matchId" value={match.id} />
                <Button
                  type="submit"
                  variant="ghost"
                  disabled={savingModels || markingNone}
                  loading={resetting}
                  loadingLabel="Revertendo…"
                >
                  <RotateCcw aria-hidden="true" className="size-3.5" />
                  Voltar para automático
                </Button>
              </form>
            ) : null}
          </div>
        </>
      )}
    </Card>
  );
}
