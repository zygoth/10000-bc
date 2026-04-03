import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('.');
const GROUND_FUNGI_DIR = path.join(ROOT, 'data', 'ground_fungi');
const OUTPUT_FILE = path.join(ROOT, 'src', 'game', 'groundFungusCatalog.source.mjs');

function toCatalogShape(fungus) {
  return {
    id: fungus.id,
    type: fungus.type,
    common_name: fungus.common_name,
    latin_name: fungus.latin_name,
    zone_count_range: fungus.zone_count_range,
    zone_radius_range: fungus.zone_radius_range,
    annual_fruit_chance: fungus.annual_fruit_chance,
    soil_requirements: fungus.soil_requirements,
    fruiting_windows: fungus.fruiting_windows,
    per_tile_yield_range: fungus.per_tile_yield_range,
    ...(Array.isArray(fungus.game_tags) && fungus.game_tags.length > 0
      ? { game_tags: fungus.game_tags }
      : {}),
    ...(fungus.ingestion && typeof fungus.ingestion === 'object'
      ? { ingestion: fungus.ingestion }
      : {}),
  };
}

function listGroundFungusJsonFiles() {
  if (!fs.existsSync(GROUND_FUNGI_DIR)) {
    return [];
  }

  return fs
    .readdirSync(GROUND_FUNGI_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(GROUND_FUNGI_DIR, entry.name, 'fungus.json'))
    .filter((filePath) => fs.existsSync(filePath));
}

function main() {
  const fungusJsonFiles = listGroundFungusJsonFiles();
  const catalog = fungusJsonFiles
    .map((filePath) => JSON.parse(fs.readFileSync(filePath, 'utf-8')))
    .map(toCatalogShape)
    .sort((a, b) => a.id.localeCompare(b.id));

  const fileContents = `const GROUND_FUNGUS_CATALOG_SOURCE = ${JSON.stringify(catalog, null, 2)};\n\nexport default GROUND_FUNGUS_CATALOG_SOURCE;\n`;
  fs.writeFileSync(OUTPUT_FILE, fileContents, 'utf-8');
  console.log(`Wrote ${catalog.length} ground fungi to ${OUTPUT_FILE}`);
}

main();
