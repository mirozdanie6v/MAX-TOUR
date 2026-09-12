import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const admin = await readFile(resolve(root, 'src/admin-v3.html'), 'utf8');
const director = await readFile(resolve(root, 'src/director-v3.html'), 'utf8');
const adminApp = await readFile(resolve(root, 'src/admin-app.js'), 'utf8');
const roleScript = await readFile(resolve(root, 'src/role-switch.js'), 'utf8');
const roleStyles = await readFile(resolve(root, 'src/role-switch.css'), 'utf8');
const build = await readFile(resolve(root, 'build.mjs'), 'utf8');

test('admin v3 keeps the approved navigation and operational views', () => {
  for (const section of ['Обзор', 'Выезды', 'Заказы', 'Группы', 'Запросы клиентов', 'Клиенты', 'Оплаты', 'Каталог', 'Задачи директора', 'Уведомления', 'Аналитика']) {
    assert.match(admin, new RegExp(section));
  }
  assert.match(adminApp, /window\.renderDashboard = function\(/);
  assert.match(adminApp, /window\.renderDepartures = function\(/);
  assert.match(adminApp, /window\.renderOrders = function\(/);
  assert.match(adminApp, /window\.renderCustomers = function\(/);
  assert.match(adminApp, /window\.renderTasks = function\(/);
  assert.match(adminApp, /window\.renderConsultations = function\(/);
});

test('role switch connects tourist, administrator and director cabinets', () => {
  assert.match(admin, /aria-label="Переключение роли"/);
  assert.match(admin, /href="\/"[^>]*aria-label="Открыть кабинет туриста"/);
  assert.match(admin, /href="\/admin\/" class="active"/);
  assert.match(admin, /href="\/director\/"/);
  assert.match(roleScript, /querySelector\('\.admin-top'\)/);
  assert.match(roleScript, /href="\/admin\/"/);
  assert.match(roleScript, /href="\/director\/"/);
  assert.match(roleScript, /window\.showAdmin = \(\) => window\.location\.assign\('\/admin\/'\)/);
  assert.match(roleStyles, /\.max-role-switch/);
});

test('director cabinet keeps its management views and direct access', () => {
  for (const section of ['Пульт директора', 'План и прогноз', 'Города', 'Экскурсии', 'Группы и спрос', 'Деньги', 'Клиенты и источники', 'Команда', 'AI-помощник']) {
    assert.match(director, new RegExp(section));
  }
  assert.match(director, /aria-label="Переключение роли"/);
  assert.match(director, /href="\/director\/" class="active"/);
  assert.doesNotMatch(director, /type="password"/);
  assert.match(director, /format\(Math\.round\(n \* periodFactor\(\)\)\) \+ " ₽"/);
  assert.doesNotMatch(director, /USD/);
});

test('director demo filters, search and periods change visible data', () => {
  assert.match(director, /data-filter="period"/);
  assert.match(director, /data-filter="city"/);
  assert.match(director, /data-filter="status"/);
  assert.match(director, /function filteredRows\(rows\)/);
  assert.match(director, /field\.addEventListener\("change"/);
  assert.match(director, /HORIZON_FACTORS/);
  assert.match(director, /visibleDecisions = decisions\.slice/);
  assert.match(director, /function searchIndex\(\)/);
  assert.match(director, /\.filter\(function\(item\).*includes\(q\)/);
  assert.match(director, /data-search-index/);
});

test('director includes a dedicated analytics dashboard with demographic and channel slices', () => {
  assert.match(director, /id:"analytics", label:"Аналитика"/);
  assert.match(director, /function renderAnalytics\(\)/);
  assert.match(director, /data-analytics-filter/);
  assert.match(director, /analyticsFilters/);
  assert.match(director, /analyticsGender/);
  assert.match(director, /analyticsAge/);
  assert.match(director, /analyticsOrigins/);
  assert.match(director, /analyticsDestinations/);
  assert.match(director, /conic-gradient/);
  assert.match(director, /Динамика выручки/);
  assert.match(director, /Откуда пришли/);
  assert.doesNotMatch(director, /NaN/);
});

test('director receives live orders while preserving interactive slices', () => {
  assert.match(director, /fetch\("\/api\/admin\/bootstrap"/);
  assert.match(director, /var liveCrm =/);
  assert.match(director, /function hydrateLiveCrm\(data\)/);
  assert.match(director, /function liveCrmBlock\(\)/);
  assert.match(director, /function liveAnalyticsCard\(\)/);
  assert.match(director, /setInterval\(loadLiveCrm, 10000\)/);
  assert.match(adminApp, /data-admin-form=\"order\"/);
  assert.match(adminApp, /data-admin-form=\"departure\"/);
  assert.match(adminApp, /\/api\/admin\/orders/);
  assert.match(adminApp, /\/api\/admin\/departures/);
  assert.match(director, /liveCrm\.consultations/);
  assert.match(director, /обращений менеджеру/);
});

test('AI consultant is a guided complex-tour flow, not a generic one-shot search', () => {
  assert.match(build, /ai-consultant\.css/);
  assert.match(build, /ai-consultant\.js/);
  assert.match(adminApp, /Запросы для менеджера/);
});

test('director demo actions create session drafts and every internal navigation control is bound', () => {
  assert.match(director, /sessionStorage\.setItem\("maxtourDirectorDrafts"/);
  assert.match(director, /function openDraftComposer\(title,note\)/);
  assert.match(director, /function createDraft\(title,note,owner\)/);
  assert.match(director, /querySelectorAll\("\[data-nav\]"\)/);
  assert.match(director, /if\(id === "guide-confirm"\)/);
  assert.match(director, /\/api\/admin\/tasks/);
  assert.match(director, /Отправить администратору/);
});

test('admin prototype displays money only in rubles', () => {
  assert.match(admin, /toLocaleString\("ru-RU"\) \+ " ₽"/);
  assert.doesNotMatch(admin, /\$[0-9]/);
  assert.doesNotMatch(admin, /USD/);
});

test('standalone build publishes admin and director routes plus role switch assets', () => {
  assert.match(build, /mkdir\(resolve\(dist, 'admin'\)/);
  assert.match(build, /admin\/index\.html/);
  assert.match(build, /mkdir\(resolve\(dist, 'director'\)/);
  assert.match(build, /director\/index\.html/);
  assert.match(build, /role-switch\.css/);
  assert.match(build, /role-switch\.js/);
  assert.match(build, /admin-app\.css/);
  assert.match(build, /admin-app\.js/);
  assert.match(build, /max-tour-logo\.svg/);
});

test('all three cabinets publish the same approved Max Tour logo asset', () => {
  assert.match(build, /function replaceBrandLogos\(html\)/);
  assert.match(build, /brandLogoPath = '\/max-tour-logo\.svg'/);
  assert.match(admin, /<img alt="MaxTour" src="\/max-tour-logo\.svg">/);
  assert.match(admin, /const logoSrc = '\/max-tour-logo\.svg';/);
  assert.doesNotMatch(admin, /<img\s+alt="MaxTour"\s+src="data:image/);
  assert.match(director, /class="brand-logo" src="\/max-tour-logo\.svg"/);
  assert.doesNotMatch(director, /class="logo-mark"/);
});

test('published Mini App replaces the legacy inline admin with protected v3', async () => {
  assert.match(build, /replaceLegacyAdmin/);
  assert.match(build, /window\.location\.assign\('\/admin\/'\)/);
  assert.match(build, /Prototype legacy admin renderer was not found/);
});
