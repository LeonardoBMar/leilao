// Confere e corrige as correlações anúncio → FIPE (D-49, docs/PLANO-FIPE-TABELAS.md §4). A correção vale para todos
// os anúncios com o mesmo veículo e nunca é desfeita pela regra; os anúncios afetados voltam à fila e recebem o valor
// novo na próxima coleta (ou no `npm run db:market-values`).
//
//   npm run db:fipe-match -- list [--kind version|family|none] [--origin auto|manual] [--search GOL] [--limit 30]
//   npm run db:fipe-match -- show <id>                     correlação e as versões da FIPE para escolher
//   npm run db:fipe-match -- set <id> --models 005205-1,005206-0   versão (um código FIPE) ou família (vários)
//                                                          [--type 1 --brand "VW - VolksWagen"]
//   npm run db:fipe-match -- set <id> --none               sem valor para esse veículo
//   npm run db:fipe-match -- auto <id>                     desfaz a correção: a regra escolhe de novo
//
// `set` e `auto` só mostram o efeito; acrescente --apply para gravar.

import { loadEnvConfig } from "@next/env";

import type { FipeVehicleType } from "@/domain/listings/fipe-match";

async function main() {
  // As variáveis precisam existir antes de importar o banco (src/server/env.ts valida ao carregar).
  loadEnvConfig(process.cwd(), false, { info: () => undefined, error: console.error });
  const matches = await import("@/server/fipe/matches");
  const { createFipeCatalog } = await import("@/server/fipe/catalog");
  const { fipeFuelCodes, pickFipeTable } = await import("@/domain/listings/fipe-match");

  const [command, id] = process.argv.slice(2);
  const apply = process.argv.includes("--apply");
  const describe = (match: Awaited<ReturnType<typeof matches.getFipeMatch>> & {}) => {
    const chosen =
      match.kind === "none" ? `nenhuma (${match.reason ?? "—"})` : match.models.map((m) => m.label).join(" | ");
    return `${match.id}  ${match.vehicleKey}  [${match.origin}] ${match.kind}: ${chosen} · ${match.listings} anúncios`;
  };

  if (command === "list") {
    const kind = readFlag("--kind");
    const origin = readFlag("--origin");
    const items = await matches.listFipeMatches({
      ...(kind === "version" || kind === "family" || kind === "none" ? { kind } : {}),
      ...(origin === "auto" || origin === "manual" ? { origin } : {}),
      ...(readFlag("--search") ? { search: readFlag("--search") } : {}),
      limit: Number(readFlag("--limit") ?? 30) || 30,
    });
    for (const item of items) process.stdout.write(`${describe(item)}\n`);
    return;
  }

  if (!id) throw new Error("Informe o id da correlação (veja `list`).");
  const match = await matches.getFipeMatch(id);
  if (!match) throw new Error(`Correlação ${id} não encontrada.`);

  // Versões da FIPE para o veículo, na tabela mais recente do catálogo.
  const candidates = async (): Promise<{
    type: FipeVehicleType;
    brandCode: string;
    found: { code: string; fuel: number; label: string }[];
  }> => {
    const typeNumber = Number(readFlag("--type") ?? match.vehicleType);
    const type = typeNumber === 1 || typeNumber === 2 || typeNumber === 3 ? typeNumber : null;
    const brandCode = readFlag("--brand") ?? match.brandCode;
    if (type === null || !brandCode) {
      throw new Error("Correlação sem marca da FIPE: informe --type (1 carros, 2 motos, 3 caminhões) e --brand.");
    }
    const catalog = createFipeCatalog();
    const table = pickFipeTable(new Date(), await catalog.tables());
    if (!table) throw new Error("Catálogo da FIPE vazio: rode `npm run db:fipe-import`.");
    const found: { code: string; fuel: number; label: string }[] = [];
    for (const fuel of fipeFuelCodes(type, match.fuel)) {
      for (const model of await catalog.modelsByYear(table, type, brandCode, match.modelYear, fuel)) {
        if (!found.some((item) => item.code === model.code)) found.push({ code: model.code, fuel, label: model.label });
      }
    }
    return { type, brandCode, found };
  };

  if (command === "show") {
    process.stdout.write(`${describe(match)}\n`);
    if (match.vehicleType === null) {
      process.stdout.write("Sem marca da FIPE casada; para escolher, use `set` com --type e --brand.\n");
      return;
    }
    const { found } = await candidates();
    for (const item of found) process.stdout.write(`  ${item.code}  ${item.label}\n`);
    return;
  }

  if (command === "set") {
    let choice: Parameters<typeof matches.setManualMatch>[1];
    if (process.argv.includes("--none")) {
      choice = { kind: "none", reason: "manual", vehicleType: match.vehicleType, brandCode: match.brandCode };
    } else {
      const codes = (readFlag("--models") ?? "").split(",").filter(Boolean);
      if (codes.length === 0) throw new Error("Informe --models com os códigos (veja `show`) ou --none.");
      const { type, brandCode, found } = await candidates();
      const models = codes.map((code) => {
        const model = found.find((item) => item.code === code);
        if (!model) throw new Error(`Código ${code} não está nas versões da FIPE desse veículo (veja \`show\`).`);
        return model;
      });
      choice = { kind: models.length === 1 ? "version" : "family", vehicleType: type, brandCode, models };
    }
    const chosen = choice.kind === "none" ? "nenhuma" : choice.models.map((m) => m.label).join(" | ");
    process.stdout.write(`${describe(match)}\n→ manual ${choice.kind}: ${chosen}\n`);
    if (!apply) {
      process.stdout.write(`Afetaria ${match.listings} anúncios. Nada gravado; repita com --apply.\n`);
      return;
    }
    const requeued = await matches.setManualMatch(match.id, choice);
    process.stdout.write(`Gravado. ${requeued} anúncios voltaram à fila para receber o valor novo.\n`);
    return;
  }

  if (command === "auto") {
    process.stdout.write(`${describe(match)}\n→ automática (a regra escolhe de novo)\n`);
    if (!apply) {
      process.stdout.write(`Afetaria ${match.listings} anúncios. Nada gravado; repita com --apply.\n`);
      return;
    }
    const requeued = await matches.resetMatchToAuto(match.id);
    process.stdout.write(`Gravado. ${requeued} anúncios voltaram à fila.\n`);
    return;
  }

  throw new Error("Comando desconhecido: use list, show, set ou auto.");
}

function readFlag(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => setTimeout(() => process.exit(), 100).unref());
