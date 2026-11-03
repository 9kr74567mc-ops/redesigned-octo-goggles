import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultState, normalize } from '../js/store.js';

test('new installs default to kilograms', () => {
  const s = defaultState();
  assert.equal(s.settings.unit, 'kg');
  assert.equal(s.settings.rounding, 2.5);
  assert.equal(s.settings.barWeight, 20);
  const inc = Object.fromEntries(s.exercises.filter((e) => e.category === 'main').map((e) => [e.name, e.increment]));
  assert.deepEqual(inc, { Squat: 5, 'Bench Press': 2.5, Deadlift: 5, 'Overhead Press': 2.5 });
});

test('pound users keep pounds after normalize', () => {
  const lb = defaultState('lb');
  assert.equal(normalize(JSON.parse(JSON.stringify(lb))).settings.unit, 'lb');
  assert.equal(lb.exercises[0].increment, 10);
  assert.equal(normalize({ exercises: [] }).settings.unit, 'kg');
});
