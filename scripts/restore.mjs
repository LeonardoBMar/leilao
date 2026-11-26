// Restauração do Leilão Tracker (SPEC §11).
//
//   npm run restore -- backups/<data>                 → simulação: valida a integridade do backup (padrão)
//   npm run restore -- backups/<data> --apply         → restaura em RESTORE_DATABASE_URL
//   ... --apply --owner <id-do-usuário-no-destino>    → projeto Supabase NOVO: reatribui o dono (ver abaixo)
//
// Regras de segurança:
// - O destino é SEMPRE RESTORE_DATABASE_URL, nunca DATABASE_URL/DIRECT_URL, para não sobrescrever produção.
// - O destino precisa ter o schema aplicado (`prisma migrate deploy`) com as mesmas migrations do backup
//   e estar vazio. Caso contrário, nada é feito.
// - Tudo em uma transação: ou restaura inteiro, ou nada.
// - Fotos: com SUPABASE_SECRET_KEY e RESTORE_SUPABASE_URL, envia backups/<data>/photos de volta ao bucket.
// - Catálogo coletado (anúncios e observações, D-25): restaurado junto, se o backup tiver. O destino precisa
//   dos municípios (`npm run db:seed` com DIRECT_URL do destino) e das fontes (vêm das migrations).
// - owner_id é o id do usuário no Supabase Auth, que não faz parte do backup. Num projeto novo o usuário terá
//   outro id: --owner reescreve owner_id e o prefixo das fotos (<owner_id>/…) durante a inserção. Depois não
//   dá para corrigir, porque análises fixadas e resultados não aceitam UPDATE.

import { readFile } from "node:fs/promises";
import path from "node:path";

import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";

nextEnv.loadEnvConfig(process.cwd(), false, { info() {}, error: console.error });

const TABLE_ORDER = ["auctions", "lots", "analyses", "results", "lot_images"];
/** Backups antigos não têm `catalog` nem `sources`: vira vazio. `sources` e `fipe_matches` entram antes de `listings`. */
const CATALOG_ORDER = ["sources", "fipe_matches", "listings", "listing_observations"];
/**
 * Backups antigos não têm `watches` (nem `listing_dismissals`, `user_preferences`, `user_profiles`): vira vazio.
 * Alertas e dispensas dependem de anúncios (e alertas, de monitores): entram por último.
 */
const WATCH_ORDER = ["watches", "alerts", "listing_dismissals", "user_preferences", "user_profiles"];
/** Tabelas pré-populadas por migrations (ex.: fonte `leilo`, perfis iniciais): restauradas com ON CONFLICT DO NOTHING. */
const MERGE_ON_RESTORE = new Set(["sources", "user_profiles"]);
const MAX_INSERT_BATCH = 250;
const MAX_QUERY_PARAMS = 60_000;

