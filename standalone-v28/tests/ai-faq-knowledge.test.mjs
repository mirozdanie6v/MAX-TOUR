import test from 'node:test';
import assert from 'node:assert/strict';
import { compactTourForAi, deterministicFaqReply, findTourForQuestion } from '../src/ai-faq-knowledge.js';

const dalat = compactTourForAi({
  id:'dalat-premium',
  title:'Далат «Премиум»',
  city:'Нячанг',
  region:'Далат',
  category:'Природа и горы',
  duration:'1 день',
  time:'05:00–05:30 → около 20:00',
  activity:'средний',
  tags:['премиум','природа','семья','горы','фото'],
  audience:['семья','пара','компания'],
  childrenOk:true,
  included:[
    'Вкусный обед',
    'Все входные билеты и канатная дорога',
    'Профессиональный русскоязычный гид',
    'Трансфер на комфортном микроавтобусе',
    'Бутылка воды каждому участнику',
  ],
  take:[
    'Одежду с закрытыми коленями и плечами для храмов',
    'Завтрак с вечера на ресепшене',
    'Кофту — в Далате прохладнее',
    'Дождевик',
    'Удобную обувь',
    'Донги на сувениры и мелкие расходы',
  ],
  group:{
    from:'$52', adult:'$52', child:'$38', infant:'до 100 см бесплатно', deposit:'30% или 100%',
    notes:['Группа 14–20 человек','Включены обед, билеты и канатная дорога','Русскоязычный гид и трансфер из отеля'],
    departures:[
      { date:'14 сен', time:'05:30', taken:11, status:'почти собрана', capacity:18 },
      { date:'16 сен', time:'05:30', taken:7, status:'собирается', capacity:18 },
      { date:'19 сен', time:'05:30', taken:18, status:'лист ожидания', capacity:18 },
    ],
  },
  individual:{
    from:'$420', deposit:'30% или 100%',
    tiers:['1–2 человека — $420','3 человека — $450','4 человека — $480','5 человек — $510','6 человек — $540'],
    notes:['Дата выбирается сразу','Маршрут можно сделать комфортнее по темпу','Остаток можно оплатить гиду в донгах'],
  },
});
const catalog = [dalat];
const now = new Date('2026-09-15T05:00:00Z');
const ask = message => deterministicFaqReply(message, catalog, { now });

test('finds exact tour from natural title wording', () => {
  assert.equal(findTourForQuestion('Что входит в Далат Премиум?', catalog)?.id, 'dalat-premium');
});

test('hotel transfer surcharge is direct and verified', () => {
  const r = ask('Заберёте нас из отеля Amiana? Есть доплата за трансфер?');
  assert.equal(r.intent, 'transfer_hotel');
  assert.match(r.reply, /\$20/);
  assert.match(r.reply, /\$30/);
});

test('schedule answer uses catalog time', () => {
  const r = ask('Во сколько выезд и примерно во сколько вернёмся с экскурсии Далат Премиум?');
  assert.equal(r.intent, 'schedule');
  assert.match(r.reply, /05:00/);
  assert.match(r.reply, /20:00/);
});

test('included answer lists real catalog inclusions', () => {
  const r = ask('Что входит в стоимость Далат Премиум?');
  assert.equal(r.intent, 'included');
  assert.match(r.reply, /обед/i);
  assert.match(r.reply, /канатн/i);
  assert.match(r.reply, /русскоязыч/i);
  assert.match(r.reply, /трансфер/i);
});

test('Dalat Premium child height rule answers the exact benchmark case', () => {
  const r = ask('Ребёнок ростом 110 см на Далат Премиум сколько стоит? А малыш до 100 см?');
  assert.equal(r.intent, 'child_price');
  assert.match(r.reply, /110 см — \$38/);
  assert.match(r.reply, /до 100 см — бесплатно/);
});

test('cancellation tomorrow before 17 is 30 percent', () => {
  const r = ask('Если экскурсия завтра в 8:00, а я отменяю сейчас утром, сколько удержат?');
  assert.equal(r.intent, 'cancellation');
  assert.match(r.reply, /30%/);
  assert.match(r.reply, /100%/);
});

test('bad weather answer explains force majeure without promising automatic cancellation for rain', () => {
  const r = ask('Что будет, если завтра сильный дождь или шторм и экскурсию нельзя проводить?');
  assert.equal(r.intent, 'weather_force_majeure');
  assert.match(r.reply, /перенос|возврат/i);
  assert.match(r.reply, /безопасност/i);
});

test('payment answer includes deposit and real payment channels', () => {
  const r = ask('Можно оплатить только депозит? Сколько процентов и какими способами можно оплатить?');
  assert.equal(r.intent, 'payment');
  assert.match(r.reply, /30%/);
  assert.match(r.reply, /налич/i);
  assert.match(r.reply, /карт/i);
  assert.match(r.reply, /перевод/i);
});

test('guide and group size are answered from catalog facts', () => {
  const r = ask('Гид будет русскоязычный? Сколько человек обычно в группе на Далат Премиум?');
  assert.equal(r.intent, 'guide_group');
  assert.match(r.reply, /русскоязыч/i);
  assert.match(r.reply, /14–20/);
});

test('dietary/allergy answer does not invent guaranteed menu', () => {
  const r = ask('Можно вегетарианский обед? А если сильная аллергия на морепродукты?');
  assert.equal(r.intent, 'dietary');
  assert.match(r.reply, /не гарантированы/i);
  assert.match(r.reply, /сильной аллергии/i);
});

test('what-to-take answer uses catalog checklist', () => {
  const r = ask('Что взять с собой на экскурсию в Далат Премиум?');
  assert.equal(r.intent, 'what_to_take');
  assert.match(r.reply, /кофту/i);
  assert.match(r.reply, /дождевик/i);
  assert.match(r.reply, /обув/i);
});

test('senior suitability answer grounds itself in duration and activity', () => {
  const r = ask('Маме 72 года. Далат Премиум ей подойдёт или будет тяжело?');
  assert.equal(r.intent, 'senior_load');
  assert.match(r.reply, /05:00/);
  assert.match(r.reply, /средний/i);
  assert.match(r.reply, /индивидуаль/i);
});

test('stroller answer is cautious when accessibility is not confirmed', () => {
  const r = ask('Можно на экскурсию Далат Премиум с детской коляской?');
  assert.equal(r.intent, 'stroller');
  assert.match(r.reply, /нет подтверждения/i);
  assert.match(r.reply, /до оплаты/i);
});

test('tomorrow availability uses catalog departure and remaining seats', () => {
  const r = ask('Можно забронировать Далат Премиум на завтра на двух взрослых?');
  assert.equal(r.intent, 'availability_tomorrow');
  assert.match(r.reply, /05:30/);
  assert.match(r.reply, /11 мест/);
  assert.match(r.reply, /переходить к оформлению/i);
});

test('individual four-person price is exact and route customization is not overpromised', () => {
  const r = ask('Хотим индивидуально в Далат Премиум, нас 4 человека. Сколько будет стоить и можно ли немного изменить маршрут?');
  assert.equal(r.intent, 'individual');
  assert.match(r.reply, /4 человека — \$480/);
  assert.match(r.reply, /изменение самих точек маршрута нужно подтвердить/i);
});
