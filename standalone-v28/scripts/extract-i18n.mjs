import { readdir, readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..', 'dist');
const files = [];
async function walk(dir) {
  for (const name of await readdir(dir)) {
    const path = resolve(dir, name);
    const info = await stat(path);
    if (info.isDirectory()) await walk(path);
    else if (/\.(html|js|json)$/i.test(name)) files.push(path);
  }
}
await walk(root);

const phrases = new Set();
function add(value) {
  const text = String(value || '')
    .replace(/\\n/g, ' ')
    .replace(/\\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!/[А-Яа-яЁё]/.test(text)) return;
  if (text.length < 2 || text.length > 260) return;
  if (/^[\w.$/{}()[\]=><:+*?,;!|&\\-]+$/u.test(text)) return;
  phrases.add(text);
}

for (const file of files) {
  const source = await readFile(file, 'utf8');
  for (const match of source.matchAll(/>([^<>\n]{0,260}[А-Яа-яЁё][^<>\n]{0,260})</g)) add(match[1]);
  for (const match of source.matchAll(/(['"`])([^'"`\n]{0,260}[А-Яа-яЁё][^'"`\n]{0,260})\1/g)) add(match[2]);
}
const list = [...phrases].sort((a,b) => a.localeCompare(b, 'ru'));
process.stdout.write(JSON.stringify(list, null, 2));
