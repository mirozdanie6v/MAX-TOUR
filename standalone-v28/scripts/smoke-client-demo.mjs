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
  const server = {
    bookings: [],
    favorites: [],
    travelers: [],
    groupDepartures: [{
      id:'dep-dalat-1',
      tourId:'dalat-premium',
      title:'ignored',
      city:'ignored',
      date:'2026-10-15',
      time:'05:30',
      capacity:18,
      minPeople:8,
      status:'open',
      notes:'',
      taken:7
    }]
  };

  await page.route('**/api/**', async route => {
    const req = route.request();
    const url = new URL(req.url());
    const method = req.method();

    if (url.pathname === '/api/bootstrap') {
      return route.fulfill({
        status:200, contentType:'application/json',
        body:JSON.stringify({
          ok:true,
          bookings:server.bookings,
          favorites:server.favorites,
          travelers:server.travelers,
          groupDepartures:server.groupDepartures,
          customTours:[],
          consultations:[],
          hasData:Boolean(server.bookings.length || server.favorites.length || server.travelers.length)
        })
      });
    }

    if (url.pathname === '/api/favorites' && method === 'PUT') {
      const body = JSON.parse(req.postData() || '{}');
      server.favorites = Array.isArray(body.favorites) ? body.favorites : [];
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,favorites:server.favorites})});
    }

    if (url.pathname === '/api/travelers' && method === 'PUT') {
      const body = JSON.parse(req.postData() || '{}');
      server.travelers = Array.isArray(body.travelers) ? body.travelers : [];
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,travelers:server.travelers})});
    }

    if (url.pathname === '/api/bookings' && method === 'POST') {
      const booking = JSON.parse(req.postData() || '{}');
      server.bookings.unshift(booking);
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true})});
    }

    if (url.pathname.startsWith('/api/bookings/') && method === 'PATCH') {
      const id = decodeURIComponent(url.pathname.slice('/api/bookings/'.length));
      const patch = JSON.parse(req.postData() || '{}');
      const index = server.bookings.findIndex(x => String(x.id) === String(id));
      if (index < 0) return route.fulfill({status:404,contentType:'application/json',body:JSON.stringify({ok:false,error:'booking_not_found'})});
      server.bookings[index] = {...server.bookings[index], ...patch};
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,booking:server.bookings[index]})});
    }

    if (url.pathname === '/api/ai/chat' && method === 'POST') {
      const body = JSON.parse(req.postData() || '{}');
      const reply = body.locale === 'en'
        ? 'I can help you choose a tour. Tell me your destination, date and party size.'
        : 'Tôi có thể giúp bạn chọn tour. Hãy cho tôi biết điểm đến, ngày đi và số người.';
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,reply,source:'test'})});
    }

    return route.fulfill({status:404,contentType:'application/json',body:JSON.stringify({ok:false})});
  });

  return server;
}

