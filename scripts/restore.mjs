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

/** Confere, dentro do backup, as mesmas garantias que o banco impõe (FKs por dono e por lote). */
function validate({ tables }) {
  const problems = [];
  const byId = (rows) => new Map(rows.map((row) => [row.id, row]));
  const auctions = byId(tables.auctions);
  const lots = byId(tables.lots);
  const analyses = byId(tables.analyses);
  const results = byId(tables.results);

  for (const lot of tables.lots) {
    if (auctions.get(lot.auction_id)?.owner_id !== lot.owner_id)
      problems.push(`lote ${lot.id}: leilão ausente ou de outro dono`);
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

async function insertRows(client, table, rows) {
  for (const row of rows) {
    const columns = Object.keys(row);
    const placeholders = columns.map((_, index) => `$${index + 1}`).join(", ");
    await client.query(
      `insert into "${table}" (${columns.map((column) => `"${column}"`).join(", ")}) values (${placeholders})`,
      columns.map((column) => row[column]),
    );
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
      await client.query("select migration_name from _prisma_migrations where finished_at is not null order by 1")
    ).rows.map((row) => row.migration_name);
    const missing = backup.migrations.filter((name) => !applied.includes(name));
    if (missing.length > 0)
      throw new Error(`Destino sem as migrations do backup: ${missing.join(", ")}. Rode prisma migrate deploy.`);

    for (const table of TABLE_ORDER) {
      const { rows } = await client.query(`select count(*)::int as n from "${table}"`);
      if (rows[0].n > 0)
        throw new Error(`Destino não está vazio (${table} tem ${rows[0].n} linhas). Nada foi alterado.`);
    }

    await client.query("BEGIN");
    for (const table of TABLE_ORDER) await insertRows(client, table, backup.tables[table]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    await client.end();
  }
  console.log("Banco restaurado.");
}

async function restorePhotos(backupDir, images) {
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  const supabaseUrl = process.env.RESTORE_SUPABASE_URL;
  if (!secretKey || !supabaseUrl) {
    console.warn("Fotos não restauradas: defina SUPABASE_SECRET_KEY e RESTORE_SUPABASE_URL do projeto de destino.");
    return;
  }
  const supabase = createClient(supabaseUrl, secretKey, { auth: { persistSession: false } });
  let sent = 0;
  for (const image of images) {
    const file = await readFile(path.join(backupDir, "photos", image.sourcePath)).catch(() => null);
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

/** Troca o dono de todos os registros e o prefixo das fotos. Só para backups de um único dono. */
function reassignOwner(backup, newOwner) {
  if (!/^[0-9a-f-]{36}$/.test(newOwner))
    throw new Error("--owner precisa ser o UUID do usuário no projeto de destino.");
  const owners = new Set(TABLE_ORDER.flatMap((table) => backup.tables[table].map((row) => row.owner_id)));
  if (owners.size > 1)
    throw new Error("O backup tem mais de um dono; --owner só vale para backups de um único usuário.");
  const [oldOwner] = owners;
  if (!oldOwner) return;
  for (const table of TABLE_ORDER) {
    for (const row of backup.tables[table]) {
      row.owner_id = newOwner;
      if (table === "lot_images") row.storage_path = row.storage_path.replace(`${oldOwner}/`, `${newOwner}/`);
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

  const counts = Object.fromEntries(TABLE_ORDER.map((table) => [table, backup.tables[table].length]));
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
