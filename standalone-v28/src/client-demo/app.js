import { UI, CITY, DURATION, STATUS } from './client-ui-locales.js';

const STORAGE_KEY = 'viiversion-travel-demo-locale';
const state = {
  locale: localStorage.getItem(STORAGE_KEY) === 'en' ? 'en' : 'vi',
  screen: 'home',
  tours: [],
  localeTours: {},
  selectedId: null,
  format: 'group',
  query: '',
  city: '',
  formatFilter: '',
  bookings: [],
  ai: [],
  loading: true,
  error: ''
};

const app = document.getElementById('app');
const t = key => UI[state.locale][key] || key;
const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const cityLabel = value => CITY[state.locale][String(value || '')] || String(value || '');
const durationLabel = value => DURATION[state.locale][String(value || '')] || String(value || '');
const statusLabel = value => STATUS[state.locale][String(value || '')] || ({new:t('new'),paid:state.locale==='vi'?'Đã thanh toán':'Paid',cancelled:state.locale==='vi'?'Đã hủy':'Cancelled'}[String(value || '').toLowerCase()] || String(value || ''));
const money = value => {
  const match = String(value ?? '').match(/\$\s*([\d,.]+)/);
  if (match) return Number(match[1].replace(',','.')) || 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};
const moneyLabel = value => '$' + Math.round(Number(value) || 0).toLocaleString('en-US');

function localized(tour) {
  const l = state.localeTours[tour.id] || {};
  const route = (l.route || []).map(item => Array.isArray(item) ? {title:item[0],description:item[1] || ''} : {title:item,description:''});
  return {
    ...tour,
    title: l.title || tour.title,
    cityLabel: cityLabel(tour.city || tour.region),
    durationLabel: durationLabel(tour.duration),
    groupNotes: l.groupNotes || [],
    individualNotes: l.individualNotes || [],
    route,
    included: l.included || [],
    take: l.take || []
  };
}

function groupPrice(tour) {
  return money(tour.group?.adult || tour.group?.from || tour.priceFromUsd) || money(tour.priceFromUsd) || 0;
}
function childPrice(tour) {
  return money(tour.group?.child) || Math.max(0, Math.round(groupPrice(tour) * .7));
}
function privatePrice(tour) {
  return money(tour.individual?.from) || money((tour.individual?.tiers || [])[0]) || Math.max(groupPrice(tour) * 2, groupPrice(tour));
}
function displayPrice(tour) {
  return state.format === 'private' ? privatePrice(tour) : groupPrice(tour);
}

async function loadLocale(locale) {
  const response = await fetch('/client-locales/' + locale + '-tours.json', {cache:'no-store'});
  if (!response.ok) throw new Error('locale');
  state.localeTours = await response.json();
}
async function loadBootstrap() {
  try {
    const response = await fetch('/api/bootstrap', {cache:'no-store'});
    if (!response.ok) return;
    const data = await response.json();
    state.bookings = Array.isArray(data.bookings) ? data.bookings : [];
  } catch (_) {}
}
async function init() {
  state.loading = true;
  render();
  try {
    const [catalog] = await Promise.all([
      fetch('/catalog.v28.json', {cache:'no-store'}).then(r => {
        if (!r.ok) throw new Error('catalog');
        return r.json();
      }),
      loadLocale(state.locale),
      loadBootstrap()
    ]);
    state.tours = Array.isArray(catalog) ? catalog : [];
    state.ai = [{role:'bot',text:t('aiWelcome')}];
    state.loading = false;
  } catch (error) {
    state.error = String(error?.message || error);
    state.loading = false;
  }
  render();
}

function shell(content) {
  const nav = [
    ['home','navHome'],['tours','navTours'],['trips','navTrips'],['ai','navAi']
  ];
  return `<div class="shell">
    <header class="topbar">
      <div class="brand">
        <div class="brand-mark">V</div>
        <div class="brand-copy"><b>${esc(t('brand'))}</b><small>${esc(t('demo'))}</small></div>
      </div>
      <div class="lang" aria-label="${esc(t('language'))}">
        <button data-action="locale" data-locale="vi" class="${state.locale==='vi'?'active':''}">VI</button>
        <button data-action="locale" data-locale="en" class="${state.locale==='en'?'active':''}">EN</button>
      </div>
    </header>
    <main>${content}</main>
    <nav class="bottom-nav">
      ${nav.map(([screen,key])=>`<button data-action="screen" data-screen="${screen}" class="${state.screen===screen?'active':''}">${esc(t(key))}</button>`).join('')}
    </nav>
  </div>`;
}

