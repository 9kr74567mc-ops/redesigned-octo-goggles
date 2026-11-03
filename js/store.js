import { uid, getWeeks } from './core.js';

const KEY = 'fivethreeone.state.v1';
export const SCHEMA_VERSION = 1;

export const UNIT_DEFAULTS = {
  lb: { rounding: 5, barWeight: 45, plates: [45, 35, 25, 10, 5, 2.5], upperInc: 5, lowerInc: 10 },
  kg: { rounding: 2.5, barWeight: 20, plates: [25, 20, 15, 10, 5, 2.5, 1.25], upperInc: 2.5, lowerInc: 5 },
};

export function defaultSettings(unit = 'lb') {
  const u = UNIT_DEFAULTS[unit];
  return {
    unit,
    rounding: u.rounding,
    tmPercent: 0.9,
    weekOrder: '531',      // '531' or '351'
    mainStyle: 'amrap',    // 'amrap' (classic PR sets) or 'fivespro'
    deload: true,
    deloadSupplemental: false,
    warmups: true,
    formula: 'epley',
    barWeight: u.barWeight,
    plates: u.plates,
    restMain: 180,
    restOther: 90,
    restSound: true,
  };
}

export function defaultState() {
  const ex = (name, category, increment, extra = {}) => ({ id: uid(), name, category, tm: null, increment, ...extra });
  const squat = ex('Squat', 'main', 10);
  const bench = ex('Bench Press', 'main', 5);
  const dead = ex('Deadlift', 'main', 10);
  const press = ex('Overhead Press', 'main', 5);
  const acc = {};
  for (const name of ['Chin-up', 'Dip', 'Dumbbell Row', 'Barbell Row', 'Face Pull', 'Lunge', 'Back Extension', 'Hanging Leg Raise', 'Ab Wheel', 'Push-up']) {
    acc[name] = ex(name, 'accessory', 5);
  }
  const fsl = () => ({ type: 'fsl', liftId: null, sets: 5, reps: 5, pct: null });
  const a = (name, sets, reps) => ({ exerciseId: acc[name].id, sets, reps });
  const templates = [
    { id: uid(), name: 'Press Day', mainLiftId: press.id, supplemental: fsl(), accessories: [a('Chin-up', 5, 10), a('Face Pull', 3, 15)] },
    { id: uid(), name: 'Deadlift Day', mainLiftId: dead.id, supplemental: fsl(), accessories: [a('Hanging Leg Raise', 5, 10), a('Lunge', 3, 10)] },
    { id: uid(), name: 'Bench Day', mainLiftId: bench.id, supplemental: fsl(), accessories: [a('Dumbbell Row', 5, 10), a('Dip', 3, 10)] },
    { id: uid(), name: 'Squat Day', mainLiftId: squat.id, supplemental: fsl(), accessories: [a('Back Extension', 3, 12), a('Ab Wheel', 3, 10)] },
  ];
  return {
    version: SCHEMA_VERSION,
    settings: defaultSettings('lb'),
    exercises: [squat, bench, dead, press, ...Object.values(acc)],
    templates,
    cycle: { number: 1, week: 1, done: [], complete: false, startedAt: new Date().toISOString() },
    workouts: [],
    activeWorkout: null,
    tmHistory: [],
  };
}

/** Fill in anything missing so older / imported data keeps working. */
export function normalize(raw) {
  const base = defaultState();
  if (!raw || typeof raw !== 'object') return base;
  const s = {
    ...base,
    ...raw,
    settings: { ...defaultSettings(raw.settings?.unit === 'kg' ? 'kg' : 'lb'), ...(raw.settings || {}) },
    cycle: { ...base.cycle, ...(raw.cycle || {}) },
  };
  for (const k of ['exercises', 'templates', 'workouts', 'tmHistory']) if (!Array.isArray(s[k])) s[k] = k === 'exercises' || k === 'templates' ? base[k] : [];
  if (!Array.isArray(s.cycle.done)) s.cycle.done = [];
  const weeks = getWeeks(s.settings).length;
  s.cycle.week = Math.min(Math.max(1, s.cycle.week | 0), weeks);
  s.version = SCHEMA_VERSION;
  return s;
}

export function load() {
  try {
    const txt = localStorage.getItem(KEY);
    return txt ? normalize(JSON.parse(txt)) : defaultState();
  } catch {
    return defaultState();
  }
}

export function save(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function clear() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}
