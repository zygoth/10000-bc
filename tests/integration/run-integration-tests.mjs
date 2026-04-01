import { INTEGRATION_TESTS as PLAYER_TESTS } from './player-mechanics.integration.mjs';
import { INTEGRATION_TESTS as CAMP_TECH_TESTS } from './camp-tech.integration.mjs';
import { INTEGRATION_TESTS as PARTNER_TESTS } from './partner-systems.integration.mjs';
import { INTEGRATION_TESTS as JOURNEY_TESTS } from './world-journey.integration.mjs';

function main() {
  const tests = [
    ...PLAYER_TESTS,
    ...CAMP_TECH_TESTS,
    ...PARTNER_TESTS,
    ...JOURNEY_TESTS,
  ];

  const started = Date.now();
  const timing = [];
  for (const [name, testFn] of tests) {
    const testStartNs = process.hrtime.bigint();
    testFn();
    const elapsedMs = Number(process.hrtime.bigint() - testStartNs) / 1e6;
    timing.push({ name, elapsedMs });
    console.log(`PASS ${name}`);
  }

  const totalMs = Date.now() - started;
  const slowest = [...timing]
    .sort((a, b) => b.elapsedMs - a.elapsedMs)
    .slice(0, 10);

  console.log('Slowest integration tests (top 10):');
  for (const entry of slowest) {
    console.log(`  ${entry.elapsedMs.toFixed(1)}ms  ${entry.name}`);
  }
  console.log(`All integration tests passed in ${totalMs}ms`);
}

main();