function card(tour) {
  const x = localized(tour);
  const price = groupPrice(tour) || privatePrice(tour);
  return `<article class="tour-card" data-action="tour" data-id="${esc(tour.id)}">
    <div class="tour-img">
      <img src="${esc(tour.image || tour.fallbackImage || '')}" alt="${esc(x.title)}">
      <span class="tour-badge">${esc(x.cityLabel)}</span>
    </div>
    <div class="tour-body">
      <div class="tour-title">${esc(x.title)}</div>
      <div class="tour-meta">${esc(x.durationLabel)} · ${tour.childrenOk ? (state.locale==='vi'?'Phù hợp gia đình':'Family friendly') : (state.locale==='vi'?'Người lớn':'Adults')}</div>
      <div class="tour-price"><div><span>${esc(t('from'))}</span><br><b>${esc(moneyLabel(price))}</b></div><button class="btn ghost" data-action="tour" data-id="${esc(tour.id)}">${esc(t('details'))}</button></div>
    </div>
  </article>`;
}

function homeScreen() {
  const featured = [...state.tours].sort((a,b)=>Number(b.popular)-Number(a.popular)).slice(0,6);
  return `<section class="hero">
    <div class="hero-content">
      <div class="eyebrow">${esc(t('heroEyebrow'))}</div>
      <h1>${esc(t('heroTitle'))}</h1>
      <p>${esc(t('heroText'))}</p>
      <div class="hero-actions">
        <button class="btn primary" data-action="screen" data-screen="tours">${esc(t('explore'))}</button>
        <button class="btn secondary" data-action="screen" data-screen="ai">${esc(t('askAi'))}</button>
      </div>
    </div>
  </section>
  <section class="section">
    <div class="section-head"><h2>${esc(t('popular'))}</h2><button data-action="screen" data-screen="tours">${esc(t('allTours'))} →</button></div>
    <div class="tour-grid">${featured.map(card).join('')}</div>
  </section>`;
}

function filteredTours() {
  const q = state.query.trim().toLocaleLowerCase(state.locale==='vi'?'vi-VN':'en-US');
  return state.tours.filter(tour => {
    const x = localized(tour);
    if (state.city && String(tour.city || tour.region) !== state.city) return false;
    if (state.formatFilter === 'group' && !tour.group) return false;
    if (state.formatFilter === 'private' && !tour.individual) return false;
    if (!q) return true;
    const haystack = [x.title,x.cityLabel,x.durationLabel,...x.route.map(r=>r.title),...x.included].join(' ').toLocaleLowerCase(state.locale==='vi'?'vi-VN':'en-US');
    return haystack.includes(q);
  });
}

function toursScreen() {
  const cities = [...new Set(state.tours.map(t=>String(t.city || t.region || '')).filter(Boolean))];
  const items = filteredTours();
  return `<section class="section" style="margin-top:4px">
    <div class="section-head"><h2>${esc(t('allTours'))}</h2><span>${items.length}</span></div>
    <div class="filters">
      <div class="field search"><label>${esc(t('search'))}</label><input class="control" id="searchInput" value="${esc(state.query)}" placeholder="${esc(t('search'))}"></div>
      <div class="field"><label>${esc(t('city'))}</label><select class="control" id="cityFilter"><option value="">${esc(t('allCities'))}</option>${cities.map(c=>`<option value="${esc(c)}" ${state.city===c?'selected':''}>${esc(cityLabel(c))}</option>`).join('')}</select></div>
      <div class="field"><label>${esc(t('format'))}</label><select class="control" id="formatFilter"><option value="">${esc(t('allFormats'))}</option><option value="group" ${state.formatFilter==='group'?'selected':''}>${esc(t('group'))}</option><option value="private" ${state.formatFilter==='private'?'selected':''}>${esc(t('private'))}</option></select></div>
    </div>
    ${items.length ? `<div class="tour-grid">${items.map(card).join('')}</div>` : `<div class="empty">${esc(t('noResults'))}</div>`}
  </section>`;
}

