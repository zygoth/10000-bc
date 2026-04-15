/**
 * Writes gzipped JSON snapshots used by tests/sim/run-sim-tests.mjs getStabilizedState().
 * Run after catalog build when snapshot schema or sim logic changes:
 *   npm run catalog:build && node ./scripts/generate-stabilized-sim-fixtures.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

import { advanceDay, createInitialGameState, serializeGameState } from '../src/game/simCore.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '../tests/sim/fixtures');

/** Stabilized worlds (400 simulated days) for sim tests; keep maps small where tests allow. */
const FIXTURES = [
  { seed: 28711, width: 50, height: 50, days: 400 },
  { seed: 28711, width: 28, height: 28, days: 400 },
];

function compactSnapshotJson(state) {
  const raw = serializeGameState(state);
  const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
  return JSON.stringify(parsed);
}

function main() {
  fs.mkdirSync(outDir, { recursive: true });
  for (const { seed, width, height, days } of FIXTURES) {
    const label = `${seed}-${width}x${height}-${days}`;
    process.stdout.write(`Simulating ${label}...\n`);
    const state = advanceDay(createInitialGameState(seed, { width, height }), days);
    const json = compactSnapshotJson(state);
    const gzPath = path.join(outDir, `stabilized-${label}.json.gz`);
    fs.writeFileSync(gzPath, zlib.gzipSync(Buffer.from(json, 'utf8')));
    process.stdout.write(`Wrote ${gzPath} (${fs.statSync(gzPath).size} bytes)\n`);
  }
}

main();
