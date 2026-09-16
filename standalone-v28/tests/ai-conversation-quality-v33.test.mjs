import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cleanConversationHistory,
  normalizeConversationBody,
  originOnlyMessage,
  partyQuestion,
  replyNeedsRepair,
  standalonePartyCount,
  serveConversationController,
} from '../src/ai-conversation-quality-v33.js';

test('bare party count is understood only after a party question', () => {
  const history = [
    { role:'user', text:'Я в Нячанге' },
    { role:'bot', text:'Сколько человек едет? Если будут дети, укажите возраст — это влияет на цену.' },
    { role:'user', text:'3' },
    { role:'bot', text:'Подбираю…' },
  ];
  const normalized = normalizeConversationBody({
    message:'3',
    history,
    context:{ people:'состав не указан' },
  });
  assert.equal(normalized.message, 'Нас 3 взрослых');
  assert.equal(normalized.context.people, '3 взрослых');
  assert.equal(normalized.context.partyCount, 3);
  assert.equal(normalized.history.some(item => item.text === '3'), false);
  assert.equal(normalized.history.some(item => /^Подбираю/.test(item.text || '')), false);
});

test('a bare number is not turned into party size after a date question', () => {
  const normalized = normalizeConversationBody({
    message:'3',
    history:[{ role:'bot', text:'На какой день смотрим экскурсию?' }, { role:'user', text:'3' }],
    context:{},
  });
  assert.equal(normalized.message, '3');
  assert.equal(normalized.context.partyCount, undefined);
});

test('history sent to the model has neither temporary loader nor duplicated current user turn', () => {
  const rows = cleanConversationHistory([
    { role:'bot', text:'Что вам ближе: острова или город?' },
    { role:'user', text:'Острова' },
    { role:'bot', text:'Сколько человек едет?' },
    { role:'user', text:'3' },
    { role:'bot', text:'Подбираю…' },
  ], '3');
  assert.deepEqual(rows.map(item => item.text), ['Что вам ближе: острова или город?', 'Острова', 'Сколько человек едет?']);
});

test('origin-only answer is not a tour-selection intent', () => {
  assert.equal(originOnlyMessage('Я в Нячанге'), 'Нячанг');
  assert.equal(originOnlyMessage('Мы сейчас в Ханое'), 'Ханой');
  assert.equal(originOnlyMessage('Я в Нячанге, хочу на острова'), '');
});

test('repeated or wrong-field answer is rejected by conversation quality guard', () => {
  const payload = {
    reply:'Сколько человек едет? Если будут дети, укажите возраст — это влияет на цену.',
    nextStep:'ask_date',
    memory:{ origin:'Нячанг', adults:3, children:[], infants:0, date:'', preferences:['море и острова'] },
  };
  assert.equal(replyNeedsRepair(payload, [
    { role:'bot', text:'Сколько человек едет? Если будут дети, укажите возраст — это влияет на цену.' },
  ]), true);
  assert.equal(replyNeedsRepair({ ...payload, reply:'Принято, вас трое. На какой день смотрим экскурсию?' }, []), false);
});

test('party helpers cover the screenshot scenario', () => {
  assert.equal(partyQuestion('Сколько человек едет? Если будут дети, укажите возраст — это влияет на цену.'), true);
  assert.equal(standalonePartyCount('3'), 3);
  assert.equal(standalonePartyCount('пять'), 5);
});

test('browser controller is served no-cache and contains authoritative server-state bridge', async () => {
  const response = serveConversationController(new URL('https://max-tour-demo.viiversion.com/ai-conversation-quality-v33.js'));
  assert.ok(response);
  assert.match(response.headers.get('cache-control') || '', /no-store/);
  const source = await response.text();
  assert.match(source, /max-tour-ai-server-state-v33/);
  assert.match(source, /applyAuthoritativeContext/);
  assert.match(source, /quickReplies/);
  assert.match(source, /Нас ' \+ n \+ ' взрослых/);
});
