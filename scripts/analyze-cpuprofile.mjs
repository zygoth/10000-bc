import fs from 'node:fs';
import path from 'node:path';

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

function formatMs(ms) {
  if (!Number.isFinite(ms)) return '0ms';
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`;
  return `${ms.toFixed(1)}ms`;
}

function nodeLabel(n) {
  const fn = n.callFrame || {};
  const name = fn.functionName || '(anonymous)';
  const url = fn.url ? path.basename(fn.url) : '';
  const line = Number.isInteger(fn.lineNumber) ? fn.lineNumber + 1 : null;
  const col = Number.isInteger(fn.columnNumber) ? fn.columnNumber + 1 : null;
  const loc = url ? `${url}${line !== null ? `:${line}${col !== null ? `:${col}` : ''}` : ''}` : '';
  return loc ? `${name} (${loc})` : name;
}

function analyze(profile) {
  const nodesById = new Map();
  for (const n of profile.nodes || []) {
    nodesById.set(n.id, n);
  }

  // `timeDeltas` are microseconds between samples.
  const samples = profile.samples || [];
  const deltas = profile.timeDeltas || [];
  const count = Math.min(samples.length, deltas.length);

  const selfUsByNode = new Map();
  let totalUs = 0;
  for (let i = 0; i < count; i += 1) {
    const id = samples[i];
    const dt = deltas[i];
    if (!Number.isFinite(dt)) continue;
    totalUs += dt;
    selfUsByNode.set(id, (selfUsByNode.get(id) || 0) + dt);
  }

  const rows = [];
  for (const [id, selfUs] of selfUsByNode.entries()) {
    const node = nodesById.get(id);
    if (!node) continue;
    rows.push({
      id,
      selfUs,
      label: nodeLabel(node),
    });
  }

  rows.sort((a, b) => b.selfUs - a.selfUs);
  return { rows, totalUs, sampleCount: count };
}

function main() {
  const file = process.argv[2];
  const topN = Number(process.argv[3] || 25);
  if (!file) {
    console.error('Usage: node scripts/analyze-cpuprofile.mjs <file.cpuprofile> [topN]');
    process.exit(2);
  }
  const profile = readJson(file);
  const { rows, totalUs, sampleCount } = analyze(profile);
  const totalMs = totalUs / 1000;

  const top = rows.slice(0, Math.max(1, Math.min(rows.length, topN)));
  const out = {
    file,
    sampleCount,
    totalTimeMs: totalMs,
    topSelfTime: top.map((r) => ({
      selfTimeMs: r.selfUs / 1000,
      selfPct: totalUs ? (r.selfUs / totalUs) * 100 : 0,
      label: r.label,
    })),
  };
  console.log(JSON.stringify(out, null, 2));
}

main();

