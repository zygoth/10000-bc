import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('.');
const PLANTS_DIR = path.join(ROOT, 'data', 'plants');
const OUTPUT_FILE = path.join(ROOT, 'src', 'game', 'plantCatalog.source.mjs');

function toCatalogShape(plant) {
  const entry = {
    id: plant.id,
    name: plant.name,
    longevity: plant.longevity,
    age_of_maturity: plant.age_of_maturity,
    habitat: plant.habitat,
    soil: plant.soil,
    seeding_window: plant.seeding_window,
    dispersal: plant.dispersal,
    life_stages: plant.life_stages,
    parts: plant.parts,
  };
  if (typeof plant.physical_description === 'string' && plant.physical_description) {
    entry.physical_description = plant.physical_description;
  }
  if (typeof plant.game_description === 'string' && plant.game_description) {
    entry.game_description = plant.game_description;
  }
  if (plant.scent && typeof plant.scent === 'object') {
    entry.scent = plant.scent;
  }
  return entry;
}

function listPlantJsonFiles() {
  return fs
    .readdirSync(PLANTS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(PLANTS_DIR, entry.name, 'plant.json'))
    .filter((filePath) => fs.existsSync(filePath));
}

function main() {
  const plantJsonFiles = listPlantJsonFiles();
  const catalog = plantJsonFiles
    .map((filePath) => JSON.parse(fs.readFileSync(filePath, 'utf-8')))
    .map(toCatalogShape)
    .sort((a, b) => a.id.localeCompare(b.id));

  const fileContents = `const PLANT_CATALOG_SOURCE = ${JSON.stringify(catalog, null, 2)};\n\nexport default PLANT_CATALOG_SOURCE;\n`;
  fs.writeFileSync(OUTPUT_FILE, fileContents, 'utf-8');
  console.log(`Wrote ${catalog.length} plants to ${OUTPUT_FILE}`);
}

main();
