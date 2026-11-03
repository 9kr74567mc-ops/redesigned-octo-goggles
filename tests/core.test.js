import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as core from '../js/core.js';

const settings = { rounding: 5, warmups: true, deload: true, weekOrder: '531', mainStyle: 'amrap' };

test('weeks follow 5/3/1 percentages', () => {
  const weeks = core.getWeeks(settings);
  assert.equal(weeks.length, 4);
  assert.deepEqual(weeks[0].sets.map((s) => s.pct), [0.65, 0.75, 0.85]);
  assert.deepEqual(weeks[2].sets.map((s) => s.reps), [5, 3, 1]);
  assert.equal(weeks[2].sets[2].amrap, true);
  assert.equal(weeks[3].deload, true);
  assert.equal(core.getWeeks({ ...settings, deload: false }).length, 3);
  assert.equal(core.getWeeks({ ...settings, weekOrder: '351' })[0].key, '3s');
  const pro = core.getWeeks({ ...settings, mainStyle: 'fivespro' });
  assert.ok(pro.every((w) => w.sets.every((s) => s.reps === 5 && !s.amrap)));
});

test('rounding and training max', () => {
  assert.equal(core.roundTo(187.4, 5), 185);
  assert.equal(core.roundTo(188, 5), 190);
  assert.equal(core.roundTo(101.3, 2.5), 102.5);
});

test('e1RM formulas', () => {
  assert.equal(core.e1rm(200, 1), 200);
  assert.equal(core.e1rm(200, 5), 200 * (1 + 5 / 30));
  assert.ok(Math.abs(core.e1rm(200, 5, 'brzycki') - 225) < 1e-9);
  assert.equal(core.e1rm(0, 5), 0);
  assert.equal(core.e1rm(100, 0), 0);
});

test('reps to beat a PR', () => {
  // 225 x 8 epley = 285; at 245 need e1rm > 285 -> 245*(1+r/30) > 285 -> r > 4.9 -> 5
  assert.equal(core.repsToBeat(245, 285), 5);
  assert.equal(core.repsToBeat(245, 0), 1);
  assert.equal(core.repsToBeat(100, 10000), null);
});

test('plate breakdown', () => {
  const p = core.plateBreakdown(225, 45, [45, 35, 25, 10, 5, 2.5]);
  assert.deepEqual(p.perSide, [45, 45]);
  assert.equal(p.remainder, 0);
  assert.equal(core.plateBreakdown(30, 45, [45]).belowBar, true);
  const r = core.plateBreakdown(102, 45, [45, 25, 10, 5, 2.5]);
  assert.deepEqual(r.perSide, [25, 2.5]);
  assert.equal(r.remainder, 2);
});

test('buildSession produces warmups, main sets, supplemental and accessories', () => {
  const exercises = [
    { id: 'sq', name: 'Squat', category: 'main', tm: 300 },
    { id: 'lr', name: 'Leg Raise', category: 'accessory' },
  ];
  const template = { id: 't', mainLiftId: 'sq', supplemental: { type: 'fsl', sets: 5, reps: 5 }, accessories: [{ exerciseId: 'lr', sets: 3, reps: 12 }] };
  const history = [{ id: 'w0', date: '2026-01-01', entries: [{ exerciseId: 'lr', sets: [{ done: true, weight: 20, reps: 12 }] }] }];
  const { entries, week } = core.buildSession({ template, exercises, settings, weekIndex: 2, history });
  assert.equal(week.key, '531');
  const main = entries[0];
  assert.deepEqual(main.sets.map((s) => s.weight), [120, 150, 180, 225, 255, 285]);
  assert.equal(main.sets.filter((s) => s.kind === 'warmup').length, 3);
  assert.equal(main.sets.at(-1).amrap, true);
  const supp = entries[1];
  assert.equal(supp.role, 'supplemental');
  assert.equal(supp.sets.length, 5);
  assert.equal(supp.sets[0].weight, 225);
  assert.equal(entries[2].sets.length, 3);
  assert.equal(entries[2].sets[0].weight, 20);
  assert.equal(entries[2].sets[0].targetReps, 12);

  const deload = core.buildSession({ template, exercises, settings, weekIndex: 3 });
  assert.equal(deload.entries.filter((e) => e.role === 'supplemental').length, 0);
  const bbb = core.buildSession({ template: { ...template, supplemental: { type: 'bbb', sets: 5, reps: 10, pct: 0.5 } }, exercises, settings, weekIndex: 0 });
  assert.equal(bbb.entries[1].sets[0].weight, 150);
});

