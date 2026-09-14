import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const out = resolve(root, '.tour-media');
const manifest = JSON.parse(await readFile(resolve(root, 'src/tour-media-sources.json'), 'utf8'));

function expectedType(key) {
  if (/\.png$/i.test(key)) return 'png';
  if (/\.jpe?g$/i.test(key)) return 'jpg';
  if (/\.webp$/i.test(key)) return 'webp';
  if (/\.avif$/i.test(key)) return 'avif';
  return '';
}

function detectedType(buffer) {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]))) return 'png';
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpg';
  if (buffer.length >= 12 && buffer.toString('ascii',0,4) === 'RIFF' && buffer.toString('ascii',8,12) === 'WEBP') return 'webp';
  if (buffer.length >= 16 && buffer.toString('ascii',4,8) === 'ftyp' && /avif|avis/.test(buffer.toString('ascii',8,16))) return 'avif';
  return '';
}

async function fetchImage(item) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch(item.source, {
        redirect: 'follow',
        signal: controller.signal,
        headers: {
          'user-agent': 'Mozilla/5.0 (compatible; VIIVERSION-MAX-TOUR-MediaSeeder/1.0)',
          accept: 'image/jpeg,image/png,image/webp,image/avif,*/*;q=0.8',
          'accept-language': 'en-US,en;q=0.8',
        },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.length < 1024) throw new Error(`too small: ${buffer.length} bytes`);
      const expected = expectedType(item.key);
      const actual = detectedType(buffer);
      if (!actual) throw new Error('not a supported image payload');
      if (actual !== expected) throw new Error(`payload type ${actual} does not match .${expected}`);
      return buffer;
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise(resolveDelay => setTimeout(resolveDelay, attempt * 1200));
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new Error(`${item.key}: ${lastError?.message || lastError}`);
}

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

const items = manifest.items || [];
let completed = 0;
for (let index = 0; index < items.length; index += 4) {
  const chunk = items.slice(index, index + 4);
  await Promise.all(chunk.map(async item => {
    const buffer = await fetchImage(item);
    const target = resolve(out, item.key);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, buffer);
    completed += 1;
    console.log(`[tour-media] ${completed}/${items.length} ${item.key} ${buffer.length} bytes`);
  }));
}
console.log(`[tour-media] prepared ${completed} verified image files for R2 upload`);
