// Backup do Leilão Tracker (SPEC §11). Uso: `npm run backup`.
//
// - Banco: exporta as tabelas do domínio para JSON, com as migrations aplicadas (versão do schema).
//   Usa DIRECT_URL (conexão de sessão). Somente leitura.
// - Fotos: se SUPABASE_SECRET_KEY estiver definida (somente na máquina de quem faz o backup, nunca na Vercel),
//   baixa os arquivos do bucket. Sem ela, o backup avisa que as fotos não foram incluídas.
//
// Saída: backups/<data>/database.json (+ photos/). A pasta backups/ não é versionada.

import { createWriteStream } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { finished } from "node:stream/promises";

import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";

nextEnv.loadEnvConfig(process.cwd(), false, { info() {}, error: console.error });

/**
 * Ordem de dependência (chaves estrangeiras). A restauração insere nesta mesma ordem, depois do catálogo: lotes podem
 * apontar para anúncios (`lots.listing_id`, etapa 3).
 */
const TABLES = [
  { name: "auctions", orderBy: "created_at, id" },
  { name: "lots", orderBy: "created_at, id" },
  { name: "analyses", orderBy: "lot_id, version" },
  { name: "results", orderBy: "lot_id, revision" },
  { name: "lot_images", orderBy: "lot_id, sort_order, created_at" },
];

/** Pós-arremate e despesas reais (D-96): por dono, apontam para lotes. Só existem a partir da migration própria. */
const POST_AUCTION_TABLES = [
  { name: "lot_post_auctions", orderBy: "created_at, id" },
  { name: "lot_expenses", orderBy: "lot_id, incurred_at, id" },
];

/**
 * Catálogo coletado (D-25): global, sem dono. Entra no backup porque arremates antigos não podem ser coletados
 * de novo quando a página sai do ar na fonte. Municípios e fontes vêm de `db:seed` e das migrations.
 */
const CATALOG_TABLES = [
  { name: "listings", orderBy: "source_id, external_id" },
  { name: "listing_observations", orderBy: "listing_id, observed_at, id" },
];

/** Monitores e alertas do usuário (etapa 2). Alertas apontam para anúncios: a restauração os insere depois do catálogo. */
const WATCH_TABLES = [
  { name: "watches", orderBy: "created_at, id" },
  { name: "alerts", orderBy: "created_at, id" },
];

/** Sugestões dispensadas (D-56): por dono, apontam para anúncios. Só existem a partir da migration própria. */
const DISMISSAL_TABLE = { name: "listing_dismissals", orderBy: "created_at, id" };

/** Preferências persistidas por dono (município base + premissas padrão). */
const PREFERENCES_TABLE = { name: "user_preferences", orderBy: "owner_id" };

/** Papéis administrativos por usuário (D-90). */
const PROFILES_TABLE = { name: "user_profiles", orderBy: "user_id" };

/**
 * Grava o JSON do backup em stream, linha a linha por tabela, evitando estourar o limite de string da V8
 * quando `listings` e `listing_observations` crescem. Mantém o formato `format: 1` compatível com `restore.mjs`.
 */
async function writeJsonBackup(filePath, backup) {
  const stream = createWriteStream(filePath, { encoding: "utf8" });
  const write = async (chunk) => {
    if (!stream.write(chunk)) {
      await new Promise((resolve, reject) => {
        stream.once("drain", resolve);
        stream.once("error", reject);
      });
    }
  };
  const writeSection = async (entries) => {
    await write("{");
    let firstTable = true;
    for (const [tableName, rows] of entries) {
      if (!firstTable) await write(",");
      firstTable = false;
      await write(`${JSON.stringify(tableName)}:[`);
      for (let i = 0; i < rows.length; i += 1) {
        if (i > 0) await write(",");
        await write(JSON.stringify(rows[i]));
      }
      await write("]");
    }
    await write("}");
  };

  await write(
    `{"format":${JSON.stringify(backup.format)},"createdAt":${JSON.stringify(backup.createdAt)},"migrations":${JSON.stringify(backup.migrations)},"tables":`,
  );
  await writeSection(Object.entries(backup.tables));
  await write(',"catalog":');
  await writeSection(Object.entries(backup.catalog));
  await write(',"watches":');
  await writeSection(Object.entries(backup.watches));
  await write("}\n");
  stream.end();
  await finished(stream);
}

