import { chromium } from 'playwright';

const url = process.env.I18N_TEST_URL || 'http://127.0.0.1:4173/';
const browser = await chromium.launch({ headless:true });
const failures = [];
const userData = ['Анна Петрова','Иван Петров','Марк Петров'];

const clean = value => {
  let text = String(value || '');
  for (const item of userData) text = text.split(item).join('[USER_NAME]');
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .join('\n');
};

async function checkOverflow(page, label) {
  const dims = await page.evaluate(() => ({
    width: window.innerWidth,
    doc: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
  if (dims.doc > dims.width + 1 || dims.body > dims.width + 1) {
    failures.push({ label: label + '-overflow', dims });
  }
}

async function inspect(page, locale, label, fn, selector) {
  if (fn) await page.evaluate(fn);
  await page.waitForTimeout(420);
  const text = clean(await page.locator(selector).innerText().catch(()=>''));
  const cyr = text.split('\n').filter(line => /[А-Яа-яЁё]/.test(line));
  if (cyr.length) failures.push({ locale, label, cyr:cyr.slice(0,40) });
  console.log(locale.toUpperCase() + ' SCREEN ' + label + ': ' + (cyr.length ? 'FAIL' : 'OK'));
  if (cyr.length) console.log(cyr.slice(0,40).join('\n'));
  await checkOverflow(page, locale + '-' + label);
}

async function runLocale(locale, viewport) {
  const origin = new URL(url).origin;
  const context = await browser.newContext({
    viewport,
    storageState: {
      cookies: [],
      origins: [{
        origin,
        localStorage: [{ name:'max-tour-locale-v1', value:locale }]
      }]
    }
  });
  const page = await context.newPage();

  await page.goto(url, { waitUntil:'networkidle' });
  await page.waitForFunction(expected => globalThis.MaxTourI18n?.locale === expected, locale);
  await page.waitForTimeout(650);

  const buttons = await page.locator('.mt-language-switcher button').evaluateAll(nodes => nodes.map(n => n.dataset.locale));
  if (buttons.join(',') !== 'ru,vi,en') failures.push({ locale, label:'switcher', buttons });

  await inspect(page, locale, 'home', () => { showScreen('home'); }, '#homeScreen');
  await inspect(page, locale, 'catalog', () => { showScreen('catalog'); }, '#catalogScreen');
  await inspect(page, locale, 'tour-group', () => { openTour('dalat-premium'); setFormat('group'); }, '#tourScreen');
  await inspect(page, locale, 'tour-individual', () => { setFormat('individual'); }, '#tourScreen');
  await inspect(page, locale, 'booking', () => { startBooking('individual'); }, '#bookingScreen');
  await inspect(page, locale, 'trips-profile', () => { state.tripTab='profile'; showScreen('trips'); }, '#tripsScreen');
  await inspect(page, locale, 'trips-booked', () => { state.tripTab='booked'; renderTrips(); }, '#tripsScreen');
  await inspect(page, locale, 'ai', () => { showScreen('ai'); }, '#aiScreen');

  if (locale === 'en') {
    await page.locator('.mt-language-switcher button[data-locale="vi"]').click();
    await page.waitForFunction(() => localStorage.getItem('max-tour-locale-v1') === 'vi');
    await page.waitForLoadState('networkidle');
    await page.waitForFunction(() => globalThis.MaxTourI18n?.locale === 'vi');
    await page.locator('.mt-language-switcher button[data-locale="en"]').click();
    await page.waitForFunction(() => localStorage.getItem('max-tour-locale-v1') === 'en');
    await page.waitForLoadState('networkidle');
    await page.waitForFunction(() => globalThis.MaxTourI18n?.locale === 'en');
  }

  await context.close();
}

await runLocale('vi', { width:390, height:844 });
await runLocale('en', { width:390, height:844 });
await runLocale('en', { width:1440, height:900 });

await browser.close();

if (failures.length) {
  console.error(JSON.stringify(failures, null, 2));
  process.exit(1);
}
console.log('MAX TOUR existing v28 customer UI passed VI/EN smoke with RU/VI/EN switcher and no horizontal overflow.');
