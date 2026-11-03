import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EXERCISE_LIBRARY, LIBRARY_VERSION, groupOf } from '../js/library.js';
import { defaultState, normalize } from '../js/store.js';

const allNames = Object.values(EXERCISE_LIBRARY).flat();

test('library names are unique', () => {
  const lower = allNames.map((n) => n.toLowerCase());
  assert.equal(new Set(lower).size, lower.length);
  assert.ok(allNames.length > 200);
});

test('groupOf finds library groups case-insensitively', () => {
  assert.equal(groupOf('front squat'), 'Squat');
  assert.equal(groupOf('Romanian Deadlift'), 'Hinge');
  assert.equal(groupOf('My Weird Lift'), 'Other');
});

test('fresh state contains the full library with groups', () => {
  const s = defaultState();
  assert.equal(s.exercises.length, allNames.length);
  assert.ok(s.exercises.every((e) => e.group));
  assert.equal(s.exercises.filter((e) => e.category === 'main').length, 4);
});

test('older saves get the library merged without duplicates or data loss', () => {
  const old = {
    settings: { unit: 'lb' },
    exercises: [
      { id: 'sq', name: 'Squat', category: 'main', tm: 300, increment: 10 },
      { id: 'fs', name: 'front squat', category: 'main', tm: 200, increment: 10 },
      { id: 'mine', name: 'Zombie Squat', category: 'accessory' },
    ],
    templates: [{ id: 't', name: 'Day', mainLiftId: 'sq', accessories: [] }],
    workouts: [],
  };
  const s = normalize(old);
  assert.equal(s.libraryVersion, LIBRARY_VERSION);
  assert.equal(s.exercises.find((e) => e.id === 'sq').tm, 300);
  assert.equal(s.exercises.filter((e) => e.name.toLowerCase() === 'front squat').length, 1);
  assert.equal(s.exercises.find((e) => e.id === 'mine').group, 'Other');
  assert.equal(s.exercises.find((e) => e.id === 'fs').group, 'Squat');
  assert.equal(s.exercises.length, allNames.length + 1);
  // Deleting a library exercise after merging doesn't bring it back on the next load.
  s.exercises = s.exercises.filter((e) => e.name !== 'Zercher Squat');
  assert.ok(!normalize(JSON.parse(JSON.stringify(s))).exercises.some((e) => e.name === 'Zercher Squat'));
});
