import { uid, getWeeks } from './core.js';
import { EXERCISE_LIBRARY, LIBRARY_VERSION, groupOf } from './library.js';

const KEY = 'fivethreeone.state.v1';
export const SCHEMA_VERSION = 1;
export const DEFAULT_UNIT = 'kg';

export const UNIT_DEFAULTS = {
  lb: { rounding: 5, barWeight: 45, plates: [45, 35, 25, 10, 5, 2.5], upperInc: 5, lowerInc: 10 },
  kg: { rounding: 2.5, barWeight: 20, plates: [25, 20, 15, 10, 5, 2.5, 1.25], upperInc: 2.5, lowerInc: 5 },
};

export function defaultSettings(unit = DEFAULT_UNIT) {
  const u = UNIT_DEFAULTS[unit];
  return {
    unit,
    rounding: u.rounding,
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

const LOWER_GROUPS = new Set(['Squat', 'Hinge', 'Legs']);
const MAIN_LIFTS = ['Squat', 'Bench Press', 'Deadlift', 'Overhead Press'];

function libraryExercise(name, group, unit) {
  const u = UNIT_DEFAULTS[unit];
  const main = MAIN_LIFTS.includes(name);
  return { id: uid(), name, group, category: main ? 'main' : 'accessory', tm: null, increment: LOWER_GROUPS.has(group) ? u.lowerInc : u.upperInc };
}

/** Add library exercises the user doesn't have yet (matched by name), and group any ungrouped ones. */
export function mergeLibrary(state) {
  const unit = state.settings?.unit === 'lb' ? 'lb' : 'kg';
  if ((state.libraryVersion || 0) < LIBRARY_VERSION) {
    const have = new Set(state.exercises.map((e) => e.name.trim().toLowerCase()));
    for (const [group, names] of Object.entries(EXERCISE_LIBRARY)) {
      for (const name of names) if (!have.has(name.toLowerCase())) state.exercises.push(libraryExercise(name, group, unit));
    }
    state.libraryVersion = LIBRARY_VERSION;
  }
  for (const e of state.exercises) if (!e.group) e.group = groupOf(e.name);
  return state;
}

export function defaultState(unit = DEFAULT_UNIT) {
  const exercises = Object.entries(EXERCISE_LIBRARY).flatMap(([group, names]) => names.map((n) => libraryExercise(n, group, unit)));
  const id = (name) => exercises.find((e) => e.name === name).id;
  const fsl = () => ({ type: 'fsl', liftId: null, sets: 5, reps: 5, pct: null });
  const a = (name, sets, reps) => ({ exerciseId: id(name), sets, reps });
  const templates = [
    { id: uid(), name: 'Press Day', mainLiftId: id('Overhead Press'), supplemental: fsl(), accessories: [a('Chin-up', 5, 10), a('Face Pull', 3, 15)] },
    { id: uid(), name: 'Deadlift Day', mainLiftId: id('Deadlift'), supplemental: fsl(), accessories: [a('Hanging Leg Raise', 5, 10), a('Lunge', 3, 10)] },
    { id: uid(), name: 'Bench Day', mainLiftId: id('Bench Press'), supplemental: fsl(), accessories: [a('Dumbbell Row', 5, 10), a('Dip', 3, 10)] },
    { id: uid(), name: 'Squat Day', mainLiftId: id('Squat'), supplemental: fsl(), accessories: [a('Back Extension', 3, 12), a('Ab Wheel', 3, 10)] },
  ];
  return {
    version: SCHEMA_VERSION,
    libraryVersion: LIBRARY_VERSION,
    settings: defaultSettings(unit),
    exercises,
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
    libraryVersion: 0,
    ...raw,
    settings: { ...defaultSettings(raw.settings?.unit === 'lb' ? 'lb' : 'kg'), ...(raw.settings || {}) },
    cycle: { ...base.cycle, ...(raw.cycle || {}) },
  };
  for (const k of ['exercises', 'templates', 'workouts', 'tmHistory']) if (!Array.isArray(s[k])) s[k] = k === 'exercises' || k === 'templates' ? base[k] : [];
  if (!Array.isArray(s.cycle.done)) s.cycle.done = [];
  delete s.settings.tmPercent; // training maxes are entered directly
  const weeks = getWeeks(s.settings).length;
  s.cycle.week = Math.min(Math.max(1, s.cycle.week | 0), weeks);
  mergeLibrary(s);
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