/** Confere, dentro do backup, as mesmas garantias que o banco impõe (FKs por dono e por lote). */
function validate({ tables, catalog, watches }) {
  const problems = [];
  const listingIds = new Set(catalog.listings.map((listing) => listing.id));
  const fipeMatchIds = new Set(catalog.fipe_matches.map((match) => match.id));
  for (const listing of catalog.listings) {
    if (listing.fipe_match_id && !fipeMatchIds.has(listing.fipe_match_id)) {
      problems.push(`anúncio ${listing.id}: correlação FIPE ausente`);
    }
  }
  const watchOwners = new Map(watches.watches.map((watch) => [watch.id, watch.owner_id]));
  for (const alert of watches.alerts) {
    if (watchOwners.get(alert.watch_id) !== alert.owner_id) problems.push(`alerta ${alert.id}: monitor ausente`);
    if (!listingIds.has(alert.listing_id)) problems.push(`alerta ${alert.id}: anúncio ausente`);
  }
  for (const dismissal of watches.listing_dismissals) {
    if (!listingIds.has(dismissal.listing_id)) problems.push(`dispensa ${dismissal.id}: anúncio ausente`);
  }
  for (const observation of catalog.listing_observations) {
    if (!listingIds.has(observation.listing_id)) problems.push(`observação ${observation.id}: anúncio ausente`);
  }
  const byId = (rows) => new Map(rows.map((row) => [row.id, row]));
  const auctions = byId(tables.auctions);
  const lots = byId(tables.lots);
  const analyses = byId(tables.analyses);
  const results = byId(tables.results);

  for (const lot of tables.lots) {
    if (auctions.get(lot.auction_id)?.owner_id !== lot.owner_id)
      problems.push(`lote ${lot.id}: leilão ausente ou de outro dono`);
    if (lot.listing_id && !listingIds.has(lot.listing_id)) problems.push(`lote ${lot.id}: anúncio ligado ausente`);
  }
  for (const analysis of tables.analyses) {
    if (lots.get(analysis.lot_id)?.owner_id !== analysis.owner_id)
      problems.push(`análise ${analysis.id}: lote ausente`);
  }
  for (const result of tables.results) {
    if (lots.get(result.lot_id)?.owner_id !== result.owner_id) problems.push(`resultado ${result.id}: lote ausente`);
    if (result.analysis_id && analyses.get(result.analysis_id)?.lot_id !== result.lot_id) {
      problems.push(`resultado ${result.id}: análise de outro lote`);
    }
    if (result.supersedes_result_id && results.get(result.supersedes_result_id)?.lot_id !== result.lot_id) {
      problems.push(`resultado ${result.id}: revisão anterior ausente`);
    }
  }
  for (const image of tables.lot_images) {
    if (lots.get(image.lot_id)?.owner_id !== image.owner_id) problems.push(`foto ${image.id}: lote ausente`);
  }
  return problems;
}

/** Colunas reais não geradas da tabela no destino e seus tipos: impede injeção, ignora removidas e serializa json/jsonb. */
async function insertableColumns(client, table) {
  const { rows } = await client.query(
    "select column_name, data_type from information_schema.columns where table_schema = 'public' and table_name = $1 and is_generated = 'NEVER'",
    [table],
  );
  return new Map(rows.map((row) => [row.column_name, row.data_type]));
}

function serializeRestoreValue(value, dataType) {
  if (value === null || value === undefined) return value;
  if (dataType === "json" || dataType === "jsonb") return JSON.stringify(value);
  return value;
}

async function insertRows(client, table, rows) {
  if (rows.length === 0) return;
  const allowed = await insertableColumns(client, table);
  const columns = Object.keys(rows[0]).filter((column) => allowed.has(column));
  if (columns.length === 0) return;

  const columnList = columns.map((column) => `"${column}"`).join(", ");
  const conflictClause = MERGE_ON_RESTORE.has(table) ? " on conflict do nothing" : "";
  const batchSize = Math.max(1, Math.min(MAX_INSERT_BATCH, Math.floor(MAX_QUERY_PARAMS / columns.length)));

  for (let start = 0; start < rows.length; start += batchSize) {
    const chunk = rows.slice(start, start + batchSize);
    const values = [];
    const tuples = [];
    let paramIndex = 1;
    for (const row of chunk) {
      const placeholders = [];
      for (const column of columns) {
        placeholders.push(`$${paramIndex}`);
        values.push(serializeRestoreValue(row[column], allowed.get(column)));
        paramIndex += 1;
      }
      tuples.push(`(${placeholders.join(", ")})`);
    }
    await client.query(`insert into "${table}" (${columnList}) values ${tuples.join(", ")}${conflictClause}`, values);
  }
}