function detailScreen() {
  const tour = state.tours.find(x=>x.id===state.selectedId);
  if (!tour) { state.screen='tours'; return toursScreen(); }
  const x = localized(tour);
  const notes = state.format==='private' ? x.individualNotes : x.groupNotes;
  const price = displayPrice(tour);
  return `<button class="back" data-action="screen" data-screen="tours">← ${esc(t('back'))}</button>
  <section class="detail-hero">
    <img src="${esc(tour.image || tour.fallbackImage || '')}" alt="${esc(x.title)}">
    <div class="detail-overlay"></div>
    <div class="detail-copy"><div class="eyebrow">${esc(x.cityLabel)} · ${esc(x.durationLabel)}</div><h1>${esc(x.title)}</h1><p>${esc(t('from'))} ${esc(moneyLabel(price))}</p></div>
  </section>
  <div class="detail-grid">
    <div>
      <section class="panel">
        <h3>${esc(t('chooseFormat'))}</h3>
        <div class="format-cards">
          <button class="format-card ${state.format==='group'?'active':''}" data-action="format" data-format="group"><b>${esc(t('groupOption'))}</b><span>${esc(t('groupNote'))}</span></button>
          <button class="format-card ${state.format==='private'?'active':''}" data-action="format" data-format="private"><b>${esc(t('privateOption'))}</b><span>${esc(t('privateNote'))}</span></button>
        </div>
        ${notes.length ? `<ul class="checklist" style="margin-top:16px">${notes.map(v=>`<li>${esc(v)}</li>`).join('')}</ul>` : ''}
      </section>
      <section class="panel" style="margin-top:16px"><h3>${esc(t('route'))}</h3><div class="timeline">${x.route.map(r=>`<div class="stop"><span class="dot"></span><div><b>${esc(r.title)}</b>${r.description?`<p>${esc(r.description)}</p>`:''}</div></div>`).join('')}</div></section>
    </div>
    <div>
      <section class="panel"><h3>${esc(t('included'))}</h3><ul class="checklist">${x.included.map(v=>`<li>${esc(v)}</li>`).join('')}</ul></section>
      <section class="panel" style="margin-top:16px"><h3>${esc(t('take'))}</h3><ul class="checklist">${x.take.map(v=>`<li>${esc(v)}</li>`).join('')}</ul></section>
      <button class="btn primary block" style="margin-top:16px" data-action="booking">${esc(t('book'))} · ${esc(moneyLabel(price))}</button>
    </div>
  </div>`;
}

function bookingScreen() {
  const tour = state.tours.find(x=>x.id===state.selectedId);
  if (!tour) { state.screen='tours'; return toursScreen(); }
  const x=localized(tour);
  const base=displayPrice(tour);
  return `<button class="back" data-action="detail">← ${esc(t('back'))}</button>
  <div class="section-head"><h2>${esc(t('bookingTitle'))}</h2></div>
  <form id="bookingForm" class="booking-layout">
    <section class="form-card">
      <div class="form-grid">
        <div class="field"><label>${esc(t('date'))}</label><input class="control" type="date" name="date" required></div>
        <div class="field"><label>${esc(t('format'))}</label><select class="control" name="format"><option value="group" ${state.format==='group'?'selected':''}>${esc(t('groupOption'))}</option><option value="private" ${state.format==='private'?'selected':''}>${esc(t('privateOption'))}</option></select></div>
        <div class="field"><label>${esc(t('adults'))}</label><input class="control" type="number" name="adults" min="1" max="20" value="2" required></div>
        <div class="field"><label>${esc(t('children'))}</label><input class="control" type="number" name="children" min="0" max="12" value="0"></div>
        <div class="field"><label>${esc(t('name'))}</label><input class="control" name="name" autocomplete="name" required></div>
        <div class="field"><label>${esc(t('phone'))}</label><input class="control" name="phone" autocomplete="tel" required></div>
        <div class="field" style="grid-column:1/-1"><label>${esc(t('hotel'))}</label><input class="control" name="hotel"></div>
        <div class="field" style="grid-column:1/-1"><label>${esc(t('payment'))}</label><select class="control" name="payment"><option value="deposit">${esc(t('deposit'))}</option><option value="full">${esc(t('full'))}</option></select></div>
      </div>
      <div class="notice">${esc(t('requestOnly'))}</div>
    </section>
    <aside class="summary-card">
      <h3 style="margin-top:0">${esc(t('summary'))}</h3>
      <div class="summary-row"><span>${esc(x.title)}</span><b>${esc(moneyLabel(base))}</b></div>
      <div class="summary-row"><span>${esc(t('format'))}</span><b>${esc(state.format==='private'?t('privateOption'):t('groupOption'))}</b></div>
      <div class="summary-row"><span>${esc(t('total'))}</span><b id="bookingTotal">${esc(moneyLabel(state.format==='private'?privatePrice(tour):groupPrice(tour)*2))}</b></div>
      <button class="btn primary block" type="submit" style="margin-top:16px">${esc(t('confirm'))}</button>
    </aside>
  </form>`;
}

