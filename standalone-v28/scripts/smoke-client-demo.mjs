import { chromium } from 'playwright';

const base = process.env.CLIENT_DEMO_URL || 'http://127.0.0.1:4174/';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
async function noCyrillic(page, label) {
  const text = await page.locator('body').innerText();
  const lines = text.split('\n').map(x=>x.trim()).filter(x=>/[А-Яа-яЁё]/.test(x));
  if (lines.length) throw new Error(label + ' contains Cyrillic: ' + lines.slice(0,12).join(' | '));
}
async function noOverflow(page, label) {
  const result = await page.evaluate(() => ({
    doc: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
    width: window.innerWidth
  }));
  assert(result.doc <= result.width + 1 && result.body <= result.width + 1,
    label + ' horizontal overflow ' + JSON.stringify(result));
}
async function stubApi(page) {
  await page.route('**/api/**', async route => {
    const req = route.request();
    const url = new URL(req.url());
    if (url.pathname === '/api/bootstrap') {
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,bookings:[],favorites:[],travelers:[],hasData:false})});
    }
    if (url.pathname === '/api/bookings' && req.method() === 'POST') {
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true})});
    }
    if (url.pathname === '/api/ai/chat' && req.method() === 'POST') {
      const body = JSON.parse(req.postData() || '{}');
      const reply = body.locale === 'en'
        ? 'I can help you choose a tour. Tell me your destination, date and party size.'
        : 'Tôi có thể giúp bạn chọn tour. Hãy cho tôi biết điểm đến, ngày đi và số người.';
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,reply,source:'test'})});
    }
    return route.fulfill({status:404,contentType:'application/json',body:JSON.stringify({ok:false})});
  });
}

async function mobileFlow(browser) {
  const page = await browser.newPage({viewport:{width:390,height:844}});
  await stubApi(page);
  await page.addInitScript(() => { if (!localStorage.getItem('viiversion-travel-demo-locale')) localStorage.setItem('viiversion-travel-demo-locale','vi'); });
  await page.goto(base,{waitUntil:'networkidle'});
  assert(await page.locator('html').getAttribute('lang') === 'vi','default locale is not vi');
  await noCyrillic(page,'VI home');
  await noOverflow(page,'VI home');

  await page.locator('[data-action="screen"][data-screen="tours"]').last().click();
  await page.waitForSelector('.tour-card');
  await noCyrillic(page,'VI catalog');
  const ids = await page.locator('.tour-card').evaluateAll(nodes => nodes.map(n=>n.dataset.id));
  assert(ids.length === 15,'expected 15 tours, got '+ids.length);

  for (const id of ids) {
    await page.locator('.tour-card[data-id="'+id+'"]').click();
    await page.waitForSelector('.detail-hero');
    await noCyrillic(page,'VI detail '+id);
    await page.locator('[data-action="screen"][data-screen="tours"]').first().click();
    await page.waitForSelector('.tour-card');
  }

  await page.locator('.tour-card').first().click();
  await page.locator('[data-action="format"][data-format="private"]').click();
  await page.locator('[data-action="booking"]').click();
  await page.waitForSelector('#bookingForm');
  await noCyrillic(page,'VI booking');
  await page.locator('input[name="date"]').fill('2026-10-10');
  await page.locator('input[name="name"]').fill('Nguyen An');
  await page.locator('input[name="phone"]').fill('+84900000000');
  await page.locator('#bookingForm button[type="submit"]').click();
  await page.waitForSelector('.trip');
  await noCyrillic(page,'VI trips');

  await page.locator('[data-action="screen"][data-screen="ai"]').last().click();
  await page.waitForSelector('#aiForm');
  await page.locator('#aiForm input[name="message"]').fill('Tôi muốn đi Đà Lạt');
  await page.locator('#aiForm button[type="submit"]').click();
  await page.waitForFunction(() => document.querySelectorAll('.msg.bot').length >= 2);
  await noCyrillic(page,'VI AI');

  await page.locator('[data-action="locale"][data-locale="en"]').click();
  await page.waitForFunction(() => document.documentElement.lang === 'en');
  await noCyrillic(page,'EN AI');
  await page.locator('[data-action="screen"][data-screen="tours"]').last().click();
  await page.waitForSelector('.tour-card');
  await noCyrillic(page,'EN catalog');
  await page.locator('.tour-card').first().click();
  await noCyrillic(page,'EN detail');
  await noOverflow(page,'EN detail mobile');

  await page.reload({waitUntil:'networkidle'});
  assert(await page.locator('html').getAttribute('lang') === 'en','EN locale did not persist after reload');
  await noCyrillic(page,'EN reload');
  await page.close();
}

async function desktopFlow(browser) {
  const page = await browser.newPage({viewport:{width:1440,height:900}});
  await stubApi(page);
  await page.addInitScript(() => localStorage.setItem('viiversion-travel-demo-locale','en'));
  await page.goto(base,{waitUntil:'networkidle'});
  await noCyrillic(page,'EN desktop home');
  await noOverflow(page,'EN desktop home');
  await page.locator('[data-action="screen"][data-screen="tours"]').last().click();
  await page.waitForSelector('.tour-grid');
  await noOverflow(page,'EN desktop catalog');
  await page.locator('.tour-card').nth(1).click();
  await noOverflow(page,'EN desktop detail');
  await page.close();
}

const browser = await chromium.launch({headless:true});
try {
  await mobileFlow(browser);
  await desktopFlow(browser);
  console.log('VI/EN client demo E2E passed: 15 tours, booking, trips, AI, locale persistence, mobile and desktop.');
} finally {
  await browser.close();
}
