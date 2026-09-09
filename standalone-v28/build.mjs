import { mkdir, readFile, writeFile, copyFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';

const root = resolve(import.meta.dirname);
const dist = resolve(root, 'dist');
const sourceDir = resolve(root, 'source');
const manifest = JSON.parse(await readFile(resolve(sourceDir, 'manifest.json'), 'utf8'));

async function restore(entry) {
  const encoded = (await Promise.all(entry.parts.map(p => readFile(resolve(sourceDir, p), 'ascii')))).join('');
  const raw = gunzipSync(Buffer.from(encoded, 'base64'));
  const sha = createHash('sha256').update(raw).digest('hex');
  if (raw.length !== entry.size_bytes) throw new Error(`${entry.original_name}: size mismatch`);
  if (sha !== entry.sha256) throw new Error(`${entry.original_name}: checksum mismatch`);
  return raw;
}

const [prototypeRaw, catalogRaw] = await Promise.all([restore(manifest.html), restore(manifest.catalog)]);
const prototypeHtml = prototypeRaw.toString('utf8');
const catalog = JSON.parse(catalogRaw.toString('utf8'));
if (!Array.isArray(catalog) || catalog.length < 1) throw new Error('v28 catalog must be a non-empty array');
if (!prototypeHtml.includes('MaxTour Mini App Prototype v28')) throw new Error('Unexpected prototype source');
if (!prototypeHtml.includes('const TOURS =')) throw new Error('Prototype does not contain expected catalog binding');

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
const marker = '</body>';
const injection = '<script src="/booking-pricing.js"></script>\n<script src="/runtime-api.js" defer></script>\n';
if (!prototypeHtml.includes(marker)) throw new Error('Prototype has no </body> marker');
const builtHtml = prototypeHtml.replace(marker, `${injection}${marker}`);
await writeFile(resolve(dist, 'index.html'), builtHtml, 'utf8');
await writeFile(resolve(dist, 'catalog.v28.json'), catalogRaw);
await copyFile(resolve(root, 'src/booking-pricing.js'), resolve(dist, 'booking-pricing.js'));
await copyFile(resolve(root, 'src/runtime-api.js'), resolve(dist, 'runtime-api.js'));
console.log(`Built standalone v28: ${catalog.length} tours; exact source checksums verified.`);
