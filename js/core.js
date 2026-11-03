// Pure 5/3/1 logic. No DOM, no storage — unit tested in tests/core.test.js.

export const LB_PER_KG = 2.2046226218;

const WEEK_5S = { key: '5s', label: '5s Week', sets: [
  { pct: 0.65, reps: 5 }, { pct: 0.75, reps: 5 }, { pct: 0.85, reps: 5, amrap: true },
] };
const WEEK_3S = { key: '3s', label: '3s Week', sets: [
  { pct: 0.70, reps: 3 }, { pct: 0.80, reps: 3 }, { pct: 0.90, reps: 3, amrap: true },
] };
const WEEK_531 = { key: '531', label: '5/3/1 Week', sets: [
  { pct: 0.75, reps: 5 }, { pct: 0.85, reps: 3 }, { pct: 0.95, reps: 1, amrap: true },
] };
const WEEK_DELOAD = { key: 'deload', label: 'Deload', deload: true, sets: [
  { pct: 0.40, reps: 5 }, { pct: 0.50, reps: 5 }, { pct: 0.60, reps: 5 },
] };

export const WARMUP_SETS = [{ pct: 0.40, reps: 5 }, { pct: 0.50, reps: 5 }, { pct: 0.60, reps: 3 }];

export const SUPPLEMENTAL_TYPES = {
  none: { label: 'None' },
  fsl: { label: 'First Set Last (FSL)', sets: 5, reps: 5 },
  ssl: { label: 'Second Set Last (SSL)', sets: 5, reps: 5 },
  bbb: { label: 'Boring But Big (BBB)', sets: 5, reps: 10, pct: 0.5 },
  bbs: { label: 'Boring But Strong (BBS)', sets: 10, reps: 5 },
  custom: { label: 'Custom % of TM', sets: 5, reps: 5, pct: 0.6 },
};

export const FORMULAS = {
  epley: 'Epley',
  brzycki: 'Brzycki',
  average: 'Average (Epley + Brzycki)',
};

const clone = (o) => JSON.parse(JSON.stringify(o));

/** The weeks of one cycle, according to settings. */
export function getWeeks(settings = {}) {
  const order = settings.weekOrder === '351' ? [WEEK_3S, WEEK_5S, WEEK_531] : [WEEK_5S, WEEK_3S, WEEK_531];
  const weeks = order.map(clone);
  if (settings.mainStyle === 'fivespro') {
    weeks.forEach((w) => w.sets.forEach((s) => { s.reps = 5; s.amrap = false; }));
  }
  if (settings.deload !== false) weeks.push(clone(WEEK_DELOAD));
  return weeks;
}

export function roundTo(weight, increment = 5) {
  if (!Number.isFinite(weight)) return null;
  const inc = increment > 0 ? increment : 1;
  return Number((Math.round(weight / inc) * inc).toFixed(3));
}

export function fmt(n, digits = 1) {
  if (n == null || !Number.isFinite(n)) return '—';
  return String(Number(n.toFixed(digits)));
}

export function e1rm(weight, reps, formula = 'epley') {
  if (!(weight > 0) || !(reps > 0)) return 0;
  if (reps === 1) return weight;
  const epley = weight * (1 + reps / 30);
  const brzycki = weight * 36 / (37 - Math.min(reps, 36));
  if (formula === 'brzycki') return brzycki;
  if (formula === 'average') return (epley + brzycki) / 2;
  return epley;
}

/** Smallest rep count at `weight` whose e1RM beats `target`. */
export function repsToBeat(weight, target, formula = 'epley', maxReps = 30) {
  if (!(weight > 0)) return null;
  if (!(target > 0)) return 1;
  for (let r = 1; r <= maxReps; r++) {
    if (e1rm(weight, r, formula) > target + 1e-9) return r;
  }
  return null;
}

/** Greedy per-side plate breakdown. `remainder` is total weight that couldn't be loaded. */
export function plateBreakdown(total, bar, plates) {
  if (!(total > 0)) return { perSide: [], remainder: 0, belowBar: false };
  if (total < bar) return { perSide: [], remainder: 0, belowBar: true };
  let side = (total - bar) / 2;
  const perSide = [];
  for (const p of [...plates].filter((p) => p > 0).sort((a, b) => b - a)) {
    while (side >= p - 1e-9) { perSide.push(p); side -= p; }
  }
  return { perSide, remainder: Number((side * 2).toFixed(3)), belowBar: false };
}

export function supplementalPct(type, week, customPct) {
  switch (type) {
    case 'fsl': case 'bbs': return week.sets[0].pct;
    case 'ssl': return week.sets[1].pct;
    case 'bbb': return customPct ?? SUPPLEMENTAL_TYPES.bbb.pct;
    case 'custom': return customPct ?? SUPPLEMENTAL_TYPES.custom.pct;
    default: return null;
  }
}