function tripsScreen() {
  if (!state.bookings.length) return `<section class="section" style="margin-top:4px"><div class="section-head"><h2>${esc(t('trips'))}</h2></div><div class="empty">${esc(t('noTrips'))}</div></section>`;
  return `<section class="section" style="margin-top:4px"><div class="section-head"><h2>${esc(t('trips'))}</h2></div><div class="trip-list">${state.bookings.map(b=>`<article class="trip">
    <img src="${esc(b.image || '')}" alt="">
    <div><h3>${esc(b.title || '')}</h3><p>${esc(b.date || '')} · ${esc(b.type==='private'?t('privateOption'):t('groupOption'))} · ${esc(b.people || '')}</p></div>
    <span class="status">${esc(statusLabel(b.status || 'new'))}</span>
  </article>`).join('')}</div></section>`;
}

function aiScreen() {
  return `<section class="chat">
    <div class="chat-head"><h2>${esc(t('aiTitle'))}</h2><p>${esc(t('aiText'))}</p></div>
    <div class="messages" id="messages">${state.ai.map(m=>`<div class="msg ${m.role==='user'?'user':'bot'}">${esc(m.text)}</div>`).join('')}</div>
    <form class="chat-form" id="aiForm"><input name="message" autocomplete="off" placeholder="${esc(t('aiPlaceholder'))}" required><button class="btn primary" type="submit">${esc(t('send'))}</button></form>
  </section>`;
}

function render() {
  document.documentElement.lang = state.locale;
  document.title = t('brand') + ' · ' + t('demo');
  if (state.loading) { app.innerHTML = shell('<div class="empty">'+esc(t('loading'))+'</div>'); return; }
  if (state.error) { app.innerHTML = shell('<div class="error">'+esc(state.error)+' <button class="btn ghost" data-action="reload">'+esc(t('retry'))+'</button></div>'); return; }
  let body='';
  if (state.screen==='home') body=homeScreen();
  else if (state.screen==='tours') body=toursScreen();
  else if (state.screen==='detail') body=detailScreen();
  else if (state.screen==='booking') body=bookingScreen();
  else if (state.screen==='trips') body=tripsScreen();
  else if (state.screen==='ai') body=aiScreen();
  else body=homeScreen();
  app.innerHTML=shell(body);
  if (state.screen==='ai') requestAnimationFrame(()=>{ const el=document.getElementById('messages'); if(el) el.scrollTop=el.scrollHeight; });
}

async function switchLocale(locale) {
  if (!['vi','en'].includes(locale) || locale===state.locale) return;
  state.locale=locale;
  localStorage.setItem(STORAGE_KEY,locale);
  await loadLocale(locale);
  state.ai=[{role:'bot',text:t('aiWelcome')}];
  render();
}

