import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const ai = await readFile(resolve(root, 'src/ai-consultant-v5.js'), 'utf8');
const css = await readFile(resolve(root, 'src/ai-consultant-v5.css'), 'utf8');
const build = await readFile(resolve(root, 'build.mjs'), 'utf8');
const worker = await import('../src/worker-profile.js?ai-sales-v5-test');

test('AI consultant v5 source is syntactically valid and wired into build', () => {
  assert.doesNotThrow(() => new vm.Script(ai));
  assert.match(build, /ai-consultant-v5\.js/);
  assert.match(build, /ai-consultant-v5\.css/);
  assert.match(build, /copyFile\(resolve\(root, 'src\/ai-consultant-v5\.js'/);
});

test('AI recommendations render visual excursion cards with direct booking action', () => {
  assert.match(ai, /class="ai-tour-image"/);
  assert.match(ai, /data-ai-action="open-tour"/);
  assert.match(ai, /data-ai-action="book-tour"/);
  assert.match(ai, />Забронировать</);
  assert.match(ai, /BOOKING_INTENT_KEY/);
  assert.match(ai, /continueToBooking/);
  assert.match(ai, /prefillBooking/);
  assert.match(css, /\.ai-sales-card/);
  assert.match(css, /\.ai-card-actions/);
});

test('AI can recommend before every guided slot is filled', () => {
  assert.match(ai, /isDiscoveryIntent\(text\) \|\| signals >= 2/);
  assert.match(ai, /Хочу море и острова/);
  assert.match(ai, /Хочу природу и красивые виды/);
});

test('AI uses Vietnam date and rejects past calendar dates', () => {
  assert.match(ai, /Asia\/Ho_Chi_Minh/);
  assert.match(ai, /Эта дата уже прошла/);
  assert.equal(worker._test.containsPastDate('Есть выезд 13 сентября 2026', '2026-09-14'), true);
  assert.equal(worker._test.containsPastDate('Есть выезд 15 сентября 2026', '2026-09-14'), false);
  assert.equal(worker._test.containsPastDate('Есть выезд 2026-09-13', '2026-09-14'), true);
  assert.equal(worker._test.containsPastDate('Есть выезд 2026-09-15', '2026-09-14'), false);
});
