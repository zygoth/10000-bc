// Usage: node tests/sim/summarize-cpuprofile.mjs <path-to-cpuprofile-or-node-cpu-prof-file>
import fs from 'node:fs';

const path = process.argv[2];
if (!path) {
  console.error('Usage: node tests/sim/summarize-cpuprofile.mjs <profile-file>');
  process.exit(1);
}

const raw = fs.readFileSync(path, 'utf8');
const profile = JSON.parse(raw);

const { nodes, samples, timeDeltas } = profile;
if (!Array.isArray(nodes) || !Array.isArray(samples)) {
  console.error('Unrecognized profile shape');
  process.exit(1);
}

const byId = new Map(nodes.map((n) => [n.id, n]));
const parentOf = new Map();
for (const n of nodes) {
  for (const c of n.children || []) {
    parentOf.set(c, n.id);
  }
}

const selfUs = new Map();
const totalUs = new Map();

for (const id of nodes.map((n) => n.id)) {
  selfUs.set(id, 0);
  totalUs.set(id, 0);
}

let deltas = timeDeltas;
if (!deltas || deltas.length === 0) {
  const interval = 1000;
  deltas = samples.map(() => interval);
}

for (let i = 0; i < samples.length; i += 1) {
  const dt = Number(
    i < deltas.length ? deltas[i] : deltas[deltas.length - 1] || 0,
  );
  if (dt <= 0) continue;

  let id = samples[i];
  selfUs.set(id, (selfUs.get(id) || 0) + dt);

  const chain = new Set();
  while (id != null && !chain.has(id)) {
    chain.add(id);
    totalUs.set(id, (totalUs.get(id) || 0) + dt);
    id = parentOf.get(id);
  }
}

function label(node) {
  if (!node?.callFrame) return '?';
  const { functionName, url } = node.callFrame;
  const shortUrl = (url || '').replace(/^.*\/10000BC\//, '').replace(/^file:\/\//, '');
  const name = functionName || '(anonymous)';
  return `${name} @ ${shortUrl || '(native)'}`;
}

const rows = nodes.map((n) => ({
  id: n.id,
  self: selfUs.get(n.id) || 0,
  total: totalUs.get(n.id) || 0,
  label: label(n),
}));

const topTotal = [...rows].sort((a, b) => b.total - a.total).slice(0, 30);
const topSelf = [...rows].sort((a, b) => b.self - a.self).slice(0, 25);

const sumSelf = rows.reduce((s, r) => s + r.self, 0);

console.log(`Profile: ${path}`);
console.log(`Samples: ${samples.length}, sum(self) μs: ${Math.round(sumSelf / 1000)} ms (approx wall in sample domain)\n`);
console.log('--- Top by TOTAL (inclusive) time ---');
for (const r of topTotal) {
  if (r.total <= 0) continue;
  console.log(`${(r.total / 1000).toFixed(1)} ms\t${r.label}`);
}
console.log('\n--- Top by SELF time ---');
for (const r of topSelf) {
  if (r.self <= 0) continue;
  console.log(`${(r.self / 1000).toFixed(1)} ms\t${r.label}`);
}
