// Backup do Leilão Tracker (SPEC §11). Uso: `npm run backup`.
//
// - Banco: exporta as tabelas do domínio para JSON, com as migrations aplicadas (versão do schema).
//   Usa DIRECT_URL (conexão de sessão). Somente leitura.
// - Fotos: se SUPABASE_SECRET_KEY estiver definida (somente na máquina de quem faz o backup, nunca na Vercel),
//   baixa os arquivos do bucket. Sem ela, o backup avisa que as fotos não foram incluídas.
//
// Saída: backups/<data>/database.json (+ photos/). A pasta backups/ não é versionada.

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";

nextEnv.loadEnvConfig(process.cwd(), false, { info() {}, error: console.error });

/** Ordem de dependência (chaves estrangeiras). A restauração insere nesta mesma ordem. */
const TABLES = [
  { name: "auctions", orderBy: "created_at, id" },
  { name: "lots", orderBy: "created_at, id" },
  { name: "analyses", orderBy: "lot_id, version" },
  { name: "results", orderBy: "lot_id, revision" },
  { name: "lot_images", orderBy: "lot_id, sort_order, created_at" },
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
    if (migrations.some((name) => name.endsWith("_add_listings_catalog"))) {
      for (const table of CATALOG_TABLES) {
        catalog[table.name] = (await client.query(`select * from "${table.name}" order by ${table.orderBy}`)).rows;
      }
    }
    if (migrations.some((name) => name.endsWith("_add_watches_alerts"))) {
      for (const table of WATCH_TABLES) {
        watches[table.name] = (await client.query(`select * from "${table.name}" order by ${table.orderBy}`)).rows;
      }
    }
    await client.query("COMMIT");
  } finally {
    await client.end();
  }

  const backup = { format: 1, createdAt: new Date().toISOString(), migrations, tables, catalog, watches };
  await writeFile(path.join(outDir, "database.json"), JSON.stringify(backup, null, 2));

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
  for (const image of images) {
    const { data, error } = await supabase.storage.from("lot-images").download(image.storage_path);
    if (error || !data) {
      missing.push(image.storage_path);
      continue;
    }
    const target = path.join(outDir, "photos", image.storage_path);
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
