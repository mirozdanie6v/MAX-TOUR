import test from 'node:test';
import assert from 'node:assert/strict';
import { _test } from '../src/worker-profile.js';

const { timeoutFallback } = _test;

const body = (message, context = {}, history = []) => ({ message, context, history });

test('timeout fallback no longer emits the robotic multi-field prompt', () => {
  const reply = timeoutFallback(body('Помоги подобрать экскурсию'));
  assert.doesNotMatch(reply, /Я всё ещё с вами/i);
  assert.doesNotMatch(reply, /точку выезда.*направление.*дат.*сколько человек/i);
  assert.equal((reply.match(/\?/g) || []).length, 1);
});

test('timeout fallback asks only the next missing question', () => {
  const history = [
    { role:'user', text:'Я сейчас в Дананге' },
    { role:'bot', text:'Хорошо, поняла.' },
  ];
  const reply = timeoutFallback(body('Хочу что-нибудь интересное', {}, history));
  assert.match(reply, /Дананг/i);
  assert.match(reply, /море|горы|природ|истор|отдых|направление|подобрать/i);
  assert.doesNotMatch(reply, /сколько.*дат|дат.*сколько/i);
});

test('timeout fallback advances from route to date and party instead of restarting', () => {
  const history = [{ role:'user', text:'Мы сейчас в Нячанге' }];
  const dateReply = timeoutFallback(body('Далат нравится', { destination:'Далат', people:'состав не указан', date:'' }, history));
  assert.match(dateReply, /когда|день|дата|удобно/i);
  assert.doesNotMatch(dateReply, /откуда|где вы сейчас/i);

  const partyReply = timeoutFallback(body('Хотим 20 сентября', { destination:'Далат', people:'состав не указан', date:'2026-09-20' }, history));
  assert.match(partyReply, /сколько|вдвоём|компани|взросл|дет/i);
  assert.doesNotMatch(partyReply, /откуда|где вы сейчас/i);
});

test('timeout fallback asks a natural preference question when core facts are known', () => {
  const history = [{ role:'user', text:'Я в Нячанге' }];
  const reply = timeoutFallback(body('Что дальше?', { destination:'Далат', people:'2 взр.', date:'2026-09-20' }, history));
  assert.match(reply, /цена|комфорт|программ|спокойн|насыщенн|подешевле/i);
  assert.equal((reply.match(/\?/g) || []).length, 1);
});

test('timeout fallback varies wording and avoids exact repetition', () => {
  const firstBody = body('Подбери экскурсию');
  const first = timeoutFallback(firstBody);
  const second = timeoutFallback(body('Подбери экскурсию', {}, [
    { role:'user', text:'Подбери экскурсию' },
    { role:'bot', text:first },
  ]));
  assert.notEqual(first, second);
});
