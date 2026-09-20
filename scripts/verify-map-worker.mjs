import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const assets = path.resolve(process.argv[2] ?? 'dist/assets');
const files = await readdir(assets);
const workers = files.filter(name => /^maplibre-gl-worker-.*\.js$/.test(name));
assert.ok(workers.length > 0, 'Production build must include the MapLibre worker');
const scripts = await Promise.all(files.filter(name => name.endsWith('.js')).map(name => readFile(path.join(assets, name), 'utf8')));
for (const worker of workers) {
  assert.ok(scripts.some(script => script.includes(`/overview-monitoring/assets/${worker}`)), 'Map renderer must reference the emitted worker under the deployment base');
  assert.ok((await readFile(path.join(assets, worker), 'utf8')).length > 10000, 'Worker must contain executable map processing code');
}
console.log('MapLibre production worker asset and reference verified');
