import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { _test } from '../src/admin-api.js';

const root = resolve(import.meta.dirname, '..');
const html = await readFile(resolve(root, 'src/admin-v3.html'), 'utf8');
const app = await readFile(resolve(root, 'src/admin-app.js'), 'utf8');
const api = await readFile(resolve(root, 'src/admin-api.js'), 'utf8');
const worker = await readFile(resolve(root, 'src/worker.js'), 'utf8');
const migration = await readFile(resolve(root, 'migrations/0002_admin_crm.sql'), 'utf8');
const taskMigration = await readFile(resolve(root, 'migrations/0003_admin_tasks.sql'), 'utf8');
const wrangler = await readFile(resolve(root, 'wrangler.jsonc'), 'utf8');

test('admin prototype contains no hardcoded customer, order or payment records', () => {
  assert.match(html, /const departuresData = \[\];/);
  assert.match(html, /const ordersData = \[\];/);
  assert.match(html, /const customersData = \[\];/);
  for (const formerFixture of ['Иван Петров', 'Марина Орлова', 'MT-014', '+84 90 123']) {
    assert.doesNotMatch(html, new RegExp(formerFixture.replace(/[+]/g, '\\+')));
  }
});

test('password hashing is salted and role permissions are enforced', async () => {
  const hash = await _test.passwordHash('very-secure-password', '00112233445566778899aabbccddeeff', 1000);
  assert.equal(hash.length, 64);
  assert.equal(_test.timingSafeEqual(hash, hash), true);
  assert.equal(_test.timingSafeEqual(hash, `${hash.slice(0, -1)}0`), false);
  assert.equal(_test.can('manager', 'booking.write'), true);
  assert.equal(_test.can('manager', 'tour.write'), false);
  assert.equal(_test.can('admin', 'tour.write'), true);
});

test('money normalization converts legacy dollars and keeps rubles', () => {
  assert.equal(_test.numberFromMoney('$420', 100), 42000);
  assert.equal(_test.numberFromMoney('42 000 ₽', 100), 42000);
  assert.equal(_test.bookingMoneyFromRubles(42000, '$420', 100), '$420');
  assert.equal(_test.bookingMoneyFromRubles(42000, '42000 ₽', 100), '42000 ₽');
  assert.equal(_test.paymentStatus(12600, 42000, 'Подтверждён'), 'Депозит');
  assert.equal(_test.paymentStatus(42000, 42000, 'Подтверждён'), 'Оплачено 100%');
});

test('admin API is isolated before tourist session and old public admin endpoints are removed', () => {
  assert.match(worker, /handleAdminApi\(request, env, url\)/);
  assert.doesNotMatch(worker, /url\.pathname === '\/api\/admin\/stats'/);
  assert.doesNotMatch(worker, /url\.pathname === '\/api\/admin\/events'/);
  assert.match(app, /\/api\/admin\/auth\/login/);
  assert.match(app, /x-csrf-token/);
  assert.match(app, /data-order-filter/);
  assert.match(app, /data-customer-filter/);
});

test('admin migration persists users, sessions, CRM actions and audit trail', () => {
  for (const table of ['admin_users', 'admin_sessions', 'admin_customer_profiles', 'admin_messages', 'admin_notification_rules', 'admin_broadcasts', 'admin_audit_log']) {
    assert.match(migration, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
  }
});

test('demo admin opens directly without setup or login UI', () => {
  assert.match(wrangler, /PUBLIC_ADMIN_DEMO/);
  assert.match(api, /demo-public-admin/);
  assert.match(api, /setupRequired: false, authenticated: true/);
  assert.match(app, /loadWorkspace\(\)/);
});

test('director tasks have a persistent D1 queue and admin API contract', () => {
  assert.match(taskMigration, /CREATE TABLE IF NOT EXISTS admin_tasks/);
  for (const field of ['title', 'description', 'owner', 'priority', 'status', 'due_date', 'created_by']) {
    assert.match(taskMigration, new RegExp(`${field}`));
  }
  assert.match(api, /path === '\/api\/admin\/tasks' && request.method === 'POST'/);
  assert.match(api, /const task = path\.match/);
  assert.match(api, /task\.write/);
});