async function main() {
  const databaseUrl = process.env.DIRECT_URL;
  if (!databaseUrl) throw new Error("DIRECT_URL não definida (.env.local).");

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outDir = path.join("backups", stamp);
  await mkdir(outDir, { recursive: true });

  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  const tables = {};
  const catalog = {};
  const watches = {};
  let migrations = [];
  try {
    // Leitura consistente de todas as tabelas no mesmo instante.
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    migrations = (
      await client.query(
        "select migration_name from _prisma_migrations where finished_at is not null and rolled_back_at is null order by migration_name",
      )
    ).rows.map((row) => row.migration_name);
    for (const table of TABLES) {
      tables[table.name] = (await client.query(`select * from "${table.name}" order by ${table.orderBy}`)).rows;
    }
    if (migrations.some((name) => name.endsWith("_add_finance_v3_and_post_auction"))) {
      for (const table of POST_AUCTION_TABLES) {
        tables[table.name] = (await client.query(`select * from "${table.name}" order by ${table.orderBy}`)).rows;
      }
    }
    if (migrations.some((name) => name.endsWith("_add_listings_catalog"))) {
      catalog.sources = (await client.query('select * from "sources" order by id')).rows;
      if (migrations.some((name) => name.endsWith("_fipe_catalog_and_matches"))) {
        catalog.fipe_matches = (await client.query('select * from "fipe_matches" order by vehicle_key, id')).rows;
      }
      for (const table of CATALOG_TABLES) {
        catalog[table.name] = (await client.query(`select * from "${table.name}" order by ${table.orderBy}`)).rows;
      }
    }
    if (migrations.some((name) => name.endsWith("_add_watches_alerts"))) {
      for (const table of WATCH_TABLES) {
        watches[table.name] = (await client.query(`select * from "${table.name}" order by ${table.orderBy}`)).rows;
      }
    }
    if (migrations.some((name) => name.endsWith("_listing_dismissals"))) {
      watches[DISMISSAL_TABLE.name] = (
        await client.query(`select * from "${DISMISSAL_TABLE.name}" order by ${DISMISSAL_TABLE.orderBy}`)
      ).rows;
    }
    if (migrations.some((name) => name.endsWith("_add_user_preferences"))) {
      watches[PREFERENCES_TABLE.name] = (
        await client.query(`select * from "${PREFERENCES_TABLE.name}" order by ${PREFERENCES_TABLE.orderBy}`)
      ).rows;
    }
    if (migrations.some((name) => name.endsWith("_add_user_profiles"))) {
      watches[PROFILES_TABLE.name] = (
        await client.query(`select * from "${PROFILES_TABLE.name}" order by ${PROFILES_TABLE.orderBy}`)
      ).rows;
    }
    await client.query("COMMIT");
  } finally {
    await client.end();
  }

  const backup = { format: 1, createdAt: new Date().toISOString(), migrations, tables, catalog, watches };
  await writeJsonBackup(path.join(outDir, "database.json"), backup);

  const counts = Object.fromEntries(
    Object.entries({ ...tables, ...catalog, ...watches }).map(([name, rows]) => [name, rows.length]),
  );
  console.log(`Banco: ${outDir}/database.json`, counts);

  await backupPhotos(tables.lot_images, outDir);
}

async function backupPhotos(images, outDir) {
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!secretKey) {
    console.warn(
      `Fotos NÃO incluídas (${images.length} registradas): defina SUPABASE_SECRET_KEY para baixá-las. Veja docs/OPERACAO.md.`,
    );
    return;
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, secretKey, { auth: { persistSession: false } });
  let saved = 0;
  const missing = [];
  const photosRoot = path.resolve(outDir, "photos");
  for (const image of images) {
    const target = path.resolve(photosRoot, image.storage_path);
    if (!target.startsWith(photosRoot + path.sep)) {
      console.warn("Caminho inválido de foto ignorado:", image.storage_path);
      continue;
    }
    const { data, error } = await supabase.storage.from("lot-images").download(image.storage_path);
    if (error || !data) {
      missing.push(image.storage_path);
      continue;
    }
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, Buffer.from(await data.arrayBuffer()));
    saved += 1;
  }
  console.log(`Fotos: ${saved} de ${images.length} salvas em ${outDir}/photos`);
  if (missing.length > 0) console.warn("Fotos registradas sem arquivo no Storage:", missing);
}

main().catch((error) => {
  console.error("Backup falhou:", error.message);
  process.exit(1);
});
