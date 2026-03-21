import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('.');
const ANIMALS_DIR = path.join(ROOT, 'data', 'animals');
const OUTPUT_FILE = path.join(ROOT, 'src', 'game', 'animalCatalog.source.mjs');

function toCatalogShape(animal) {
  return {
    id: animal.id,
    name: animal.name,
    animal_class: animal.animal_class,
    physical_description: animal.physical_description,
    habitat: animal.habitat,
    water_required: animal.water_required,
    weight_range_g: animal.weight_range_g,
    behaviors: animal.behaviors,
    diet: animal.diet,
    population: animal.population,
    base_catch_rate: animal.base_catch_rate,
    rod_compatible: animal.rod_compatible,
    current_sensitivity: animal.current_sensitivity,
    parts: animal.parts,
  };
}

function listAnimalJsonFiles() {
  if (!fs.existsSync(ANIMALS_DIR)) {
    return [];
  }

  return fs
    .readdirSync(ANIMALS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(ANIMALS_DIR, entry.name, 'animal.json'))
    .filter((filePath) => fs.existsSync(filePath));
}

function main() {
  const animalJsonFiles = listAnimalJsonFiles();
  const catalog = animalJsonFiles
    .map((filePath) => JSON.parse(fs.readFileSync(filePath, 'utf-8')))
    .map(toCatalogShape)
    .sort((a, b) => a.id.localeCompare(b.id));

  const fileContents = `const ANIMAL_CATALOG_SOURCE = ${JSON.stringify(catalog, null, 2)};\n\nexport default ANIMAL_CATALOG_SOURCE;\n`;
  fs.writeFileSync(OUTPUT_FILE, fileContents, 'utf-8');
  console.log(`Wrote ${catalog.length} animals to ${OUTPUT_FILE}`);
}

main();
