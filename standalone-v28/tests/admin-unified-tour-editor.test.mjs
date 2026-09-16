import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const editor = await readFile(resolve(root, 'src/admin-tour-media.js'), 'utf8');

test('tour editor is a single form and has no separate photo manager', () => {
  assert.match(editor, /id="unifiedTourForm"/);
  assert.match(editor, /Все данные экскурсии, цены, программа и фотографии — в одной форме/);
  assert.match(editor, /name="imageFile" type="file"/);
  assert.match(editor, /name="gallery"/);
  assert.match(editor, /Сохранить все изменения/);
  assert.doesNotMatch(editor, /id="tourMediaManager"/);
  assert.doesNotMatch(editor, /Фото экскурсий<\/h2>/);
});

test('unified tour editor covers catalog content and preserves uncommon fields', () => {
  for (const field of [
    'title','city','region','category','duration','time','typesText','capacity','priceFromUsd','priceLabel',
    'groupFrom','groupAdult','groupChild','groupInfant','groupDeposit','groupNotes','groupDepartures',
    'individualFrom','individualDeposit','individualTiers','program','included','notIncluded','whatToTake',
    'recommendations','tags','searchText','image','gallery','topExtras','groupExtras','individualExtras',
  ]) assert.match(editor, new RegExp(`name="${field}"`));
  assert.match(editor, /\.\.\.topExtras/);
  assert.match(editor, /\.\.\.groupExtras/);
  assert.match(editor, /\.\.\.individualExtras/);
});

test('catalog edit action is intercepted and the same save handles metadata and R2 cover upload', () => {
  assert.match(editor, /data-admin-action="edit-tour"/);
  assert.match(editor, /stopImmediatePropagation\(\)/);
  assert.match(editor, /\/api\/admin\/tours\/\$\{encodeURIComponent\(payload\.id\)\}/);
  assert.match(editor, /\/image`/);
  assert.match(editor, /method:'PUT'/);
  assert.match(editor, /method:'POST'/);
});