let idCounter = 0;
export function uid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `id-${Date.now().toString(36)}-${(idCounter++).toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export const makeSet = (o) => ({ kind: 'work', pct: null, weight: null, targetReps: null, reps: null, amrap: false, done: false, ...o });

/**
 * Build the entries for a session (template) in a given week.
 * `exercises` is an array; `history` is the list of completed workouts (used to prefill accessories).
 */
/** Weight for `pct` of a lift's TM, using the lift's own rounding if it has one. */
export function liftWeight(lift, pct, settings) {
  return lift && lift.tm > 0 ? roundTo(lift.tm * pct, lift.rounding > 0 ? lift.rounding : settings.rounding || 5) : null;
}

/** Warm-ups (optional) plus the week's three 5/3/1 sets for any lift with a training max. */
export function mainSets(lift, week, settings) {
  const sets = [];
  if (settings.warmups !== false) {
    WARMUP_SETS.forEach((s) => sets.push(makeSet({ kind: 'warmup', pct: s.pct, weight: liftWeight(lift, s.pct, settings), targetReps: s.reps })));
  }
  week.sets.forEach((s) => sets.push(makeSet({ kind: 'main', pct: s.pct, weight: liftWeight(lift, s.pct, settings), targetReps: s.reps, amrap: !!s.amrap })));
  return sets;
}

export function buildSession({ template, exercises, settings, weekIndex, history = [] }) {
  const weeks = getWeeks(settings);
  const week = weeks[Math.min(Math.max(weekIndex, 0), weeks.length - 1)];
  const byId = Object.fromEntries(exercises.map((e) => [e.id, e]));
  const entries = [];

  const main = byId[template.mainLiftId];
  if (main) entries.push({ id: uid(), exerciseId: main.id, name: main.name, role: 'main', sets: mainSets(main, week, settings) });

  const supp = template.supplemental || { type: 'none' };
  const skipSupp = week.deload && settings.deloadSupplemental !== true;
  if (supp.type && supp.type !== 'none' && !skipSupp) {
    const lift = byId[supp.liftId] || main;
    if (lift) {
      const def = SUPPLEMENTAL_TYPES[supp.type] || SUPPLEMENTAL_TYPES.custom;
      const pct = supplementalPct(supp.type, week, supp.pct);
      const nSets = supp.sets || def.sets;
      const reps = supp.reps || def.reps;
      const sets = Array.from({ length: nSets }, () => makeSet({ kind: 'supplemental', pct, weight: liftWeight(lift, pct, settings), targetReps: reps }));
      entries.push({ id: uid(), exerciseId: lift.id, name: lift.name, role: 'supplemental', label: def.label, sets });
    }
  }

  let linkFromPrev = null;
  for (const acc of template.accessories || []) {
    const ex = byId[acc.exerciseId];
    if (!ex) { linkFromPrev = null; continue; }
    const last = lastPerformance(history, ex.id);
    const sets = accessorySets({ last, repeatLast: acc.repeatLast, sets: acc.sets, reps: acc.reps, drops: acc.drops, rounding: ex.rounding || settings.rounding });
    const entry = { id: uid(), exerciseId: ex.id, name: ex.name, role: 'accessory', sets };
    if (linkFromPrev) entry.groupId = linkFromPrev.groupId ||= uid();
    entries.push(entry);
    linkFromPrev = acc.linkNext ? entry : null;
  }
  normalizeGroups(entries);

  return { week, entries };
}

/** Most recent entry (with ≥1 done set) for the exercise, plus its workout date. */
export function lastPerformance(workouts, exerciseId) {
  const sorted = [...workouts].sort((a, b) => (b.date + (b.startedAt || '')).localeCompare(a.date + (a.startedAt || '')));
  for (const w of sorted) {
    for (const e of w.entries || []) {
      if (e.exerciseId === exerciseId && e.sets.some((s) => s.done)) return { date: w.date, workoutId: w.id, sets: e.sets.filter((s) => s.done) };
    }
  }
  return null;
}

const countable = (s) => s.done && s.kind !== 'warmup' && s.style !== 'drop' && s.weight > 0 && s.reps > 0 && s.reps <= 15;

/** Per-workout best estimated 1RM for an exercise, sorted by date ascending. */
export function e1rmHistory(workouts, exerciseId, formula = 'epley') {
  const points = [];
  for (const w of workouts) {
    let best = null;
    for (const e of w.entries || []) {
      if (e.exerciseId !== exerciseId) continue;
      for (const s of e.sets) {
        if (!countable(s)) continue;
        const v = e1rm(s.weight, s.reps, formula);
        if (!best || v > best.e1rm) best = { e1rm: v, weight: s.weight, reps: s.reps };
      }
    }
    if (best) points.push({ date: w.date, workoutId: w.id, ...best });
  }
  return points.sort((a, b) => a.date.localeCompare(b.date));
}

export function bestE1rm(workouts, exerciseId, formula = 'epley', excludeWorkoutId = null) {
  let best = 0;
  for (const p of e1rmHistory(workouts.filter((w) => w.id !== excludeWorkoutId), exerciseId, formula)) best = Math.max(best, p.e1rm);
  return best;
}

/** Heaviest weight lifted for each rep count actually performed (1..12). */
export function repRecords(workouts, exerciseId) {
  const recs = {};
  for (const w of workouts) {
    for (const e of w.entries || []) {
      if (e.exerciseId !== exerciseId) continue;
      for (const s of e.sets) {
        if (!s.done || s.kind === 'warmup' || s.style === 'drop' || !(s.weight > 0) || !(s.reps > 0) || s.reps > 12) continue;
        if (!recs[s.reps] || s.weight > recs[s.reps].weight) recs[s.reps] = { weight: s.weight, date: w.date };
      }
    }
  }
  return recs;
}

/** e1RM PRs set in `workout` relative to all earlier `workouts`. */
export function findPRs(workout, workouts, formula = 'epley') {
  const prior = workouts.filter((w) => w.id !== workout.id && w.date <= workout.date);
  const prs = [];
  const seen = new Set();
  for (const e of workout.entries || []) {
    if (seen.has(e.exerciseId)) continue;
    const mine = e1rmHistory([workout], e.exerciseId, formula)[0];
    if (!mine) continue;
    const prev = bestE1rm(prior, e.exerciseId, formula);
    if (prev > 0 && mine.e1rm > prev + 1e-9) {
      seen.add(e.exerciseId);
      prs.push({ exerciseId: e.exerciseId, name: e.name, e1rm: mine.e1rm, previous: prev, weight: mine.weight, reps: mine.reps });
    }
  }
  return prs;
}

/**
 * Suggest next cycle's training max. If the heaviest AMRAP set of the cycle missed its
 * minimum reps, suggest a 10% reset; otherwise add the lift's increment.
 */
export function suggestNextTm(exercise, workouts, cycleNumber, rounding = 5) {
  const tm = exercise.tm;
  if (!(tm > 0)) return { tm: null, reason: 'No training max set' };
  let topAmrap = null;
  for (const w of workouts) {
    if (w.cycle !== cycleNumber) continue;
    for (const e of w.entries || []) {
      if (e.exerciseId !== exercise.id || e.role !== 'main') continue;
      for (const s of e.sets) {
        if (s.amrap && s.done && (!topAmrap || s.pct > topAmrap.pct)) topAmrap = s;
      }
    }
  }
  if (topAmrap && topAmrap.reps < topAmrap.targetReps) {
    return { tm: roundTo(tm * 0.9, rounding), reason: `Missed ${topAmrap.targetReps}+ at ${fmt(topAmrap.weight)} — reset 10%` };
  }
  const inc = exercise.increment ?? 5;
  return { tm: roundTo(tm + inc, rounding), reason: topAmrap ? `Hit ${topAmrap.reps} reps at ${fmt(topAmrap.weight)} — +${fmt(inc)}` : `+${fmt(inc)}` };
}

export function workoutVolume(workout) {
  let v = 0;
  for (const e of workout.entries || []) for (const s of e.sets) if (s.done && s.weight > 0 && s.reps > 0) v += s.weight * s.reps;
  return v;
}

/** Local YYYY-MM-DD. */
export function isoDate(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function parseIsoDate(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Month grid (Monday-first) as an array of weeks, each 7 ISO dates or null. */
export function monthGrid(year, month) {
  const first = new Date(year, month, 1);
  const days = new Date(year, month + 1, 0).getDate();
  const lead = (first.getDay() + 6) % 7;
  const cells = Array(lead).fill(null);
  for (let d = 1; d <= days; d++) cells.push(isoDate(new Date(year, month, d)));
  while (cells.length % 7) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** Multiply every stored weight by `factor` (unit conversion). Mutates and returns state. */
export function convertWeights(state, factor, rounding) {
  const r = (w) => (w == null ? w : roundTo(w * factor, rounding > 0 ? Math.min(rounding, 0.5) : 0.5));
  const toKg = factor < 1;
  for (const e of state.exercises) {
    e.tm = r(e.tm);
    if (e.increment != null) e.increment = toKg ? (e.increment >= 10 ? 5 : 2.5) : (e.increment >= 5 ? 10 : 5);
  }
  for (const w of [...state.workouts, ...(state.activeWorkout ? [state.activeWorkout] : [])]) {
    for (const e of w.entries) for (const s of e.sets) s.weight = r(s.weight);
  }
  for (const h of state.tmHistory || []) h.tm = r(h.tm);
  return state;
}

// ---------- accessory schemes, last-time targets, drop sets, supersets ----------

export const SCHEMES = [[5, 5], [3, 5], [3, 8], [4, 8], [3, 10], [4, 10], [5, 10], [3, 12], [3, 15], [2, 20]];

/**
 * Reps needed at `weight` to beat a previous set. Same (or no) weight: one more rep.
 * Different weight: the fewest reps whose e1RM beats the previous set's.
 */
export function targetReps(weight, prev, formula = 'epley') {
  if (!prev || !(prev.reps > 0)) return null;
  if (!(weight > 0) || !(prev.weight > 0) || Math.abs(weight - prev.weight) < 1e-9) return prev.reps + 1;
  return repsToBeat(weight, e1rm(prev.weight, prev.reps, formula), formula);
}

/** How a logged set compares with the previous one: 1 better, 0 equal, -1 worse. */
export function compareToPrev(set, prev, formula = 'epley') {
  if (!prev || !(set.reps > 0)) return null;
  const same = !(set.weight > 0) || !(prev.weight > 0) || Math.abs(set.weight - prev.weight) < 1e-9;
  if (same) {
    const dw = (set.weight || 0) - (prev.weight || 0);
    return Math.sign(set.reps - prev.reps) || Math.sign(dw);
  }
  const a = e1rm(set.weight, set.reps, formula), b = e1rm(prev.weight, prev.reps, formula);
  return Math.abs(a - b) < 1e-9 ? 0 : Math.sign(a - b);
}

const prevOf = (s) => (s ? { weight: s.weight ?? null, reps: s.reps ?? null } : null);

/** Sets for an accessory: copied from last time, or a sets×reps scheme with last time's numbers as targets. */
export function accessorySets({ last, repeatLast, sets: nSets = 3, reps = 10, drops = 0, rounding = 2.5 }) {
  const prior = (last?.sets || []).filter((s) => s.kind !== 'warmup');
  let sets;
  if (repeatLast && prior.length) {
    sets = prior.map((p) => makeSet({ kind: 'accessory', weight: p.weight ?? null, targetReps: p.reps ?? null, style: p.style, prev: prevOf(p) }));
  } else {
    const straight = prior.filter((p) => p.style !== 'drop');
    const weight = straight[0]?.weight ?? null;
    sets = Array.from({ length: nSets || 3 }, (_, i) => makeSet({ kind: 'accessory', weight, targetReps: reps || 10, prev: prevOf(straight[i]) }));
    appendDrops(sets, drops, rounding);
  }
  return sets;
}

/** Add `n` drop sets after the last set, each ~20% lighter than the one before. */
export function appendDrops(sets, n, rounding = 2.5) {
  for (let i = 0; i < (n || 0); i++) sets.push(dropSetAfter(sets.at(-1), rounding));
  return sets;
}

export function dropSetAfter(prev, rounding = 2.5) {
  const w = prev?.weight > 0 ? roundTo(prev.weight * 0.8, rounding) : null;
  return makeSet({ kind: prev?.kind === 'main' || prev?.kind === 'warmup' ? 'accessory' : prev?.kind || 'accessory', weight: w, targetReps: null, style: 'drop' });
}

/** Keep superset groups contiguous; a lone grouped entry is ungrouped. Mutates entries. */
export function normalizeGroups(entries) {
  const seen = new Set();
  let i = 0;
  while (i < entries.length) {
    const g = entries[i].groupId;
    if (!g) { i++; continue; }
    let j = i;
    while (j + 1 < entries.length && entries[j + 1].groupId === g) j++;
    if (j === i) delete entries[i].groupId;
    else {
      const id = seen.has(g) ? uid() : g;
      seen.add(id);
      for (let k = i; k <= j; k++) entries[k].groupId = id;
    }
    i = j + 1;
  }
  return entries;
}

/** Per-entry group info: null, or { letter, pos (0-based), size, type }. */
export function groupInfo(entries) {
  const out = entries.map(() => null);
  let letter = 0, i = 0;
  while (i < entries.length) {
    const g = entries[i].groupId;
    let j = i;
    while (g && j + 1 < entries.length && entries[j + 1].groupId === g) j++;
    if (g && j > i) {
      const L = String.fromCharCode(65 + (letter++ % 26));
      for (let k = i; k <= j; k++) out[k] = { letter: L, pos: k - i, size: j - i + 1, type: j - i + 1 >= 3 ? 'Giant set' : 'Superset' };
    }
    i = j + 1;
  }
  return out;
}
