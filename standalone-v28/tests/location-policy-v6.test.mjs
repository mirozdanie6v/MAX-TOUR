import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const policy = await readFile(resolve(root, 'src/trip-policy-live-v2.js'), 'utf8');
const ai = await readFile(resolve(root, 'src/ai-location-guard-v6.js'), 'utf8');
const build = await readFile(resolve(root, 'build.mjs'), 'utf8');

test('live trip policy is syntactically valid and uses current Vietnam time', () => {
  assert.doesNotThrow(() => new vm.Script(policy));
  assert.match(policy, /Asia\/Ho_Chi_Minh/);
  assert.match(policy, /48 \* 60 \* 60 \* 1000/);
  assert.match(policy, /T17:00:00/);
  assert.match(policy, /now >= departure/);
  assert.match(policy, /Поездка завершена/);
  assert.match(policy, /setInterval\(\(\) => refreshLivePolicies\(new Date\(\)\), 60 \* 1000\)/);
});

test('location guard blocks impossible cross-region cards and allows real demo routes', () => {
  const context = {
    MaxTourAI:{ mount(){} },
    sessionStorage:{ getItem(){ return null; }, setItem(){}, removeItem(){} },
    console,
  };
  vm.createContext(context);
  vm.runInContext(ai, context);
  const { allowed, placeFrom } = context.MaxTourAI._locationTest;
  assert.equal(allowed('Ханой','Далат'), false);
  assert.equal(allowed('Ханой','Ниньбинь'), true);
  assert.equal(allowed('Ханой','Халонг'), true);
  assert.equal(allowed('Нячанг','Далат'), true);
  assert.equal(placeFrom('Экскурсия в Ниньбинь / Ninh Binh'), 'Ниньбинь');
});

test('AI starts with location and renders request-only route instead of refusing Ninh Binh', () => {
  assert.match(ai, /Где вы сейчас или откуда планируете выезд/);
  assert.match(ai, /Я в Ханое/);
  assert.match(ai, /Ниньбинь/);
  assert.match(ai, /Маршрут по запросу/);
  assert.match(ai, /я не буду выдумывать цену/);
  assert.match(ai, /card\.hidden = !\(routeOk && destinationOk\)/);
});

test('build ships live policy after trip actions and location guard after AI v5', () => {
  const trip = build.indexOf('/trip-actions.js');
  const policyIndex = build.indexOf('/trip-policy-live-v2.js');
  const aiV5 = build.indexOf('/ai-consultant-v5.js');
  const aiV6 = build.indexOf('/ai-location-guard-v6.js');
  const runtime = build.indexOf('/runtime-api.js');
  assert.ok(trip >= 0 && policyIndex > trip);
  assert.ok(aiV5 >= 0 && aiV6 > aiV5);
  assert.ok(runtime > aiV6);
});
