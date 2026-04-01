import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_ROOT = path.resolve(__dirname, '../../fixtures/worlds');

export function resolveFixturePath(fixtureFileName) {
  if (typeof fixtureFileName !== 'string' || !fixtureFileName) {
    throw new Error('fixture filename is required');
  }
  return path.resolve(FIXTURE_ROOT, fixtureFileName);
}

export function loadFixtureDocument(fixtureFileName) {
  const fixturePath = resolveFixturePath(fixtureFileName);
  const raw = fs.readFileSync(fixturePath, 'utf8');
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object') {
    throw new Error(`invalid fixture document at ${fixturePath}`);
  }
  return parsed;
}

