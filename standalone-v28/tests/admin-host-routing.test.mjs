import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const worker = await readFile(resolve(root, 'src/worker-r2.js'), 'utf8');

test('dedicated admin host exposes only admin/director surfaces', () => {
  assert.match(worker, /const ADMIN_HOST = 'max-tour-demo-admin\.viiversion\.com'/);
  assert.match(worker, /pathname === '\/'/);
  assert.match(worker, /new URL\('\/admin\/', url\)/);
  assert.match(worker, /pathname\.startsWith\('\/admin\/'\)/);
  assert.match(worker, /pathname\.startsWith\('\/director\/'\)/);
  assert.match(worker, /pathname\.startsWith\('\/api\/'\)/);
  assert.match(worker, /status: 404/);
});

test('main mini app host is not redirected by dedicated admin-host routing', () => {
  assert.match(worker, /if \(url\.hostname !== ADMIN_HOST\) return null/);
  assert.match(worker, /return profileWorker\.fetch\(request, env, ctx\)/);
});