async function apply(backup) {
  const targetUrl = process.env.RESTORE_DATABASE_URL;
  if (!targetUrl) throw new Error("Defina RESTORE_DATABASE_URL com o banco de DESTINO (vazio, com o schema aplicado).");
  if ([process.env.DATABASE_URL, process.env.DIRECT_URL].includes(targetUrl)) {
    throw new Error(
      "RESTORE_DATABASE_URL não pode ser o banco configurado no app. Restaure num banco novo e troque depois.",
    );
  }

  const client = new pg.Client({ connectionString: targetUrl });
  await client.connect();
  try {
    const applied = (
      await client.query(
        "select migration_name from _prisma_migrations where finished_at is not null and rolled_back_at is null order by 1",
      )
    ).rows.map((row) => row.migration_name);
    const missing = backup.migrations.filter((name) => !applied.includes(name));
    if (missing.length > 0)
      throw new Error(`Destino sem as migrations do backup: ${missing.join(", ")}. Rode prisma migrate deploy.`);

    for (const table of [...TABLE_ORDER, ...CATALOG_ORDER, ...WATCH_ORDER]) {
      if (MERGE_ON_RESTORE.has(table)) continue;
      // Tabela de migration posterior ao backup (ex.: listing_dismissals) pode não existir num destino mais antigo.
      const { rows: found } = await client.query("select to_regclass($1) is not null as ok", [`public.${table}`]);
      if (!found[0].ok) continue;
      const { rows } = await client.query(`select count(*)::int as n from "${table}"`);
      if (rows[0].n > 0)
        throw new Error(`Destino não está vazio (${table} tem ${rows[0].n} linhas). Nada foi alterado.`);
    }

    await checkCatalogReferences(
      client,
      backup.catalog.sources,
      backup.catalog.listings,
      backup.tables.auctions,
      backup.watches.user_preferences,
    );

    await client.query("BEGIN");
    // Catálogo primeiro: lotes podem apontar para anúncios (lots.listing_id).
    for (const table of CATALOG_ORDER) await insertRows(client, table, backup.catalog[table]);
    for (const table of TABLE_ORDER) await insertRows(client, table, backup.tables[table]);
    for (const table of WATCH_ORDER) await insertRows(client, table, backup.watches[table]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    await client.end();
  }
  console.log("Banco restaurado.");
}

/** Fontes (do destino ou do backup) e municípios precisam existir antes de inserir anúncios, leilões e preferências. */
async function checkCatalogReferences(client, backupSources, listings, auctions, userPreferences = []) {
  const used = [...listings, ...auctions].map((row) => row.source_id).filter(Boolean);
  if (used.length > 0) {
    const sources = new Set([
      ...(await client.query("select id from sources")).rows.map((row) => row.id),
      ...backupSources.map((row) => row.id),
    ]);
    const missingSources = [...new Set(used)].filter((id) => !sources.has(id));
    if (missingSources.length > 0)
      throw new Error(`Destino sem as fontes: ${missingSources.join(", ")}. Nada foi alterado.`);
  }
  const needsMunicipalities =
    listings.some((listing) => listing.municipality_id !== null) ||
    userPreferences.some((pref) => pref.municipality_ibge_code !== null);
  if (needsMunicipalities) {
    const { rows } = await client.query("select count(*)::int as n from municipalities");
    if (rows[0].n === 0) {
      throw new Error("Destino sem municípios. Rode npm run db:seed apontando para o destino. Nada foi alterado.");
    }
  }
}

async function restorePhotos(backupDir, images) {
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  const supabaseUrl = process.env.RESTORE_SUPABASE_URL;
  if (!secretKey || !supabaseUrl) {
    console.warn("Fotos não restauradas: defina SUPABASE_SECRET_KEY e RESTORE_SUPABASE_URL do projeto de destino.");
    return;
  }
  const supabase = createClient(supabaseUrl, secretKey, { auth: { persistSession: false } });
  const photosRoot = path.resolve(backupDir, "photos");
  let sent = 0;
  for (const image of images) {
    const sourceFile = path.resolve(photosRoot, image.sourcePath);
    if (!sourceFile.startsWith(photosRoot + path.sep)) {
      console.warn("Caminho inválido de foto ignorado:", image.sourcePath);
      continue;
    }
    const file = await readFile(sourceFile).catch(() => null);
    if (!file) {
      console.warn("Arquivo ausente no backup:", image.sourcePath);
      continue;
    }
    const { error } = await supabase.storage
      .from("lot-images")
      .upload(image.targetPath, file, { contentType: image.mimeType, upsert: false });
    if (error) console.warn("Falha ao enviar", image.targetPath, error.message);
    else sent += 1;
  }
  console.log(`Fotos: ${sent} de ${images.length} enviadas.`);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Troca o dono de todos os registros e o prefixo das fotos. Só para backups de um único dono. */
function reassignOwner(backup, newOwner) {
  if (!UUID_RE.test(newOwner)) throw new Error("--owner precisa ser o UUID do usuário no projeto de destino.");
  const owners = new Set([
    ...TABLE_ORDER.flatMap((table) => backup.tables[table].map((row) => row.owner_id)),
    ...WATCH_ORDER.flatMap((table) =>
      backup.watches[table].map((row) => (table === "user_profiles" ? row.user_id : row.owner_id)),
    ),
  ]);
  if (owners.size > 1)
    throw new Error("O backup tem mais de um dono; --owner só vale para backups de um único usuário.");
  const [oldOwner] = owners;
  if (!oldOwner) return;
  for (const table of TABLE_ORDER) {
    for (const row of backup.tables[table]) {
      row.owner_id = newOwner;
      if (table === "lot_images") {
        if (!row.storage_path.startsWith(`${oldOwner}/`)) {
          throw new Error(`Foto ${row.id} fora da pasta do dono original: ${row.storage_path}`);
        }
        row.storage_path = `${newOwner}/${row.storage_path.slice(oldOwner.length + 1)}`;
      }
    }
  }
  for (const table of WATCH_ORDER) {
    for (const row of backup.watches[table]) {
      if (table === "user_profiles") row.user_id = newOwner;
      else row.owner_id = newOwner;
    }
  }
  console.log(`Dono reatribuído: ${oldOwner} → ${newOwner}`);
}

async function main() {
  const args = process.argv.slice(2);
  const backupDir = args[0];
  const isApply = args.includes("--apply");
  const ownerIndex = args.indexOf("--owner");
  const newOwner = ownerIndex >= 0 ? args[ownerIndex + 1] : undefined;
  if (!backupDir)
    throw new Error("Informe a pasta do backup: npm run restore -- backups/<data> [--apply] [--owner <id>]");
  const backup = JSON.parse(await readFile(path.join(backupDir, "database.json"), "utf8"));
  if (backup.format !== 1) throw new Error(`Formato de backup desconhecido: ${backup.format}`);
  const hasFipeMatches = backup.catalog?.fipe_matches !== undefined;
  backup.catalog = Object.fromEntries(CATALOG_ORDER.map((table) => [table, backup.catalog?.[table] ?? []]));
  backup.watches = Object.fromEntries(WATCH_ORDER.map((table) => [table, backup.watches?.[table] ?? []]));

  if (!hasFipeMatches) {
    let cleared = 0;
    for (const listing of backup.catalog.listings) {
      if (listing.fipe_match_id != null) {
        listing.fipe_match_id = null;
        cleared += 1;
      }
    }
    if (cleared > 0) {
      console.warn(
        `Aviso: backup legado sem fipe_matches; fipe_match_id limpo em ${cleared} anúncios (rode db:fipe-match após restaurar).`,
      );
    }
  }

  const counts = Object.fromEntries([
    ...TABLE_ORDER.map((table) => [table, backup.tables[table].length]),
    ...CATALOG_ORDER.map((table) => [table, backup.catalog[table].length]),
    ...WATCH_ORDER.map((table) => [table, backup.watches[table].length]),
  ]);
  console.log(`Backup de ${backup.createdAt}`, counts, `${backup.migrations.length} migrations`);

  const problems = validate(backup);
  if (problems.length > 0) {
    console.error("Backup inconsistente:", problems);
    process.exit(1);
  }
  console.log("Integridade do backup: ok.");

  // Caminhos de origem (arquivos no backup) antes de eventual troca de dono.
  const photos = backup.tables.lot_images.map((image) => ({
    sourcePath: image.storage_path,
    mimeType: image.mime_type,
  }));
  if (newOwner !== undefined) reassignOwner(backup, newOwner);
  photos.forEach((photo, index) => (photo.targetPath = backup.tables.lot_images[index].storage_path));

  if (!isApply) {
    console.log("Simulação concluída. Para restaurar de fato, rode com --apply e RESTORE_DATABASE_URL.");
    return;
  }
  await apply(backup);
  await restorePhotos(backupDir, photos);
}

main().catch((error) => {
  console.error("Restauração falhou:", error.message);
  process.exit(1);
});
