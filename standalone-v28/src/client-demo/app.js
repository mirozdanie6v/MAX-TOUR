import { UI, CITY, DURATION, STATUS } from './client-ui-locales.js';

const STORAGE_KEY = 'viiversion-travel-demo-locale';
const TZ_OFFSET = '+07:00';
const state = {
  locale: localStorage.getItem(STORAGE_KEY) === 'en' ? 'en' : 'vi',
  screen: 'home',
  tripTab: 'booked',
  tours: [],
  localeTours: {},
  selectedId: null,
  selectedDeparture: null,
  format: 'group',
  query: '',
  city: '',
  formatFilter: '',
  bookings: [],
  favorites: new Set(),
  travelers: [],
  groupDepartures: [],
  ai: [],
  bookingDraft: null,
  modal: null,
  loading: true,
  error: ''
};

const app = document.getElementById('app');
const t = key => UI[state.locale][key] || key;
const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const cityLabel = value => CITY[state.locale][String(value || '')] || String(value || '');
const durationLabel = value => DURATION[state.locale][String(value || '')] || String(value || '');
const money = value => {
  const match = String(value ?? '').match(/\$\s*([\d,.]+)/);
  if (match) return Number(match[1].replace(/,/g, '')) || 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};
const moneyLabel = value => '$' + Math.max(0, Math.round(Number(value) || 0)).toLocaleString('en-US');
const localeTag = () => state.locale === 'vi' ? 'vi-VN' : 'en-US';
const todayIso = () => new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const dateLabel = value => {
  const raw=String(value||'');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  return new Intl.DateTimeFormat(localeTag(),{timeZone:'UTC',day:'numeric',month:'short',year:'numeric'}).format(new Date(raw+'T00:00:00Z'));
};
const roleLabel = role => role === 'child' ? (state.locale==='vi'?'Trẻ em':'Child') : role === 'infant' ? t('infant') : (state.locale==='vi'?'Người lớn':'Adult');
const statusLabel = value => {
  const raw=String(value||'').toLowerCase();
  const map={
    new:t('new'),booked:t('booked'),paid:t('paidInFull'),cancelled:t('cancelled'),
    rescheduled:t('rescheduled'),'đã đặt':t('booked')
  };
  return map[raw] || STATUS[state.locale][String(value||'')] || String(value||'');
};
const request = async (path, options={}) => {
  const response=await fetch(path,{
    credentials:'same-origin',
    ...options,
    headers:{'content-type':'application/json',...(options.headers||{})}
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok) throw new Error(data.error || 'HTTP '+response.status);
  return data;
};

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

function firstMoney(value) {
  return money(value);
}
function parseTier(value) {
  const source=String(value||'');
  const price=firstMoney(source);
  if(!price) return null;
  const range=source.match(/(\d+)\s*[–-]\s*(\d+)/);
  if(range) return {min:Number(range[1]),max:Number(range[2]),price};
  const one=source.match(/(^|\s)(\d+)(?=\s)/);
  return one ? {min:Number(one[2]),max:Number(one[2]),price} : {min:1,max:99,price};
}
function groupPrices(tour) {
  return {
    adult:firstMoney(tour.group?.adult || tour.group?.from || tour.priceFromUsd),
    child:firstMoney(tour.group?.child),
    infant:/free|0\s*\$/i.test(String(tour.group?.infant||'')) ? 0 : firstMoney(tour.group?.infant)
  };
}
function groupTotal(tour, adults, children, infants) {
  const p=groupPrices(tour);
  const child=p.child || Math.round(p.adult*.7);
  return Math.max(0,adults*p.adult + children*child + infants*p.infant);
}
function privateTotal(tour, adults, children, infants) {
  const people=Math.max(1,adults+children+infants);
  const tiers=(tour.individual?.tiers||[]).map(parseTier).filter(Boolean);
  if(!tiers.length) return firstMoney(tour.individual?.from) || firstMoney(tour.priceFromUsd);
  let tier=tiers.find(x=>people>=x.min&&people<=x.max);
  if(!tier) tier=tiers.filter(x=>people<=x.max).sort((a,b)=>a.max-b.max)[0] || tiers[tiers.length-1];
  return tier.price;
}
function totalFor(tour, draft=state.bookingDraft) {
  const adults=Math.max(1,Number(draft?.adults)||1);
  const children=Math.max(0,Number(draft?.children)||0);
  const infants=Math.max(0,Number(draft?.infants)||0);
  return (draft?.format||state.format)==='private'
    ? privateTotal(tour,adults,children,infants)
    : groupTotal(tour,adults,children,infants);
}
function displayPrice(tour) {
  const p=groupPrices(tour).adult;
  return p || firstMoney(tour.individual?.from) || firstMoney(tour.priceFromUsd);
}

function normalizeTraveler(item,index=0) {
  return {
    role:['adult','child','infant'].includes(item?.role) ? item.role : 'adult',
    label:String(item?.label||''),
    fullName:String(item?.fullName||'').trim(),
    birthDate:String(item?.birthDate||'').trim(),
    primary:Boolean(item?.primary ?? index===0)
  };
}
function normalizeTravelers(list) {
  const clean=[]; const seen=new Set();
  (Array.isArray(list)?list:[]).forEach((item,index)=>{
    const tr=normalizeTraveler(item,index);
    if(!tr.fullName||!tr.birthDate) return;
    const key=(tr.fullName+'|'+tr.birthDate).toLowerCase();
    if(seen.has(key)) return;
    seen.add(key); clean.push(tr);
  });
  let primary=clean.findIndex(x=>x.primary&&x.role==='adult');
  if(primary<0) primary=clean.findIndex(x=>x.role==='adult');
  clean.forEach((x,i)=>x.primary=i===primary);
  return clean;
}

function normalizeDeparture(raw,tourId) {
  const iso=String(raw?.iso || raw?.date || '');
  const capacity=Math.max(1,Number(raw?.capacity)||1);
  const taken=Math.max(0,Number(raw?.taken)||0);
  const rawStatus=String(raw?.status||'open').toLowerCase();
  const full=taken>=capacity || rawStatus==='full' || rawStatus.includes('wait');
  const status=full?'full':rawStatus.includes('almost')?'almost_full':rawStatus.includes('cancel')?'cancelled':'open';
  return {
    id:String(raw?.id || [tourId,iso,raw?.time||''].join('-')),
    tourId:String(raw?.tourId || tourId || ''),
    date:/^\d{4}-\d{2}-\d{2}$/.test(iso)?iso:'',
    dateLabel:String(raw?.dateLabel || raw?.date || iso),
    time:String(raw?.time || ''),
    capacity,taken,status,notes:String(raw?.notes||'')
  };
}
function departuresFor(tour) {
  const combined=[
    ...((tour.group?.departures||[]).map(x=>normalizeDeparture(x,tour.id))),
    ...(state.groupDepartures.filter(x=>String(x.tourId)===String(tour.id)).map(x=>normalizeDeparture(x,tour.id)))
  ];
  const unique=new Map();
  combined.forEach(x=>unique.set(x.id,x));
  return [...unique.values()]
    .filter(x=>x.status!=='cancelled' && x.date && x.date>=todayIso())
    .sort((a,b)=>a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
}
function departureStatusText(dep) {
  if(dep.status==='full') return t('waitlist');
  if(dep.status==='almost_full') return t('almostFull');
  return t('openDeparture');
}

async function loadLocale(locale) {
  const response = await fetch('/client-locales/' + locale + '-tours.json', {cache:'no-store'});
  if (!response.ok) throw new Error('locale');
  state.localeTours = await response.json();
}
async function loadBootstrap() {
  try {
    const data=await request('/api/bootstrap',{cache:'no-store'});
    state.bookings=Array.isArray(data.bookings)?data.bookings:[];
    state.favorites=new Set(Array.isArray(data.favorites)?data.favorites:[]);
    state.travelers=normalizeTravelers(data.travelers);
    state.groupDepartures=Array.isArray(data.groupDepartures)?data.groupDepartures:[];
  } catch (_) {}
}
async function init() {
  state.loading=true; render();
  try {
    const [catalog]=await Promise.all([
      fetch('/catalog.v28.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('catalog');return r.json();}),
      loadLocale(state.locale),
      loadBootstrap()
    ]);
    state.tours=Array.isArray(catalog)?catalog:[];
    state.ai=[{role:'bot',text:t('aiWelcome')}];
    state.loading=false;
  } catch(error) {
    state.error=String(error?.message||error); state.loading=false;
  }
  render();
}

function shell(content) {
  const nav=[['home','navHome'],['tours','navTours'],['trips','navTrips'],['ai','navAi']];
  return `<div class="shell">
    <header class="topbar">
      <div class="brand"><div class="brand-mark">V</div><div class="brand-copy"><b>${esc(t('brand'))}</b><small>${esc(t('demo'))}</small></div></div>
      <div class="lang" aria-label="${esc(t('language'))}">
        <button data-action="locale" data-locale="vi" class="${state.locale==='vi'?'active':''}">VI</button>
        <button data-action="locale" data-locale="en" class="${state.locale==='en'?'active':''}">EN</button>
      </div>
    </header>
    <main>${content}</main>
    <nav class="bottom-nav">${nav.map(([screen,key])=>`<button data-action="screen" data-screen="${screen}" class="${state.screen===screen?'active':''}">${esc(t(key))}</button>`).join('')}</nav>
    ${modalHtml()}
  </div>`;
}
function heartButton(tourId,large=false) {
  const active=state.favorites.has(String(tourId));
  return `<button type="button" class="heart ${active?'active':''} ${large?'large':''}" data-action="favorite" data-id="${esc(tourId)}" aria-label="${esc(active?t('favoriteRemove'):t('favoriteAdd'))}">${active?'♥':'♡'}</button>`;
}
function card(tour) {
  const x=localized(tour),price=displayPrice(tour);
  return `<article class="tour-card" data-action="tour" data-id="${esc(tour.id)}">
    <div class="tour-img"><img src="${esc(tour.image||tour.fallbackImage||'')}" alt="${esc(x.title)}"><span class="tour-badge">${esc(x.cityLabel)}</span>${heartButton(tour.id)}</div>
    <div class="tour-body"><div class="tour-title">${esc(x.title)}</div><div class="tour-meta">${esc(x.durationLabel)} · ${tour.childrenOk?(state.locale==='vi'?'Phù hợp gia đình':'Family friendly'):(state.locale==='vi'?'Người lớn':'Adults')}</div>
    <div class="tour-price"><div><span>${esc(t('from'))}</span><br><b>${esc(moneyLabel(price))}</b></div><button class="btn ghost" data-action="tour" data-id="${esc(tour.id)}">${esc(t('details'))}</button></div></div>
  </article>`;
}

function homeScreen() {
  const featured=[...state.tours].sort((a,b)=>Number(b.popular)-Number(a.popular)).slice(0,6);
  return `<section class="hero" style="--hero-image:url('${esc(state.tours[0]?.image||state.tours[0]?.fallbackImage||'')}')"><div class="hero-content">
    <div class="eyebrow">${esc(t('heroEyebrow'))}</div><h1>${esc(t('heroTitle'))}</h1><p>${esc(t('heroText'))}</p>
    <div class="hero-actions"><button class="btn primary" data-action="screen" data-screen="tours">${esc(t('explore'))}</button><button class="btn secondary" data-action="screen" data-screen="ai">${esc(t('askAi'))}</button></div>
  </div></section>
  <section class="section"><div class="section-head"><h2>${esc(t('popular'))}</h2><button data-action="screen" data-screen="tours">${esc(t('allTours'))} →</button></div><div class="tour-grid">${featured.map(card).join('')}</div></section>`;
}
function filteredTours() {
  const q=state.query.trim().toLocaleLowerCase(localeTag());
  return state.tours.filter(tour=>{
    const x=localized(tour);
    if(state.city&&String(tour.city||tour.region)!==state.city) return false;
    if(state.formatFilter==='group'&&!tour.group) return false;
    if(state.formatFilter==='private'&&!tour.individual) return false;
    if(!q) return true;
    return [x.title,x.cityLabel,x.durationLabel,...x.route.map(r=>r.title),...x.included].join(' ').toLocaleLowerCase(localeTag()).includes(q);
  });
}
function toursScreen() {
  const cities=[...new Set(state.tours.map(t=>String(t.city||t.region||'')).filter(Boolean))],items=filteredTours();
  return `<section class="section" style="margin-top:4px"><div class="section-head"><h2>${esc(t('allTours'))}</h2><span>${items.length}</span></div>
    <div class="filters"><div class="field search"><label>${esc(t('search'))}</label><input class="control" id="searchInput" value="${esc(state.query)}" placeholder="${esc(t('search'))}"></div>
    <div class="field"><label>${esc(t('city'))}</label><select class="control" id="cityFilter"><option value="">${esc(t('allCities'))}</option>${cities.map(c=>`<option value="${esc(c)}" ${state.city===c?'selected':''}>${esc(cityLabel(c))}</option>`).join('')}</select></div>
    <div class="field"><label>${esc(t('format'))}</label><select class="control" id="formatFilter"><option value="">${esc(t('allFormats'))}</option><option value="group" ${state.formatFilter==='group'?'selected':''}>${esc(t('group'))}</option><option value="private" ${state.formatFilter==='private'?'selected':''}>${esc(t('private'))}</option></select></div></div>
    ${items.length?`<div class="tour-grid">${items.map(card).join('')}</div>`:`<div class="empty">${esc(t('noResults'))}</div>`}
  </section>`;
}

function departureHtml(dep) {
  const left=Math.max(0,dep.capacity-dep.taken),full=dep.status==='full';
  return `<button class="departure-card ${state.selectedDeparture?.id===dep.id?'active':''} ${full?'disabled':''}" data-action="select-departure" data-id="${esc(dep.id)}" ${full?'disabled':''}>
    <div><b>${esc(dep.date?dateLabel(dep.date):dep.dateLabel)}</b><span>${esc(dep.time||'')}</span></div>
    <div><span class="departure-status ${dep.status}">${esc(departureStatusText(dep))}</span><small>${esc(String(left))} ${esc(t('seatsLeft'))}</small></div>
  </button>`;
}
function detailScreen() {
  const tour=state.tours.find(x=>x.id===state.selectedId);
  if(!tour){state.screen='tours';return toursScreen();}
  const x=localized(tour),notes=state.format==='private'?x.individualNotes:x.groupNotes;
  const draft={format:state.format,adults:1,children:0,infants:0};
  const price=totalFor(tour,draft);
  const deps=state.format==='group'?departuresFor(tour):[];
  return `<button class="back" data-action="screen" data-screen="tours">← ${esc(t('back'))}</button>
  <section class="detail-hero"><img src="${esc(tour.image||tour.fallbackImage||'')}" alt="${esc(x.title)}"><div class="detail-overlay"></div>
    <div class="detail-copy"><div class="eyebrow">${esc(x.cityLabel)} · ${esc(x.durationLabel)}</div><h1>${esc(x.title)}</h1><p>${esc(t('from'))} ${esc(moneyLabel(price))}</p>${heartButton(tour.id,true)}</div>
  </section>
  <div class="detail-grid"><div>
    <section class="panel"><h3>${esc(t('chooseFormat'))}</h3><div class="format-cards">
      <button class="format-card ${state.format==='group'?'active':''}" data-action="format" data-format="group"><b>${esc(t('groupOption'))}</b><span>${esc(t('groupNote'))}</span></button>
      <button class="format-card ${state.format==='private'?'active':''}" data-action="format" data-format="private"><b>${esc(t('privateOption'))}</b><span>${esc(t('privateNote'))}</span></button>
    </div>${notes.length?`<ul class="checklist" style="margin-top:16px">${notes.map(v=>`<li>${esc(v)}</li>`).join('')}</ul>`:''}</section>
    ${state.format==='group'?`<section class="panel" style="margin-top:16px"><h3>${esc(t('departures'))}</h3>${deps.length?`<div class="departure-list">${deps.map(departureHtml).join('')}</div>`:`<div class="notice neutral">${esc(t('noScheduledDepartures'))}</div>`}</section>`:''}
    <section class="panel" style="margin-top:16px"><h3>${esc(t('route'))}</h3><div class="timeline">${x.route.map(r=>`<div class="stop"><span class="dot"></span><div><b>${esc(r.title)}</b>${r.description?`<p>${esc(r.description)}</p>`:''}</div></div>`).join('')}</div></section>
  </div><div><section class="panel"><h3>${esc(t('included'))}</h3><ul class="checklist">${x.included.map(v=>`<li>${esc(v)}</li>`).join('')}</ul></section>
    <section class="panel" style="margin-top:16px"><h3>${esc(t('take'))}</h3><ul class="checklist">${x.take.map(v=>`<li>${esc(v)}</li>`).join('')}</ul></section>
    <button class="btn primary block" style="margin-top:16px" data-action="booking">${esc(t('book'))} · ${esc(moneyLabel(price))}</button>
  </div></div>`;
}

function ensureTravelerSlots() {
  const d=state.bookingDraft;
  if(!d) return;
  const roles=['adult',...Array(Math.max(0,d.adults-1)).fill('adult'),...Array(d.children).fill('child'),...Array(d.infants).fill('infant')];
  d.travelers=roles.map((role,index)=>{
    const existing=d.travelers?.[index];
    return existing&&existing.role===role?existing:{role,fullName:'',birthDate:'',primary:index===0};
  });
}
function startBookingDraft() {
  const dep=state.selectedDeparture;
  state.bookingDraft={
    format:state.format, date:dep?.date||'', time:dep?.time||'',
    adults:2,children:0,infants:0,phone:'',hotel:'',payment:'deposit',travelers:[]
  };
  ensureTravelerSlots();
}
function savedOptions(role,slotIndex) {
  const used=new Set((state.bookingDraft?.travelers||[]).map((x,i)=>i===slotIndex?'':(x.fullName+'|'+x.birthDate).toLowerCase()).filter(Boolean));
  return state.travelers.filter(x=>x.role===role&&!used.has((x.fullName+'|'+x.birthDate).toLowerCase()));
}
function travelerSlotHtml(tr,index) {
  const options=savedOptions(tr.role,index);
  return `<div class="traveler-slot ${tr.primary?'primary':''}">
    <div class="traveler-slot-head"><b>${esc(tr.primary?t('leadTraveler'):roleLabel(tr.role))}</b><span>${esc(roleLabel(tr.role))}</span></div>
    ${options.length?`<div class="field"><label>${esc(t('chooseSaved'))}</label><select class="control saved-traveler" data-slot="${index}"><option value="">—</option>${options.map((x,i)=>`<option value="${esc(x.fullName+'|'+x.birthDate)}">${esc(x.fullName)} · ${esc(dateLabel(x.birthDate))}</option>`).join('')}</select></div>`:''}
    <div class="form-grid"><div class="field"><label>${esc(t('name'))}</label><input class="control traveler-name" data-slot="${index}" value="${esc(tr.fullName)}" required></div>
    <div class="field"><label>${esc(t('birthDate'))}</label><input class="control traveler-birth" data-slot="${index}" type="date" value="${esc(tr.birthDate)}" required></div></div>
  </div>`;
}
function bookingScreen() {
  const tour=state.tours.find(x=>x.id===state.selectedId);
  if(!tour){state.screen='tours';return toursScreen();}
  if(!state.bookingDraft) startBookingDraft();
  ensureTravelerSlots();
  const d=state.bookingDraft,x=localized(tour),total=totalFor(tour,d);
  return `<button class="back" data-action="detail">← ${esc(t('back'))}</button><div class="section-head"><h2>${esc(t('bookingTitle'))}</h2></div>
  <form id="bookingForm" class="booking-layout"><section class="form-card"><div class="form-grid">
    <div class="field"><label>${esc(t('date'))}</label><input class="control booking-field" data-field="date" type="date" min="${todayIso()}" value="${esc(d.date)}" required></div>
    <div class="field"><label>${esc(t('format'))}</label><select class="control booking-field" data-field="format"><option value="group" ${d.format==='group'?'selected':''}>${esc(t('groupOption'))}</option><option value="private" ${d.format==='private'?'selected':''}>${esc(t('privateOption'))}</option></select></div>
    <div class="field"><label>${esc(t('adults'))}</label><input class="control booking-count" data-field="adults" type="number" min="1" max="20" value="${d.adults}"></div>
    <div class="field"><label>${esc(t('children'))}</label><input class="control booking-count" data-field="children" type="number" min="0" max="12" value="${d.children}"></div>
    <div class="field"><label>${esc(t('infants'))}</label><input class="control booking-count" data-field="infants" type="number" min="0" max="8" value="${d.infants}"></div>
    <div class="field"><label>${esc(t('phone'))}</label><input class="control booking-field" data-field="phone" autocomplete="tel" value="${esc(d.phone)}" required></div>
    <div class="field" style="grid-column:1/-1"><label>${esc(t('hotel'))}</label><input class="control booking-field" data-field="hotel" value="${esc(d.hotel)}"></div>
    <div class="field" style="grid-column:1/-1"><label>${esc(t('payment'))}</label><select class="control booking-field" data-field="payment"><option value="deposit" ${d.payment==='deposit'?'selected':''}>${esc(t('deposit'))}</option><option value="full" ${d.payment==='full'?'selected':''}>${esc(t('full'))}</option></select></div>
  </div><div class="traveler-stack">${d.travelers.map(travelerSlotHtml).join('')}</div><div class="notice">${esc(t('requestOnly'))}</div></section>
  <aside class="summary-card"><h3 style="margin-top:0">${esc(t('summary'))}</h3>
    <div class="summary-row"><span>${esc(x.title)}</span><b>${esc(moneyLabel(total))}</b></div>
    <div class="summary-row"><span>${esc(t('format'))}</span><b>${esc(d.format==='private'?t('privateOption'):t('groupOption'))}</b></div>
    ${state.selectedDeparture&&d.format==='group'?`<div class="summary-row"><span>${esc(t('selectedDeparture'))}</span><b>${esc(dateLabel(state.selectedDeparture.date))} ${esc(state.selectedDeparture.time)}</b></div>`:''}
    <div class="summary-row"><span>${esc(t('total'))}</span><b>${esc(moneyLabel(total))}</b></div>
    <button class="btn primary block" type="submit" style="margin-top:16px">${esc(t('confirm'))}</button>
  </aside></form>`;
}

function tripStatusClass(trip) {
  const s=String(trip.status||'').toLowerCase();
  return s==='cancelled'?'cancelled':s==='paid'?'paid':'';
}
function tripCard(trip) {
  const rest=money(trip.rest),cancelled=String(trip.status||'').toLowerCase()==='cancelled';
  return `<article class="trip full-trip ${tripStatusClass(trip)}">
    <img src="${esc(trip.image||'')}" alt=""><div><h3>${esc(trip.title||'')}</h3>
      <p>${esc(dateLabel(trip.date))}${trip.time?' · '+esc(trip.time):''} · ${esc(trip.type==='private'?t('privateOption'):t('groupOption'))}</p>
      <div class="trip-money"><span>${esc(t('paid'))}: <b>${esc(trip.paid||'$0')}</b></span><span>${esc(t('remaining'))}: <b>${esc(trip.rest||'$0')}</b></span><span>${esc(t('total'))}: <b>${esc(trip.total||'$0')}</b></span></div>
    </div><span class="status">${esc(statusLabel(trip.status||'booked'))}</span>
    ${cancelled?'':`<div class="trip-actions">${rest>0?`<button class="btn primary mini" data-action="pay-balance" data-id="${esc(trip.id)}">${esc(t('payBalance'))}</button>`:''}<button class="btn ghost mini" data-action="reschedule-trip" data-id="${esc(trip.id)}">${esc(t('reschedule'))}</button><button class="btn danger mini" data-action="cancel-trip" data-id="${esc(trip.id)}">${esc(t('cancelTrip'))}</button></div>`}
  </article>`;
}
function profileScreen() {
  return `<div class="profile-intro"><div><h3>${esc(t('profile'))}</h3><p>${esc(t('profileHint'))}</p></div><button class="btn primary" data-action="add-traveler">${esc(t('addTraveler'))}</button></div>
  ${state.travelers.length?`<div class="profile-list">${state.travelers.map((tr,i)=>`<article class="profile-person ${tr.primary?'primary':''}"><div><span>${esc(tr.primary?t('primaryTraveler'):roleLabel(tr.role))}</span><h3>${esc(tr.fullName)}</h3><p>${esc(dateLabel(tr.birthDate))} · ${esc(roleLabel(tr.role))}</p></div><div class="profile-actions"><button class="btn ghost mini" data-action="edit-traveler" data-index="${i}">${esc(t('edit'))}</button>${tr.primary?'':`<button class="btn danger mini" data-action="delete-traveler" data-index="${i}">${esc(t('delete'))}</button>`}</div></article>`).join('')}</div>`:`<div class="empty">${esc(t('noTravelers'))}</div>`}`;
}
function tripsScreen() {
  const tabs=[['booked','bookedTab'],['favorites','favoritesTab'],['profile','profileTab']];
  let body='';
  if(state.tripTab==='booked') body=state.bookings.length?`<div class="trip-list">${state.bookings.map(tripCard).join('')}</div>`:`<div class="empty">${esc(t('noTrips'))}</div>`;
  if(state.tripTab==='favorites') {
    const favTours=state.tours.filter(x=>state.favorites.has(String(x.id)));
    body=favTours.length?`<div class="tour-grid">${favTours.map(card).join('')}</div>`:`<div class="empty">${esc(t('noFavorites'))}</div>`;
  }
  if(state.tripTab==='profile') body=profileScreen();
  return `<section class="section" style="margin-top:4px"><div class="section-head"><h2>${esc(t('trips'))}</h2></div><div class="trip-tabs">${tabs.map(([id,key])=>`<button data-action="trip-tab" data-tab="${id}" class="${state.tripTab===id?'active':''}">${esc(t(key))}</button>`).join('')}</div>${body}</section>`;
}

function aiScreen() {
  return `<section class="chat"><div class="chat-head"><h2>${esc(t('aiTitle'))}</h2><p>${esc(t('aiText'))}</p></div>
    <div class="messages" id="messages">${state.ai.map(m=>`<div class="msg ${m.role==='user'?'user':'bot'}">${esc(m.text)}</div>`).join('')}</div>
    <form class="chat-form" id="aiForm"><input name="message" autocomplete="off" placeholder="${esc(t('aiPlaceholder'))}" required><button class="btn primary" type="submit">${esc(t('send'))}</button></form>
  </section>`;
}

function policyFor(trip,kind) {
  const date=String(trip.date||'');
  const time=(String(trip.time||'').match(/\d{1,2}:\d{2}/)||['05:30'])[0];
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)) return {rate:0,total:money(trip.total),paid:money(trip.paid),refund:money(trip.paid)};
  const departure=new Date(date+'T'+time+':00'+TZ_OFFSET);
  const now=new Date();
  const total=money(trip.total),paid=money(trip.paid);
  const cancelFree=new Date(departure.getTime()-48*3600000);
  const prev=new Date(departure.getTime()-24*3600000);
  const dayBefore17=new Date(prev.toISOString().slice(0,10)+'T17:00:00'+TZ_OFFSET);
  const rate=kind==='cancel' ? (now<cancelFree?0:now<dayBefore17?0.3:1) : (now<dayBefore17?0:0.3);
  const retained=Math.round(total*rate);
  return {rate,total,paid,retained,refund:Math.max(0,paid-retained),fee:retained};
}
function modalHtml() {
  const m=state.modal;
  if(!m) return '';
  if(m.type==='message') return `<div class="modal-backdrop" data-action="close-modal"><div class="modal-card" data-modal-card><button class="modal-x" data-action="close-modal">×</button><h3>${esc(m.title)}</h3><p>${esc(m.text)}</p><button class="btn primary block" data-action="close-modal">${esc(t('close'))}</button></div></div>`;
  if(m.type==='traveler') {
    const tr=m.traveler||{role:'adult',fullName:'',birthDate:'',primary:false};
    return `<div class="modal-backdrop" data-action="close-modal"><form class="modal-card" id="travelerForm" data-modal-card><button type="button" class="modal-x" data-action="close-modal">×</button><h3>${esc(m.index==null?t('addTraveler'):t('edit'))}</h3>
      <div class="field"><label>${esc(t('role'))}</label><select class="control" name="role"><option value="adult" ${tr.role==='adult'?'selected':''}>${esc(roleLabel('adult'))}</option><option value="child" ${tr.role==='child'?'selected':''}>${esc(roleLabel('child'))}</option><option value="infant" ${tr.role==='infant'?'selected':''}>${esc(roleLabel('infant'))}</option></select></div>
      <div class="field"><label>${esc(t('name'))}</label><input class="control" name="name" value="${esc(tr.fullName)}" required></div>
      <div class="field"><label>${esc(t('birthDate'))}</label><input class="control" type="date" name="birth" value="${esc(tr.birthDate)}" required></div>
      <button class="btn primary block" type="submit">${esc(t('save'))}</button></form></div>`;
  }
  if(m.type==='cancel') {
    const p=policyFor(m.trip,'cancel'),label=p.rate===0?t('freeCancellation'):p.rate===.3?t('retention30'):t('retention100');
    return `<div class="modal-backdrop" data-action="close-modal"><div class="modal-card" data-modal-card><button class="modal-x" data-action="close-modal">×</button><h3>${esc(t('cancellationPolicy'))}</h3>
      <div class="policy-box"><div><span>${esc(t('total'))}</span><b>${esc(moneyLabel(p.total))}</b></div><div><span>${esc(t('retained'))}</span><b>${esc(label)} · ${esc(moneyLabel(p.retained))}</b></div><div><span>${esc(t('refund'))}</span><b>${esc(moneyLabel(p.refund))}</b></div></div>
      <button class="btn danger block" data-action="confirm-cancel" data-id="${esc(m.trip.id)}">${esc(t('confirmCancel'))}</button></div></div>`;
  }
  if(m.type==='reschedule') {
    const p=policyFor(m.trip,'reschedule'),label=p.rate===0?t('freeReschedule'):t('rescheduleFee30');
    return `<div class="modal-backdrop" data-action="close-modal"><form class="modal-card" id="rescheduleForm" data-modal-card data-id="${esc(m.trip.id)}"><button type="button" class="modal-x" data-action="close-modal">×</button><h3>${esc(t('reschedulePolicy'))}</h3>
      <div class="policy-box"><div><span>${esc(t('reschedule'))}</span><b>${esc(label)}</b></div><div><span>${esc(t('retained'))}</span><b>${esc(moneyLabel(p.fee))}</b></div></div>
      <div class="field"><label>${esc(t('newDate'))}</label><input class="control" type="date" name="date" min="${todayIso()}" required></div><button class="btn primary block" type="submit">${esc(t('confirmReschedule'))}</button></form></div>`;
  }
  return '';
}

function render() {
  document.documentElement.lang=state.locale;
  document.title=t('brand')+' · '+t('demo');
  if(state.loading){app.innerHTML=shell('<div class="empty">'+esc(t('loading'))+'</div>');return;}
  if(state.error){app.innerHTML=shell('<div class="error">'+esc(state.error)+' <button class="btn ghost" data-action="reload">'+esc(t('retry'))+'</button></div>');return;}
  let body='';
  if(state.screen==='home')body=homeScreen();
  else if(state.screen==='tours')body=toursScreen();
  else if(state.screen==='detail')body=detailScreen();
  else if(state.screen==='booking')body=bookingScreen();
  else if(state.screen==='trips')body=tripsScreen();
  else if(state.screen==='ai')body=aiScreen();
  else body=homeScreen();
  app.innerHTML=shell(body);
  if(state.screen==='ai')requestAnimationFrame(()=>{const el=document.getElementById('messages');if(el)el.scrollTop=el.scrollHeight;});
}

async function switchLocale(locale) {
  if(!['vi','en'].includes(locale)||locale===state.locale)return;
  state.locale=locale;localStorage.setItem(STORAGE_KEY,locale);await loadLocale(locale);
  state.ai=[{role:'bot',text:t('aiWelcome')}];render();
}
async function persistFavorites() {
  await request('/api/favorites',{method:'PUT',body:JSON.stringify({favorites:[...state.favorites]})});
}
async function toggleFavorite(id) {
  const key=String(id);
  if(state.favorites.has(key))state.favorites.delete(key);else state.favorites.add(key);
  render();
  try{await persistFavorites();}catch(_){}
}
async function persistTravelers() {
  const data=await request('/api/travelers',{method:'PUT',body:JSON.stringify({travelers:state.travelers})});
  if(Array.isArray(data.travelers))state.travelers=normalizeTravelers(data.travelers);
}
function mergeBookingTravelers(list) {
  const merged=[...state.travelers];
  list.forEach((tr,index)=>{
    const key=(tr.fullName+'|'+tr.birthDate).toLowerCase();
    const found=merged.findIndex(x=>(x.fullName+'|'+x.birthDate).toLowerCase()===key);
    const next={...tr,primary:index===0};
    if(found>=0)merged[found]={...merged[found],...next};else merged.push(next);
  });
  state.travelers=normalizeTravelers(merged);
}

async function submitBooking(form) {
  const tour=state.tours.find(x=>x.id===state.selectedId),d=state.bookingDraft;
  if(!tour||!d)return;
  ensureTravelerSlots();
  if(d.travelers.some(x=>!x.fullName||!x.birthDate))throw new Error('travelers');
  const total=totalFor(tour,d),paid=d.payment==='full'?total:Math.round(total*.3),x=localized(tour);
  const booking={
    id:'WEB-'+Date.now().toString(36).toUpperCase(),tourId:tour.id,title:x.title,locale:state.locale,
    date:d.date,time:d.time||'',status:d.payment==='full'?'paid':'booked',
    paid:moneyLabel(paid),rest:moneyLabel(Math.max(0,total-paid)),total:moneyLabel(total),
    type:d.format,receipt:'',people:(d.adults+d.children+d.infants)+' '+t('people'),
    image:tour.image||tour.fallbackImage||'',rules:'live-policy',source:'VIIVERSION Client Demo',
    travelers:d.travelers,contact:{phone:d.phone,hotel:d.hotel},
    departureId:state.selectedDeparture?.id||null,paymentMode:d.payment
  };
  await request('/api/bookings',{method:'POST',body:JSON.stringify(booking)});
  mergeBookingTravelers(d.travelers);
  try{await persistTravelers();}catch(_){}
  state.bookings.unshift(booking);state.bookingDraft=null;state.selectedDeparture=null;state.tripTab='booked';state.screen='trips';render();
}
async function patchTrip(id,patch) {
  const data=await request('/api/bookings/'+encodeURIComponent(id),{method:'PATCH',body:JSON.stringify(patch)});
  const i=state.bookings.findIndex(x=>String(x.id)===String(id));
  if(i>=0)state.bookings[i]=data.booking||{...state.bookings[i],...patch};
  render();
}
async function submitAi(form) {
  const input=form.elements.message,message=String(input.value||'').trim();if(!message)return;
  state.ai.push({role:'user',text:message});input.value='';render();
  try{
    const data=await request('/api/ai/chat',{method:'POST',headers:{'x-max-tour-locale':state.locale},body:JSON.stringify({locale:state.locale,message,history:state.ai.slice(-8).map(m=>({role:m.role==='user'?'user':'assistant',text:m.text})),context:{locale:state.locale}})});
    state.ai.push({role:'bot',text:data.reply||t('aiWelcome')});
  }catch(_){state.ai.push({role:'bot',text:state.locale==='vi'?'Tôi chưa thể trả lời ngay. Hãy thử lại.':'I cannot answer right now. Please try again.'});}
  render();
}
async function saveTravelerForm(form) {
  const m=state.modal,fd=new FormData(form);
  const tr={role:String(fd.get('role')||'adult'),fullName:String(fd.get('name')||'').trim(),birthDate:String(fd.get('birth')||''),primary:m?.index===0};
  if(!tr.fullName||!tr.birthDate)return;
  if(m?.index==null)state.travelers.push(tr);else state.travelers[m.index]={...state.travelers[m.index],...tr};
  state.travelers=normalizeTravelers(state.travelers);state.modal=null;render();await persistTravelers();render();
}

document.addEventListener('click',async event=>{
  if(event.target.closest('[data-modal-card]')&&event.target===event.currentTarget)return;
  const el=event.target.closest('[data-action]');if(!el)return;
  const action=el.dataset.action;
  if(action==='locale'){await switchLocale(el.dataset.locale);return;}
  if(action==='screen'){state.screen=el.dataset.screen;if(state.screen!=='booking')state.bookingDraft=null;render();return;}
  if(action==='tour'){state.selectedId=el.dataset.id;state.format='group';state.selectedDeparture=null;state.bookingDraft=null;state.screen='detail';render();return;}
  if(action==='favorite'){event.preventDefault();event.stopPropagation();await toggleFavorite(el.dataset.id);return;}
  if(action==='format'){state.format=el.dataset.format==='private'?'private':'group';state.selectedDeparture=null;state.bookingDraft=null;render();return;}
  if(action==='select-departure'){
    const tour=state.tours.find(x=>x.id===state.selectedId),dep=departuresFor(tour).find(x=>x.id===el.dataset.id);
    if(dep&&dep.status!=='full'){state.selectedDeparture=dep;render();}return;
  }
  if(action==='booking'){state.bookingDraft=null;startBookingDraft();state.screen='booking';render();return;}
  if(action==='detail'){state.screen='detail';state.bookingDraft=null;render();return;}
  if(action==='trip-tab'){state.tripTab=el.dataset.tab;render();return;}
  if(action==='pay-balance'){
    const trip=state.bookings.find(x=>String(x.id)===String(el.dataset.id));if(!trip)return;
    await patchTrip(trip.id,{paid:trip.total,rest:'$0',status:'paid',paidAt:new Date().toISOString()});
    state.modal={type:'message',title:t('paymentComplete'),text:t('balancePaid')};render();return;
  }
  if(action==='cancel-trip'){const trip=state.bookings.find(x=>String(x.id)===String(el.dataset.id));if(trip){state.modal={type:'cancel',trip};render();}return;}
  if(action==='reschedule-trip'){const trip=state.bookings.find(x=>String(x.id)===String(el.dataset.id));if(trip){state.modal={type:'reschedule',trip};render();}return;}
  if(action==='confirm-cancel'){
    const trip=state.bookings.find(x=>String(x.id)===String(el.dataset.id));if(!trip)return;
    const p=policyFor(trip,'cancel');await patchTrip(trip.id,{status:'cancelled',refund:moneyLabel(p.refund),retained:moneyLabel(p.retained),cancelledAt:new Date().toISOString()});
    state.modal={type:'message',title:t('cancelled'),text:t('tripCancelled')};render();return;
  }
  if(action==='add-traveler'){state.modal={type:'traveler',index:null,traveler:null};render();return;}
  if(action==='edit-traveler'){const i=Number(el.dataset.index);state.modal={type:'traveler',index:i,traveler:{...state.travelers[i]}};render();return;}
  if(action==='delete-traveler'){
    const i=Number(el.dataset.index);if(state.travelers[i]?.primary)return;
    state.travelers.splice(i,1);state.travelers=normalizeTravelers(state.travelers);render();try{await persistTravelers();}catch(_){}return;
  }
  if(action==='close-modal'){if(event.target.closest('[data-modal-card]')&&!event.target.matches('[data-action="close-modal"]'))return;state.modal=null;render();return;}
  if(action==='reload'){location.reload();}
});

document.addEventListener('input',event=>{
  if(event.target.id==='searchInput'){
    state.query=event.target.value;const pos=event.target.selectionStart;render();const next=document.getElementById('searchInput');if(next){next.focus();try{next.setSelectionRange(pos,pos)}catch(_){}}
    return;
  }
  if(event.target.matches('.booking-field')){
    const field=event.target.dataset.field;if(state.bookingDraft&&field)state.bookingDraft[field]=event.target.value;
    if(field==='format'){state.format=event.target.value==='private'?'private':'group';state.selectedDeparture=null;}
    return;
  }
  if(event.target.matches('.booking-count')){
    const field=event.target.dataset.field;if(!state.bookingDraft)return;
    state.bookingDraft[field]=Math.max(field==='adults'?1:0,Number(event.target.value)||0);ensureTravelerSlots();render();return;
  }
  if(event.target.matches('.traveler-name')){
    const i=Number(event.target.dataset.slot);if(state.bookingDraft?.travelers[i])state.bookingDraft.travelers[i].fullName=event.target.value;return;
  }
  if(event.target.matches('.traveler-birth')){
    const i=Number(event.target.dataset.slot);if(state.bookingDraft?.travelers[i])state.bookingDraft.travelers[i].birthDate=event.target.value;return;
  }
});
document.addEventListener('change',event=>{
  if(event.target.id==='cityFilter'){state.city=event.target.value;render();return;}
  if(event.target.id==='formatFilter'){state.formatFilter=event.target.value;render();return;}
  if(event.target.matches('.saved-traveler')){
    const i=Number(event.target.dataset.slot),[name,birth]=String(event.target.value||'').split('|');
    const tr=state.travelers.find(x=>x.fullName===name&&x.birthDate===birth);
    if(tr&&state.bookingDraft?.travelers[i])state.bookingDraft.travelers[i]={...state.bookingDraft.travelers[i],fullName:tr.fullName,birthDate:tr.birthDate};render();return;
  }
});
document.addEventListener('submit',async event=>{
  if(event.target.id==='bookingForm'){event.preventDefault();try{await submitBooking(event.target)}catch(_){alert(state.locale==='vi'?'Không thể lưu yêu cầu. Vui lòng kiểm tra thông tin và thử lại.':'Could not save the booking. Check the details and try again.');}}
  if(event.target.id==='aiForm'){event.preventDefault();await submitAi(event.target);}
  if(event.target.id==='travelerForm'){event.preventDefault();try{await saveTravelerForm(event.target)}catch(_){}}
  if(event.target.id==='rescheduleForm'){
    event.preventDefault();const id=event.target.dataset.id,date=String(new FormData(event.target).get('date')||'');if(!date)return;
    const trip=state.bookings.find(x=>String(x.id)===String(id));if(!trip)return;
    const p=policyFor(trip,'reschedule');await patchTrip(id,{date,status:'rescheduled',rescheduleFee:moneyLabel(p.fee),rescheduledAt:new Date().toISOString()});
    state.modal={type:'message',title:t('rescheduled'),text:t('tripRescheduled')};render();
  }
});

init();
