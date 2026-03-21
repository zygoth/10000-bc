import fs from 'node:fs';
import path from 'node:path';
import { createInitialGameState, advanceDay, getMetrics } from '../src/game/simCore.mjs';

const DEFAULT_SEEDS = [10000, 10001, 10037];
const DAYS_PER_YEAR = 40;
const DEFAULT_YEARS = 25;
const DEFAULT_WIDTH = 80;
const DEFAULT_HEIGHT = 80;
const DEFAULT_CHECKPOINTS = true;

const REPORT_PATH = path.resolve('build', 'phase1_harness_report.json');
const CHECKPOINT_DIR = path.resolve('build', 'sim_checkpoints');

function parseFlagInt(name, fallback) {
  const prefix = `${name}=`;
  const raw = process.argv.find((value) => value.startsWith(prefix));
  if (!raw) {
    return fallback;
  }

  const parsed = Number.parseInt(raw.slice(prefix.length), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseFlagBool(name, fallback) {
  const prefix = `${name}=`;
  const raw = process.argv.find((value) => value.startsWith(prefix));
  if (!raw) {
    return fallback;
  }

  const value = raw.slice(prefix.length).toLowerCase();
  if (value === 'true' || value === '1' || value === 'yes') {
    return true;
  }
  if (value === 'false' || value === '0' || value === 'no') {
    return false;
  }
  return fallback;
}

function cleanOldOutputs() {
  if (fs.existsSync(REPORT_PATH)) {
    fs.unlinkSync(REPORT_PATH);
  }

  if (fs.existsSync(CHECKPOINT_DIR)) {
    fs.rmSync(CHECKPOINT_DIR, { recursive: true, force: true });
  }
}

function writeCheckpoint(seed, year, state, metrics) {
  fs.mkdirSync(CHECKPOINT_DIR, { recursive: true });
  const filePath = path.join(CHECKPOINT_DIR, `seed_${seed}_year_${String(year).padStart(2, '0')}.json`);
  fs.writeFileSync(
    filePath,
    JSON.stringify(
      {
        savedAt: new Date().toISOString(),
        seed,
        checkpointYear: year,
        metrics,
        state,
      },
      null,
      2,
    ),
    'utf-8',
  );
}

function runSimulation(seed, years, width, height, writeCheckpoints) {
  let state = createInitialGameState(seed, { width, height });
  const yearlySnapshots = [];

  for (let year = 1; year <= years; year += 1) {
    state = advanceDay(state, DAYS_PER_YEAR);
    const metrics = getMetrics(state);
    yearlySnapshots.push({
      year,
      dayOfYear: metrics.dayOfYear,
      totalPlants: metrics.totalPlants,
      totalDormantSeeds: metrics.totalDormantSeeds,
      speciesCounts: metrics.speciesCounts,
    });

    if (writeCheckpoints) {
      writeCheckpoint(seed, year, state, metrics);
    }
  }

  return {
    seed,
    finalMetrics: getMetrics(state),
    yearlySnapshots,
  };
}

function main() {
  const args = process.argv
    .slice(2)
    .filter((value) => !value.includes('='))
    .map((value) => Number.parseInt(value, 10))
    .filter(Number.isFinite);

  const seeds = args.length > 0 ? args : DEFAULT_SEEDS;
  const years = parseFlagInt('--years', DEFAULT_YEARS);
  const width = parseFlagInt('--width', DEFAULT_WIDTH);
  const height = parseFlagInt('--height', DEFAULT_HEIGHT);
  const writeCheckpoints = parseFlagBool('--checkpoints', DEFAULT_CHECKPOINTS);

  cleanOldOutputs();

  const startedAt = Date.now();
  const reports = seeds.map((seed) => runSimulation(seed, years, width, height, writeCheckpoints));
  const elapsedMs = Date.now() - startedAt;

  const output = {
    generatedAt: new Date().toISOString(),
    years,
    width,
    height,
    seeds,
    elapsedMs,
    reports,
  };

  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, JSON.stringify(output, null, 2), 'utf-8');

  console.log(`Phase 1 harness complete in ${elapsedMs}ms`);
  for (const report of reports) {
    console.log(
      `seed=${report.seed} plants=${report.finalMetrics.totalPlants} dormantSeeds=${report.finalMetrics.totalDormantSeeds}`,
    );
  }
  console.log(`Report: ${REPORT_PATH}`);
  if (writeCheckpoints) {
    console.log(`Checkpoints: ${CHECKPOINT_DIR}`);
  }
}

main();