const wk = (id, date, sets, extra = {}) => ({ id, date, entries: [{ exerciseId: 'sq', name: 'Squat', role: 'main', sets }], ...extra });

test('e1RM history, best and PR detection', () => {
  const w1 = wk('a', '2026-01-01', [{ kind: 'main', done: true, weight: 200, reps: 5 }, { kind: 'warmup', done: true, weight: 250, reps: 5 }]);
  const w2 = wk('b', '2026-01-08', [{ kind: 'main', done: true, weight: 210, reps: 5 }, { kind: 'main', done: false, weight: 400, reps: 5 }]);
  const hist = core.e1rmHistory([w2, w1], 'sq');
  assert.deepEqual(hist.map((h) => h.workoutId), ['a', 'b']);
  assert.equal(hist[0].e1rm, core.e1rm(200, 5)); // warmup ignored
  assert.equal(core.bestE1rm([w1, w2], 'sq'), core.e1rm(210, 5));
  const prs = core.findPRs(w2, [w1, w2]);
  assert.equal(prs.length, 1);
  assert.equal(core.findPRs(w1, [w1]).length, 0); // first ever isn't a PR
  const recs = core.repRecords([w1, w2], 'sq');
  assert.equal(recs[5].weight, 210);
  assert.equal(recs[1], undefined);
});

test('next training max suggestion', () => {
  const ex = { id: 'sq', tm: 300, increment: 10 };
  const ok = [wk('a', '2026-01-01', [{ kind: 'main', amrap: true, pct: 0.95, done: true, weight: 285, reps: 3, targetReps: 1 }], { cycle: 1 })];
  assert.equal(core.suggestNextTm(ex, ok, 1).tm, 310);
  const miss = [wk('a', '2026-01-01', [{ kind: 'main', amrap: true, pct: 0.95, done: true, weight: 285, reps: 0, targetReps: 1 }], { cycle: 1 })];
  assert.equal(core.suggestNextTm(ex, miss, 1).tm, 270);
  assert.equal(core.suggestNextTm(ex, [], 1).tm, 310);
});

test('month grid is Monday-first and complete', () => {
  const g = core.monthGrid(2026, 10); // November 2026 starts on a Sunday
  assert.equal(g[0].filter(Boolean).length, 1);
  assert.equal(g[0][6], '2026-11-01');
  assert.equal(g.flat().filter(Boolean).length, 30);
});

test('unit conversion', () => {
  const state = { exercises: [{ tm: 225, increment: 10 }], workouts: [wk('a', '2026-01-01', [{ weight: 100 }])], activeWorkout: null, tmHistory: [] };
  core.convertWeights(state, 1 / core.LB_PER_KG, 2.5);
  assert.equal(state.exercises[0].tm, 102);
  assert.equal(state.exercises[0].increment, 5);
  assert.equal(state.workouts[0].entries[0].sets[0].weight, 45.5);
});

test('any exercise with a TM gets 5/3/1 sets, honoring its own rounding', () => {
  const settings = { rounding: 2.5, warmups: false };
  const week = core.getWeeks(settings)[0];
  const db = { id: 'idb', name: 'Incline Dumbbell Press', tm: 31, rounding: 2 };
  assert.deepEqual(core.mainSets(db, week, settings).map((s) => s.weight), [20, 24, 26]);
  const bar = { id: 'x', name: 'Front Squat', tm: 100 };
  assert.deepEqual(core.mainSets(bar, week, settings).map((s) => s.weight), [65, 75, 85]);
  const { entries } = core.buildSession({ template: { mainLiftId: 'idb', supplemental: { type: 'fsl', sets: 5, reps: 5 } }, exercises: [db], settings, weekIndex: 0 });
  assert.equal(entries[0].sets.at(-1).amrap, true);
  assert.equal(entries[1].sets[0].weight, 20);
});

test('targets to beat last time', () => {
  assert.equal(core.targetReps(50, { weight: 50, reps: 10 }), 11);
  assert.equal(core.targetReps(null, { weight: null, reps: 12 }), 13); // bodyweight
  // heavier: 50x10 epley = 66.67; at 55 need 55*(1+r/30) > 66.67 -> r > 6.36 -> 7
  assert.equal(core.targetReps(55, { weight: 50, reps: 10 }), 7);
  assert.equal(core.targetReps(50, null), null);
  assert.equal(core.compareToPrev({ weight: 50, reps: 11 }, { weight: 50, reps: 10 }), 1);
  assert.equal(core.compareToPrev({ weight: 50, reps: 10 }, { weight: 50, reps: 10 }), 0);
  assert.equal(core.compareToPrev({ weight: 55, reps: 6 }, { weight: 50, reps: 10 }), -1);
});

