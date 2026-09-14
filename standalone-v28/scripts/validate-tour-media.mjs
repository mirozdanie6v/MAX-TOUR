import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const overrides = JSON.parse(await readFile(resolve(root, 'src/catalog-image-overrides.json'), 'utf8'));
const manifest = JSON.parse(await readFile(resolve(root, 'src/tour-media-sources.json'), 'utf8'));
const expected = [
  'dalat-premium','dalat-vip','fuyen','nhatrang-day','nhatrang-night','dalat-2days','fast-track',
  'danang-ba-na-hoian','danang-city-sontra','phuquoc-4-islands','phuquoc-vinwonders-safari',
  'hanoi-halong-2d','hanoi-sapa-3d','hanoi-ninhbinh','muine-dunes-jeep',
];
const fail = message => { throw new Error(`[tour-media] ${message}`); };

if (manifest.bucket !== 'max-tour-demo-v28-media') fail(`unexpected bucket ${manifest.bucket}`);
if (Number(manifest.minimumImagesPerTour) < 3) fail('minimumImagesPerTour must be >= 3');

const ids = Object.keys(overrides).sort();
if (ids.join('|') !== [...expected].sort().join('|')) fail(`tour ids mismatch: ${ids.join(', ')}`);

const byKey = new Map();
for (const item of manifest.items || []) {
  if (!item?.tourId || !item?.key || !item?.source) fail('invalid manifest item');
  if (!expected.includes(item.tourId)) fail(`unknown manifest tour ${item.tourId}`);
  if (byKey.has(item.key)) fail(`duplicate manifest key ${item.key}`);
  if (!item.key.startsWith(`${item.tourId}/`)) fail(`key/tour mismatch ${item.key}`);
  if (!/^https:\/\//i.test(item.source)) fail(`source must be https for ${item.key}`);
  byKey.set(item.key, item);
}

const used = new Set();
for (const id of expected) {
  const entry = overrides[id];
  if (!entry?.image || !Array.isArray(entry.gallery)) fail(`invalid override ${id}`);
  const gallery = [...new Set([entry.image, ...entry.gallery].filter(Boolean))];
  if (gallery.length < 3) fail(`${id} has only ${gallery.length} images`);
  if (!gallery.includes(entry.image)) fail(`${id} cover is not in gallery`);
  for (const path of gallery) {
    if (/^https?:\/\//i.test(path)) fail(`external runtime URL forbidden: ${path}`);
    if (!path.startsWith(`/tour-media/${id}/`)) fail(`wrong media prefix for ${id}: ${path}`);
    if (!/\.(?:jpe?g|png|webp|avif)$/i.test(path)) fail(`unsupported extension: ${path}`);
    const key = path.slice('/tour-media/'.length);
    const source = byKey.get(key);
    if (!source) fail(`missing provenance/source for ${key}`);
    if (source.tourId !== id) fail(`provenance tour mismatch for ${key}`);
    used.add(key);
  }
}

for (const key of byKey.keys()) if (!used.has(key)) fail(`orphan manifest object ${key}`);
if (used.size !== byKey.size) fail(`media count mismatch used=${used.size} manifest=${byKey.size}`);

console.log(`[tour-media] valid: ${expected.length} tours, ${used.size} R2 objects, zero external runtime URLs`);
