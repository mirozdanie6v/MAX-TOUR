import { chromium } from 'playwright';

const url = process.env.I18N_TEST_URL || 'http://127.0.0.1:4173/';
const browser = await chromium.launch({ headless:true });
const page = await browser.newPage({ viewport:{ width:390, height:844 } });

await page.addInitScript(() => {
  localStorage.setItem('max-tour-locale-v1','vi');
});

const failures = [];
const allowExact = new Set(['Анна Петрова','Иван Петров']);
const clean = value => String(value || '')
  .split('\n')
  .map(line => line.trim())
  .filter(Boolean)
  .filter(line => !allowExact.has(line))
  .join('\n');

async function inspect(label, fn, selector) {
  if (fn) await page.evaluate(fn);
  await page.waitForTimeout(350);
  const text = clean(await page.locator(selector).innerText().catch(()=>''));
  const cyr = text.split('\n').filter(line => /[А-Яа-яЁё]/.test(line));
  if (cyr.length) failures.push({ label, cyr:cyr.slice(0,30) });
  console.log('SCREEN ' + label + ': ' + (cyr.length ? 'FAIL' : 'OK'));
  if (cyr.length) console.log(cyr.slice(0,30).join('\n'));
}

await page.goto(url, { waitUntil:'networkidle' });
await page.waitForFunction(() => globalThis.MaxTourI18n?.locale === 'vi');
await page.waitForTimeout(500);

await inspect('home', () => { showScreen('home'); }, '#homeScreen');
await inspect('catalog', () => { showScreen('catalog'); }, '#catalogScreen');
await inspect('tour-group', () => { openTour('dalat-premium'); setFormat('group'); }, '#tourScreen');
await inspect('tour-individual', () => { setFormat('individual'); }, '#tourScreen');
await inspect('booking', () => { startBooking('individual'); }, '#bookingScreen');
await inspect('trips-profile', () => { state.tripTab='profile'; showScreen('trips'); }, '#tripsScreen');
await inspect('trips-booked', () => { state.tripTab='booked'; renderTrips(); }, '#tripsScreen');
await inspect('ai', () => { showScreen('ai'); }, '#aiScreen');

const switcher = await page.locator('.mt-language-switcher').count();
if (!switcher) failures.push({ label:'switcher', cyr:['RU/VI switcher missing'] });

await browser.close();
if (failures.length) {
  console.error(JSON.stringify(failures, null, 2));
  process.exit(1);
}
console.log('MAX TOUR VI customer UI has no residual Cyrillic on tested screens.');
