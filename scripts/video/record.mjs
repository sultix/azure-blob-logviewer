import { record } from './lib/kit.mjs';

const ids = process.argv.slice(2);
if (ids.length === 0) {
  console.error('usage: node record.mjs 01 02 ...');
  process.exit(1);
}

for (const id of ids) {
  const mod = await import(`./segments/s${id}.mjs`);
  const { meta, run } = mod;
  process.stdout.write(`▶ segment ${id} … `);
  const started = Date.now();
  const file = await record(id, meta, run);
  console.log(`ok (${((Date.now() - started) / 1000).toFixed(1)}s) → ${file}`);
}
