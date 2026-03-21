import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('.');
const LOG_FUNGI_DIR = path.join(ROOT, 'data', 'log_fungi');
const OUTPUT_FILE = path.join(ROOT, 'src', 'game', 'logFungusCatalog.source.mjs');

function toCatalogShape(fungus) {
  return {
    id: fungus.id,
    type: fungus.type,
    common_name: fungus.common_name,
    latin_name: fungus.latin_name,
    host_trees: fungus.host_trees,
    preferred_decay_stages: fungus.preferred_decay_stages,
    base_spawn_chance: fungus.base_spawn_chance,
    fruiting_windows: fungus.fruiting_windows,
    per_log_yield_range: fungus.per_log_yield_range,
  };
}

function listLogFungusJsonFiles() {
  if (!fs.existsSync(LOG_FUNGI_DIR)) {
    return [];
  }

  return fs
    .readdirSync(LOG_FUNGI_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(LOG_FUNGI_DIR, entry.name, 'fungus.json'))
    .filter((filePath) => fs.existsSync(filePath));
}

function main() {
  const fungusJsonFiles = listLogFungusJsonFiles();
  const catalog = fungusJsonFiles
    .map((filePath) => JSON.parse(fs.readFileSync(filePath, 'utf-8')))
    .map(toCatalogShape)
    .sort((a, b) => a.id.localeCompare(b.id));

  const fileContents = `const LOG_FUNGUS_CATALOG_SOURCE = ${JSON.stringify(catalog, null, 2)};\n\nexport default LOG_FUNGUS_CATALOG_SOURCE;\n`;
  fs.writeFileSync(OUTPUT_FILE, fileContents, 'utf-8');
  console.log(`Wrote ${catalog.length} log fungi to ${OUTPUT_FILE}`);
}

main();