async function mobileFlow(browser) {
  const page = await browser.newPage({viewport:{width:390,height:844}});
  const server = await stubApi(page);
  await page.addInitScript(() => {
    if (!localStorage.getItem('viiversion-travel-demo-locale')) {
      localStorage.setItem('viiversion-travel-demo-locale','vi');
    }
  });

  await page.goto(base,{waitUntil:'networkidle'});
  assert(await page.locator('html').getAttribute('lang') === 'vi','default locale is not vi');
  await noCyrillic(page,'VI home');
  await noOverflow(page,'VI home');

  await page.locator('[data-action="screen"][data-screen="tours"]').last().click();
  await page.waitForSelector('.tour-card');
  await noCyrillic(page,'VI catalog');
  const ids = await page.locator('.tour-card').evaluateAll(nodes => nodes.map(n=>n.dataset.id));
  assert(ids.length === 15,'expected 15 tours, got '+ids.length);

  await page.locator('.tour-card[data-id="dalat-premium"] .heart').click();
  await page.locator('[data-action="screen"][data-screen="trips"]').last().click();
  await page.locator('[data-action="trip-tab"][data-tab="favorites"]').click();
  await page.waitForSelector('.tour-card[data-id="dalat-premium"]');
  assert(server.favorites.includes('dalat-premium'),'favorite was not persisted');
  await noCyrillic(page,'VI favorites');

  await page.locator('[data-action="screen"][data-screen="tours"]').last().click();
  for (const id of ids) {
    await page.locator('.tour-card[data-id="'+id+'"]').click();
    await page.waitForSelector('.detail-hero');
    await noCyrillic(page,'VI detail '+id);
    await page.locator('[data-action="screen"][data-screen="tours"]').first().click();
    await page.waitForSelector('.tour-card');
  }

  await page.locator('.tour-card[data-id="dalat-premium"]').click();
  await page.waitForSelector('.departure-card[data-id="dep-dalat-1"]');
  await page.locator('.departure-card[data-id="dep-dalat-1"]').click();
  await page.locator('[data-action="booking"]').click();
  await page.waitForSelector('#bookingForm');
  await noCyrillic(page,'VI booking');
  assert(await page.locator('.booking-field[data-field="date"]').inputValue() === '2026-10-15','selected departure date was not copied');

  await page.locator('.booking-field[data-field="phone"]').fill('+84900000000');
  await page.locator('.traveler-name[data-slot="0"]').fill('Nguyen An');
  await page.locator('.traveler-birth[data-slot="0"]').fill('1990-01-01');
  await page.locator('.traveler-name[data-slot="1"]').fill('Tran Binh');
  await page.locator('.traveler-birth[data-slot="1"]').fill('1991-02-02');
  await page.locator('#bookingForm button[type="submit"]').click();

  await page.waitForSelector('.full-trip');
  assert(server.bookings.length === 1,'booking was not persisted');
  assert(server.travelers.length === 2,'travelers were not persisted');
  await noCyrillic(page,'VI booked trip');

  await page.locator('[data-action="pay-balance"]').click();
  await page.waitForSelector('.modal-card');
  assert(server.bookings[0].rest === '$0','remaining balance was not cleared');
  await page.locator('[data-action="close-modal"]').last().click();

  await page.locator('[data-action="reschedule-trip"]').click();
  await page.waitForSelector('#rescheduleForm');
  await page.locator('#rescheduleForm input[name="date"]').fill('2026-10-20');
  await page.locator('#rescheduleForm button[type="submit"]').click();
  await page.waitForSelector('.modal-card');
  assert(server.bookings[0].date === '2026-10-20','reschedule was not persisted');
  await page.locator('[data-action="close-modal"]').last().click();

  await page.locator('[data-action="cancel-trip"]').click();
  await page.waitForSelector('[data-action="confirm-cancel"]');
  await page.locator('[data-action="confirm-cancel"]').click();
  await page.waitForSelector('.modal-card');
  assert(server.bookings[0].status === 'cancelled','cancellation was not persisted');
  await page.locator('[data-action="close-modal"]').last().click();
  await noCyrillic(page,'VI trip actions');

  await page.locator('[data-action="trip-tab"][data-tab="profile"]').click();
  await page.waitForSelector('.profile-person');
  assert(await page.locator('.profile-person').count() === 2,'saved travelers not shown in profile');
  await page.locator('[data-action="add-traveler"]').click();
  await page.waitForSelector('#travelerForm');
  await page.locator('#travelerForm select[name="role"]').selectOption('child');
  await page.locator('#travelerForm input[name="name"]').fill('Le Minh');
  await page.locator('#travelerForm input[name="birth"]').fill('2016-03-03');
  await page.locator('#travelerForm button[type="submit"]').click();
  await page.waitForFunction(() => document.querySelectorAll('.profile-person').length === 3);
  assert(server.travelers.length === 3,'profile traveler addition was not persisted');
  await noCyrillic(page,'VI traveler profile');

  await page.locator('[data-action="screen"][data-screen="ai"]').last().click();
  await page.waitForSelector('#aiForm');
  await page.locator('#aiForm input[name="message"]').fill('Tôi muốn đi Đà Lạt');
  await page.locator('#aiForm button[type="submit"]').click();
  await page.waitForFunction(() => document.querySelectorAll('.msg.bot').length >= 2);
  await noCyrillic(page,'VI AI');

  await page.locator('[data-action="locale"][data-locale="en"]').click();
  await page.waitForFunction(() => document.documentElement.lang === 'en');
  await noCyrillic(page,'EN AI');

  await page.locator('[data-action="screen"][data-screen="trips"]').last().click();
  await page.locator('[data-action="trip-tab"][data-tab="profile"]').click();
  await noCyrillic(page,'EN profile');
  await noOverflow(page,'EN profile mobile');

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

  await page.locator('[data-action="booking"]').click();
  await page.waitForSelector('#bookingForm');
  await noOverflow(page,'EN desktop booking');

  await page.locator('[data-action="screen"][data-screen="trips"]').last().click();
  await page.locator('[data-action="trip-tab"][data-tab="profile"]').click();
  await noOverflow(page,'EN desktop profile');

  await page.close();
}

const browser = await chromium.launch({headless:true});
try {
  await mobileFlow(browser);
  await desktopFlow(browser);
  console.log('VI/EN full client cabinet E2E passed: 15 tours, favorites, departures, booking, travelers, payment, reschedule, cancel, AI, locale persistence, mobile and desktop.');
} finally {
  await browser.close();
}