test('accessory sets: repeat last, scheme with targets, drops', () => {
  const last = { sets: [{ kind: 'accessory', weight: 40, reps: 10, done: true }, { kind: 'accessory', weight: 40, reps: 8, done: true }, { kind: 'accessory', weight: 30, reps: 8, style: 'drop', done: true }] };
  const rep = core.accessorySets({ last, repeatLast: true });
  assert.deepEqual(rep.map((s) => [s.weight, s.targetReps, s.style]), [[40, 10, undefined], [40, 8, undefined], [30, 8, 'drop']]);
  assert.deepEqual(rep[1].prev, { weight: 40, reps: 8 });
  const sch = core.accessorySets({ last, sets: 3, reps: 12, drops: 2, rounding: 2.5 });
  assert.deepEqual(sch.map((s) => s.weight), [40, 40, 40, 32.5, 25]);
  assert.deepEqual(sch.map((s) => s.style), [undefined, undefined, undefined, 'drop', 'drop']);
  assert.equal(sch[2].prev, null);
  assert.equal(core.accessorySets({ last: null, repeatLast: true, sets: 2, reps: 5 }).length, 2);
});

test('supersets and giant sets stay contiguous', () => {
  const es = [{ groupId: 'a' }, { groupId: 'a' }, {}, { groupId: 'a' }, { groupId: 'b' }, { groupId: 'b' }, { groupId: 'b' }];
  core.normalizeGroups(es);
  assert.equal(es[0].groupId, es[1].groupId);
  assert.equal(es[3].groupId, undefined);
  const info = core.groupInfo(es);
  assert.deepEqual(info.map((g) => g && `${g.letter}${g.pos + 1}/${g.type}`), ['A1/Superset', 'A2/Superset', null, null, 'B1/Giant set', 'B2/Giant set', 'B3/Giant set']);
});

test('templates build supersets, drop sets; drops excluded from e1RM', () => {
  const exercises = [{ id: 'c', name: 'Curl' }, { id: 'p', name: 'Pushdown' }, { id: 'r', name: 'Raise' }];
  const template = { accessories: [{ exerciseId: 'c', sets: 3, reps: 10, linkNext: true }, { exerciseId: 'p', sets: 3, reps: 12, drops: 1 }, { exerciseId: 'r', sets: 2, reps: 15 }] };
  const { entries } = core.buildSession({ template, exercises, settings: { rounding: 2.5 }, weekIndex: 0 });
  assert.ok(entries[0].groupId && entries[0].groupId === entries[1].groupId);
  assert.equal(entries[2].groupId, undefined);
  assert.equal(entries[1].sets.at(-1).style, 'drop');
  const w = { id: 'w', date: '2026-01-01', entries: [{ exerciseId: 'c', sets: [{ done: true, weight: 20, reps: 10 }, { done: true, weight: 40, reps: 10, style: 'drop' }] }] };
  assert.equal(core.bestE1rm([w], 'c'), core.e1rm(20, 10));
});

test('backup reminder after each cycle or 30 days', () => {
  const now = new Date('2026-11-03T12:00:00Z');
  const w = (d) => ({ id: d, date: d.slice(0, 10), finishedAt: d });
  const base = { cycle: { number: 1, complete: false }, workouts: [w('2026-10-25T10:00:00Z')] };
  assert.equal(core.backupDue(base, now), null); // 9 days, mid-cycle
  assert.equal(core.backupDue({ ...base, cycle: { number: 1, complete: true } }, now).reason, 'cycle');
  assert.equal(core.backupDue({ ...base, cycle: { number: 2, complete: false } }, now).reason, 'cycle');
  assert.equal(core.backupDue({ ...base, workouts: [w('2026-09-20T10:00:00Z')] }, now).reason, 'time');
  // backed up after cycle 1; cycle 2 under way with new workouts → not yet
  const after = { cycle: { number: 2, complete: false }, lastBackupAt: '2026-10-26T00:00:00Z', lastBackupCycle: 2, workouts: [w('2026-10-25T10:00:00Z'), w('2026-11-01T10:00:00Z')] };
  assert.equal(core.backupDue(after, now), null);
  assert.equal(core.backupDue({ ...after, cycle: { number: 2, complete: true } }, now).workouts, 1);
  // nothing new since backup → never due
  assert.equal(core.backupDue({ ...after, workouts: [w('2026-10-25T10:00:00Z')], cycle: { number: 3, complete: true } }, now), null);
  // snoozed
  assert.equal(core.backupDue({ ...base, cycle: { number: 2 }, backupSnoozeUntil: '2026-11-05T00:00:00Z' }, now), null);
});