async function submitBooking(form) {
  const data=new FormData(form);
  const tour=state.tours.find(x=>x.id===state.selectedId);
  if(!tour) return;
  const format=String(data.get('format')||state.format)==='private'?'private':'group';
  const adults=Math.max(1,Number(data.get('adults'))||1);
  const children=Math.max(0,Number(data.get('children'))||0);
  const total=format==='private'?privatePrice(tour):groupPrice(tour)*adults+childPrice(tour)*children;
  const payment=String(data.get('payment')||'deposit');
  const paid=payment==='full'?total:Math.round(total*.3);
  const x=localized(tour);
  const booking={
    id:'WEB-'+Date.now().toString(36).toUpperCase(),
    tourId:tour.id,
    title:x.title,
    locale:state.locale,
    date:String(data.get('date')||''),
    time:'',
    status:'new',
    paid:moneyLabel(paid),
    rest:moneyLabel(Math.max(0,total-paid)),
    total:moneyLabel(total),
    type:format,
    receipt:'',
    people:adults+' '+t('adult')+(children?' + '+children+' '+t('child'):''),
    image:tour.image||tour.fallbackImage||'',
    rules:'demo',
    source:'VIIVERSION Client Demo',
    contact:{name:String(data.get('name')||''),phone:String(data.get('phone')||''),hotel:String(data.get('hotel')||'')}
  };
  const response=await fetch('/api/bookings',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(booking)});
  if(!response.ok) throw new Error('booking');
  state.bookings.unshift(booking);
  state.screen='trips';
  render();
}

async function submitAi(form) {
  const input=form.elements.message;
  const message=String(input.value||'').trim();
  if(!message) return;
  state.ai.push({role:'user',text:message});
  input.value='';
  render();
  try{
    const response=await fetch('/api/ai/chat',{method:'POST',headers:{'content-type':'application/json','x-max-tour-locale':state.locale},body:JSON.stringify({
      locale:state.locale,
      message,
      history:state.ai.slice(-8).map(m=>({role:m.role==='user'?'user':'assistant',text:m.text})),
      context:{locale:state.locale}
    })});
    const data=await response.json();
    state.ai.push({role:'bot',text:data.reply||t('aiWelcome')});
  }catch(_){
    state.ai.push({role:'bot',text:state.locale==='vi'?'Tôi chưa thể trả lời ngay. Hãy thử lại.':'I cannot answer right now. Please try again.'});
  }
  render();
}

document.addEventListener('click',async event=>{
  const el=event.target.closest('[data-action]');
  if(!el) return;
  const action=el.dataset.action;
  if(action==='locale'){ await switchLocale(el.dataset.locale); return; }
  if(action==='screen'){ state.screen=el.dataset.screen; render(); return; }
  if(action==='tour'){ state.selectedId=el.dataset.id; state.format='group'; state.screen='detail'; render(); return; }
  if(action==='format'){ state.format=el.dataset.format==='private'?'private':'group'; render(); return; }
  if(action==='booking'){ state.screen='booking'; render(); return; }
  if(action==='detail'){ state.screen='detail'; render(); return; }
  if(action==='reload'){ location.reload(); }
});

document.addEventListener('input',event=>{
  if(event.target.id==='searchInput'){ state.query=event.target.value; const pos=event.target.selectionStart; render(); const next=document.getElementById('searchInput'); if(next){next.focus();try{next.setSelectionRange(pos,pos)}catch(_){}} }
  if(event.target.closest('#bookingForm') && ['adults','children','format'].includes(event.target.name)){
    const form=event.target.closest('#bookingForm'); const tour=state.tours.find(x=>x.id===state.selectedId); if(!tour)return;
    const adults=Math.max(1,Number(form.elements.adults.value)||1), children=Math.max(0,Number(form.elements.children.value)||0), format=form.elements.format.value;
    state.format=format==='private'?'private':'group';
    const total=state.format==='private'?privatePrice(tour):groupPrice(tour)*adults+childPrice(tour)*children;
    const out=document.getElementById('bookingTotal'); if(out)out.textContent=moneyLabel(total);
  }
});
document.addEventListener('change',event=>{
  if(event.target.id==='cityFilter'){state.city=event.target.value;render();}
  if(event.target.id==='formatFilter'){state.formatFilter=event.target.value;render();}
});
document.addEventListener('submit',async event=>{
  if(event.target.id==='bookingForm'){event.preventDefault();try{await submitBooking(event.target)}catch(_){alert(state.locale==='vi'?'Không thể lưu yêu cầu. Vui lòng thử lại.':'Could not save the booking. Please try again.');}}
  if(event.target.id==='aiForm'){event.preventDefault();await submitAi(event.target);}
});

init();
