import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const admin = await readFile(resolve(root, 'src/admin-v3.html'), 'utf8');
const adminApp = await readFile(resolve(root, 'src/admin-app.js'), 'utf8');
const roleScript = await readFile(resolve(root, 'src/role-switch.js'), 'utf8');
const roleStyles = await readFile(resolve(root, 'src/role-switch.css'), 'utf8');
const build = await readFile(resolve(root, 'build.mjs'), 'utf8');

test('admin v3 keeps the approved navigation and operational views', () => {
  for (const section of ['Обзор', 'Выезды', 'Заказы', 'Группы', 'Клиенты', 'Оплаты', 'Каталог', 'Уведомления', 'Аналитика']) {
    assert.match(admin, new RegExp(section));
  }
  assert.match(adminApp, /window\.renderDashboard = function\(/);
  assert.match(adminApp, /window\.renderDepartures = function\(/);
  assert.match(adminApp, /window\.renderOrders = function\(/);
  assert.match(adminApp, /window\.renderCustomers = function\(/);
});

test('role switch connects tourist and administrator cabinets', () => {
  assert.match(admin, /aria-label="Переключение роли"/);
  assert.match(admin, /href="\/"[^>]*aria-label="Открыть кабинет туриста"/);
  assert.match(admin, /href="\/admin\/" class="active"/);
  assert.match(roleScript, /querySelector\('\.admin-top'\)/);
  assert.match(roleScript, /href="\/admin\/"/);
  assert.match(roleStyles, /\.max-role-switch/);
});

test('admin prototype displays money only in rubles', () => {
  assert.match(admin, /toLocaleString\("ru-RU"\) \+ " ₽"/);
  assert.doesNotMatch(admin, /\$[0-9]/);
  assert.doesNotMatch(admin, /USD/);
});

test('standalone build publishes the admin route and role switch assets', () => {
  assert.match(build, /mkdir\(resolve\(dist, 'admin'\)/);
  assert.match(build, /admin\/index\.html/);
  assert.match(build, /role-switch\.css/);
  assert.match(build, /role-switch\.js/);
  assert.match(build, /admin-app\.css/);
  assert.match(build, /admin-app\.js/);
});
