import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const [script, css, build] = await Promise.all([
  readFile(resolve(root, 'src/catalog-show-press.js'), 'utf8'),
  readFile(resolve(root, 'src/catalog-show-press.css'), 'utf8'),
  readFile(resolve(root, 'build.mjs'), 'utf8'),
]);

test('catalog Show press script parses and targets only exact Show label', () => {
  assert.doesNotThrow(() => new Function(script));
  assert.match(script, /const TARGET = 'Показать'/);
  assert.match(script, /HTMLButtonElement/);
  assert.match(script, /pointerdown/);
  assert.match(script, /pointerup/);
  assert.match(script, /catalog-show-pressed/);
  assert.doesNotMatch(script, /preventDefault\s*\(/);
  assert.doesNotMatch(script, /stopPropagation\s*\(/);
});

test('catalog Show press CSS provides visible tactile feedback', () => {
  assert.match(css, /\.catalog-show-press:active/);
  assert.match(css, /translate:\s*0 3px/);
  assert.match(css, /scale:\s*0\.965/);
  assert.match(css, /brightness\(0\.82\)/);
  assert.match(css, /prefers-reduced-motion/);
});

test('build publishes catalog Show press assets', () => {
  assert.match(build, /catalog-show-press\.css/);
  assert.match(build, /catalog-show-press\.js/);
  assert.match(build, /copyFile\(resolve\(root, 'src\/catalog-show-press\.css'\)/);
  assert.match(build, /copyFile\(resolve\(root, 'src\/catalog-show-press\.js'\)/);
});
