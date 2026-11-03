import * as core from './core.js';
import * as store from './store.js';

let S = store.load();
const ui = {
  lastHash: null,
  historyMode: 'calendar',
  calMonth: core.isoDate().slice(0, 7),
  calSelected: core.isoDate(),
  programTab: 'lifts',
  progressRange: 'all',
  chartInfo: '',
  draft: null,
  draftKey: null,
  justFinished: null,
  rest: null,
  tools: { plates: '', weight: '', reps: '' },
};

const view = document.getElementById('view');
const sheet = document.getElementById('sheet');
const restEl = document.getElementById('rest');
const toastEl = document.getElementById('toast');

// ---------- helpers ----------
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const unit = () => S.settings.unit;
const wt = (n) => (n == null || n === '' ? '—' : core.fmt(Number(n), 2));
const pct = (p) => (p == null ? '' : `${Math.round(p * 100)}%`);
const exById = (id) => S.exercises.find((e) => e.id === id);
const mainLifts = () => S.exercises.filter((e) => e.category === 'main');
const weeks = () => core.getWeeks(S.settings);
const num = (v) => { if (v === '' || v == null) return null; const n = Number(String(v).replace(',', '.')); return Number.isFinite(n) ? n : null; };
const dateFmt = (iso, opts = { weekday: 'short', month: 'short', day: 'numeric' }) => core.parseIsoDate(iso).toLocaleDateString(undefined, opts);
const persist = () => { if (!store.save(S)) toast('Could not save — storage full or blocked'); };
const go = (hash) => { location.hash = hash; };
const sortByDateDesc = (list) => [...list].sort((a, b) => (b.date + (b.startedAt || '')).localeCompare(a.date + (a.startedAt || '')));

function toast(msg) {
  toastEl.textContent = msg;
  toastEl.hidden = false;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => { toastEl.hidden = true; }, 2400);
}

function setTm(ex, tm) {
  if (ex.tm === tm) return;
  ex.tm = tm;
  if (tm > 0) S.tmHistory.push({ exerciseId: ex.id, date: core.isoDate(), tm });
}

function plateText(weight) {
  if (!(weight > 0)) return '';
  const p = core.plateBreakdown(weight, S.settings.barWeight, S.settings.plates);
  if (p.belowBar) return 'Below bar weight';
  if (!p.perSide.length) return p.remainder ? `Bar + ${wt(p.remainder)} unloadable` : 'Empty bar';
  return `${p.perSide.map(wt).join(' · ')} / side${p.remainder ? ` (+${wt(p.remainder)} off)` : ''}`;
}

function doneTemplatesThisWeek() {
  const c = S.cycle;
  return new Set(S.workouts.filter((w) => w.cycle === c.number && w.week === c.week && w.templateId).map((w) => w.templateId));
}

function weekPreview(lift, week) {
  if (!lift) return 'No main lift';
  if (!(lift.tm > 0)) return 'Set a training max';
  return week.sets.map((s) => `${wt(core.roundTo(lift.tm * s.pct, S.settings.rounding))}×${s.reps}${s.amrap ? '+' : ''}`).join(' · ');
}

const header = (title, sub = '', right = '') => `
  <header class="page-head">
    <div><h1>${title}</h1>${sub ? `<p class="sub">${sub}</p>` : ''}</div>${right}
  </header>`;

const backHeader = (title, back, sub = '', right = '') => `
  <header class="page-head">
    <div><a class="back" href="${back}">‹ Back</a><h1>${title}</h1>${sub ? `<p class="sub">${sub}</p>` : ''}</div>${right}
  </header>`;

// ---------- Units ----------
const unitSwitch = () => `<div class="segmented">${['kg', 'lb'].map((u) => `<button class="${unit() === u ? 'active' : ''}" data-action="set-unit" data-unit="${u}">${u === 'kg' ? 'Kilograms (kg)' : 'Pounds (lb)'}</button>`).join('')}</div>`;

function changeUnit(to) {
  const from = S.settings.unit;
  if (to === from || !store.UNIT_DEFAULTS[to]) return false;
  const hasData = S.workouts.length || S.activeWorkout || S.exercises.some((e) => e.tm > 0);
  const convert = hasData && confirm(`Convert all stored weights from ${from} to ${to}?\n\nOK = convert the numbers, Cancel = keep the numbers and just relabel them.`);
  const d = store.UNIT_DEFAULTS[to];
  if (convert) core.convertWeights(S, to === 'kg' ? 1 / core.LB_PER_KG : core.LB_PER_KG, d.rounding);
  else if (!hasData) for (const e of S.exercises) e.increment = e.increment >= (from === 'kg' ? 5 : 10) ? d.lowerInc : d.upperInc;
  Object.assign(S.settings, { unit: to, rounding: d.rounding, barWeight: d.barWeight, plates: d.plates });
  return true;
}

// ---------- Train (today) ----------
function viewToday() {
  const c = S.cycle;
  const ws = weeks();
  const week = ws[c.week - 1];
  const done = doneTemplatesThisWeek();
  let h = header('Train', `Cycle ${c.number} · ${esc(week.label)}`, `<a class="pill-link" href="#/tools">Calculators</a>`);

  if (S.activeWorkout) {
    const w = S.activeWorkout;
    const sets = w.entries.flatMap((e) => e.sets);
    h += `<a class="card resume" href="#/workout/active">
      <div><div class="eyebrow">In progress</div><strong>${esc(w.name)}</strong>
      <div class="sub">${sets.filter((s) => s.done).length}/${sets.length} sets done</div></div>
      <span class="btn primary small">Resume</span></a>`;
  }

  const missing = mainLifts().filter((e) => !(e.tm > 0));
  if (missing.length) {
    h += `<section class="card">
      <h2>Set your training maxes</h2>
      ${unitSwitch()}
      <p class="muted">Enter the training max for each lift. Every 5/3/1 percentage is taken from this number, rounded to ${wt(S.settings.rounding)} ${unit()}.</p>
      <div class="setup-grid">${missing.map((e) => `
        <label class="field"><span>${esc(e.name)} training max</span>
          <input type="text" inputmode="decimal" data-setup="${e.id}" placeholder="${unit()}"></label>`).join('')}
      </div>
      <button class="btn primary block" data-action="save-setup">Save training maxes</button>
    </section>`;
  }

  if (c.complete) {
    h += `<section class="card highlight">
      <h2>Cycle ${c.number} complete 🎉</h2>
      <p class="muted">Review next cycle's training maxes. Suggestions add each lift's increment, or reset 10% if a PR set missed its minimum reps.</p>
      ${mainLifts().map((e) => {
        const s = core.suggestNextTm(e, S.workouts, c.number, S.settings.rounding);
        return `<div class="row-field"><div><strong>${esc(e.name)}</strong><div class="muted small">Now ${wt(e.tm)} · ${esc(s.reason)}</div></div>
          <input type="text" inputmode="decimal" class="narrow" data-nexttm="${e.id}" value="${s.tm ?? ''}"></div>`;
      }).join('')}
      <button class="btn primary block" data-action="next-cycle">Start cycle ${c.number + 1}</button>
    </section>`;
  }

  h += `<div class="chips" role="tablist" aria-label="Week">${ws.map((wk, i) => `
    <button class="chip ${i + 1 === c.week ? 'active' : ''}" data-action="set-week" data-week="${i + 1}">W${i + 1} · ${esc(wk.key === '531' ? '5/3/1' : wk.key === 'deload' ? 'Deload' : wk.key)}</button>`).join('')}</div>`;

  h += `<div class="list">`;
  for (const t of S.templates) {
    const lift = exById(t.mainLiftId);
    const isDone = done.has(t.id);
    const supp = t.supplemental?.type && t.supplemental.type !== 'none' ? core.SUPPLEMENTAL_TYPES[t.supplemental.type]?.label.replace(/ \(.*\)/, '') : null;
    h += `<article class="card session ${isDone ? 'is-done' : ''}">
      <div class="session-main">
        <div class="eyebrow">${isDone ? '✓ Done this week' : esc(lift?.name || 'Custom session')}</div>
        <h3>${esc(t.name)}</h3>
        <div class="mono">${weekPreview(lift, week)}</div>
        <div class="muted small">${[supp, ...(t.accessories || []).map((a) => exById(a.exerciseId)?.name).filter(Boolean)].filter(Boolean).map(esc).join(' · ') || 'No extra work'}</div>
      </div>
      <button class="btn ${isDone ? '' : 'primary'} small" data-action="start-session" data-id="${t.id}">${isDone ? 'Again' : 'Start'}</button>
    </article>`;
  }
  h += `</div>
    <button class="btn block ghost" data-action="start-empty">+ Start an empty workout</button>
    <a class="btn block ghost" href="#/lifts/days">Edit training days & main lifts</a>`;
  return h;
}

function newWorkout(fields) {
  return {
    id: core.uid(), templateId: null, name: 'Workout', date: core.isoDate(), startedAt: new Date().toISOString(),
    cycle: S.cycle.number, week: S.cycle.week, weekLabel: weeks()[S.cycle.week - 1].label, entries: [], notes: '', ...fields,
  };
}

function startSession(templateId) {
  if (S.activeWorkout && !confirm('Discard the workout in progress and start a new one?')) return;
  const t = S.templates.find((x) => x.id === templateId);
  if (!t) return;
  const { week, entries } = core.buildSession({ template: t, exercises: S.exercises, settings: S.settings, weekIndex: S.cycle.week - 1, history: S.workouts });
  entries.forEach((e) => { e.tm = exById(e.exerciseId)?.tm ?? null; });
  S.activeWorkout = newWorkout({ templateId: t.id, name: t.name, weekLabel: week.label, entries });
  persist();
  go('#/workout/active');
}

function maybeAdvanceWeek(w) {
  const c = S.cycle;
  if (!w.templateId || w.cycle !== c.number || w.week !== c.week || c.complete) return;
  const done = doneTemplatesThisWeek();
  if (!S.templates.every((t) => done.has(t.id))) return;
  if (c.week < weeks().length) {
    c.week += 1;
    toast(`Week complete — on to ${weeks()[c.week - 1].label}`);
  } else {
    c.complete = true;
    toast('Cycle complete! Review your training maxes.');
  }
}

// ---------- Workout editor ----------
function currentWorkout() {
  const [route, arg] = parseHash();
  if (route !== 'workout') return null;
  return arg === 'active' ? S.activeWorkout : S.workouts.find((w) => w.id === arg) || null;
}

function setLabel(entry, s, si) {
  if (s.kind === 'warmup') return 'W';
  const same = entry.sets.filter((x) => x.kind === s.kind);
  return String(same.indexOf(s) + 1);
}

function setMeta(w, entry, s) {
  const parts = [];
  const firstOfWeight = entry.sets.find((x) => x.weight === s.weight) === s;
  if ((entry.role === 'main' || (entry.role === 'supplemental' && firstOfWeight)) && s.weight > 0) parts.push(`<span>${plateText(s.weight)}</span>`);
  if (s.amrap && s.weight > 0) {
    const f = S.settings.formula;
    const best = core.bestE1rm(S.workouts, entry.exerciseId, f, w.id);
    if (s.reps > 0) {
      const e = core.e1rm(s.weight, s.reps, f);
      const isPr = best > 0 && e > best + 1e-9;
      parts.push(`<span class="${isPr ? 'pr' : ''}">e1RM ${wt(Math.round(e))}${isPr ? ' · 🏆 PR' : ''}${s.reps < s.targetReps ? ' · below minimum' : ''}</span>`);
    } else if (best > 0) {
      const r = core.repsToBeat(s.weight, best, f);
      parts.push(`<span class="hint">${r ? `${r} reps beats your e1RM PR (${wt(Math.round(best))})` : `PR of ${wt(Math.round(best))} out of reach here`}</span>`);
    } else {
      parts.push('<span class="hint">PR set — as many reps as possible</span>');
    }
  }
  return parts.join('');
}

function entrySubtitle(entry) {
  if (entry.role === 'main') return entry.tm > 0 ? `Main · TM ${wt(entry.tm)}` : 'Main lift · no training max';
  if (entry.role === 'supplemental') {
    const s = entry.sets[0];
    return `${esc(entry.label || 'Supplemental')} · ${entry.sets.length}×${s?.targetReps ?? ''}${s?.pct ? ` @ ${pct(s.pct)}` : ''}`;
  }
  const last = core.lastPerformance(S.workouts.filter((x) => x.id !== currentWorkout()?.id), entry.exerciseId);
  if (!last) return 'Accessory';
  return `Last ${dateFmt(last.date, { month: 'short', day: 'numeric' })}: ${last.sets.map((s) => `${s.weight > 0 ? wt(s.weight) + '×' : ''}${s.reps ?? '?'}`).join(', ')}`;
}

function viewWorkout(w, mode) {
  const active = mode === 'active';
  const prs = ui.justFinished === w.id ? core.findPRs(w, S.workouts, S.settings.formula) : [];
  const sub = `${dateFmt(w.date)}${w.templateId ? ` · Cycle ${w.cycle} · ${esc(w.weekLabel || '')}` : ''}`;
  let h = active
    ? header(esc(w.name), `${sub} · <span id="elapsed">0:00</span>`)
    : backHeader(esc(w.name), '#/history', sub);

  if (ui.justFinished === w.id) {
    const vol = core.workoutVolume(w);
    h += `<section class="card highlight"><h2>Workout saved 💪</h2>
      <p class="muted">${w.durationSec ? `${Math.round(w.durationSec / 60)} min · ` : ''}${wt(Math.round(vol))} ${unit()} volume</p>
      ${prs.length ? prs.map((p) => `<div class="pr-line">🏆 <strong>${esc(p.name)}</strong> e1RM ${wt(Math.round(p.e1rm))} <span class="muted">(was ${wt(Math.round(p.previous))}) · ${wt(p.weight)}×${p.reps}</span></div>`).join('') : '<p class="muted small">No new e1RM PRs this time — keep stacking reps.</p>'}
      <a class="btn block" href="#/today">Done</a></section>`;
  }

  w.entries.forEach((e, ei) => {
    h += `<section class="card entry">
      <div class="entry-head">
        <div><h3>${esc(e.name)}</h3><div class="muted small">${entrySubtitle(e)}</div></div>
        <span class="badge ${e.role}">${e.role === 'main' ? 'Main' : e.role === 'supplemental' ? 'Supp' : 'Acc'}</span>
      </div>
      <div class="set head"><span>Set</span><span>${unit()}</span><span></span><span>Reps</span><span></span></div>
      ${e.sets.map((s, si) => `
        <div class="set ${s.done ? 'done' : ''} ${s.kind}">
          <span class="set-label"><b>${setLabel(e, s, si)}</b>${s.pct ? `<i>${pct(s.pct)}</i>` : ''}</span>
          <input type="text" inputmode="decimal" aria-label="Weight" data-e="${ei}" data-s="${si}" data-field="weight" value="${s.weight ?? ''}" placeholder="—">
          <span class="x">×</span>
          <input type="text" inputmode="numeric" aria-label="Reps" class="${s.amrap ? 'amrap' : ''}" data-e="${ei}" data-s="${si}" data-field="reps" value="${s.reps ?? ''}" placeholder="${s.targetReps ?? ''}${s.amrap ? '+' : ''}">
          <button class="check" aria-label="Mark set done" aria-pressed="${s.done}" data-action="toggle-set" data-e="${ei}" data-s="${si}">✓</button>
        </div>
        <div class="set-meta" id="meta-${ei}-${si}">${setMeta(w, e, s)}</div>`).join('')}
      <div class="entry-foot">
        <button class="link" data-action="add-set" data-e="${ei}">+ Set</button>
        <button class="link" data-action="remove-set" data-e="${ei}" ${e.sets.length ? '' : 'disabled'}>− Set</button>
        <button class="link danger" data-action="remove-entry" data-e="${ei}">Remove</button>
      </div>
    </section>`;
  });

  h += `<button class="btn block ghost" data-action="pick-exercise">+ Add exercise</button>
    <section class="card">
      ${active ? '' : `<label class="field"><span>Date</span><input type="date" data-wfield="date" value="${w.date}"></label>`}
      <label class="field"><span>Notes</span><textarea rows="3" data-wfield="notes" placeholder="How did it feel?">${esc(w.notes)}</textarea></label>
    </section>`;
  h += active
    ? `<div class="actions"><button class="btn danger-ghost" data-action="discard-workout">Discard</button><button class="btn primary grow" data-action="finish-workout">Finish workout</button></div>`
    : `<div class="actions"><button class="btn danger-ghost" data-action="delete-workout">Delete workout</button></div>`;
  return h;
}

function finishWorkout() {
  const w = S.activeWorkout;
  const sets = w.entries.flatMap((e) => e.sets);
  const done = sets.filter((s) => s.done).length;
  if (!done) {
    if (confirm('No sets are checked off. Discard this workout instead?')) discardWorkout(true);
    return;
  }
  if (done < sets.length && !confirm(`${sets.length - done} set(s) aren't checked off. Finish anyway?`)) return;
  w.finishedAt = new Date().toISOString();
  w.durationSec = Math.round((Date.parse(w.finishedAt) - Date.parse(w.startedAt)) / 1000);
  S.workouts.push(w);
  S.activeWorkout = null;
  maybeAdvanceWeek(w);
  persist();
  stopRest();
  ui.justFinished = w.id;
  go(`#/workout/${w.id}`);
}

function discardWorkout(skipConfirm) {
  if (!skipConfirm && !confirm('Discard this workout? Nothing will be saved.')) return;
  S.activeWorkout = null;
  persist();
  stopRest();
  go('#/today');
}

function addEntry(exerciseId) {
  const w = currentWorkout();
  const ex = exById(exerciseId);
  if (!w || !ex) return;
  const last = core.lastPerformance(S.workouts, ex.id);
  const weight = last?.sets[0]?.weight ?? null;
  const reps = last?.sets[0]?.reps ?? (ex.category === 'main' ? 5 : 10);
  w.entries.push({
    id: core.uid(), exerciseId: ex.id, name: ex.name, role: 'accessory', tm: ex.tm ?? null,
    sets: Array.from({ length: 3 }, () => ({ kind: 'accessory', pct: null, weight, targetReps: reps, reps: null, amrap: false, done: false })),
  });
  persist();
  closeSheet();
  render();
}

function openExercisePicker() {
  const groups = [['Main lifts', mainLifts()], ['Accessories', S.exercises.filter((e) => e.category !== 'main')]];
  openSheet(`
    <div class="sheet-head"><h2>Add exercise</h2><button class="link" data-action="close-sheet">Close</button></div>
    <input type="search" class="search" placeholder="Search" data-filter="picker">
    <div class="picker">${groups.map(([title, list]) => `
      <div class="group-title">${title}</div>
      ${list.map((e) => `<button class="pick" data-action="add-entry" data-id="${e.id}" data-name="${esc(e.name.toLowerCase())}">${esc(e.name)}</button>`).join('')}`).join('')}
    </div>
    <div class="row-field"><input type="text" placeholder="New exercise name" data-newex><button class="btn small" data-action="create-and-add">Create</button></div>`);
}

// ---------- History ----------
function workoutCard(w) {
  const main = w.entries.find((e) => e.role === 'main') || w.entries[0];
  let best = '';
  if (main) {
    const p = core.e1rmHistory([w], main.exerciseId, S.settings.formula)[0];
    if (p) best = `${esc(main.name)} ${wt(p.weight)}×${p.reps} · e1RM ${wt(Math.round(p.e1rm))}`;
  }
  const sets = w.entries.flatMap((e) => e.sets).filter((s) => s.done).length;
  return `<a class="card workout-card" href="#/workout/${w.id}">
    <div class="wc-date"><b>${core.parseIsoDate(w.date).getDate()}</b><span>${dateFmt(w.date, { weekday: 'short' })}</span></div>
    <div class="wc-body"><strong>${esc(w.name)}</strong>
      <div class="muted small">${w.templateId ? `C${w.cycle} · ${esc(w.weekLabel || '')} · ` : ''}${sets} sets · ${wt(Math.round(core.workoutVolume(w)))} ${unit()}</div>
      ${best ? `<div class="small mono">${best}</div>` : ''}</div>
    <span class="chev">›</span></a>`;
}

function viewHistory() {
  const seg = `<div class="segmented">
    <button class="${ui.historyMode === 'calendar' ? 'active' : ''}" data-action="history-mode" data-mode="calendar">Calendar</button>
    <button class="${ui.historyMode === 'list' ? 'active' : ''}" data-action="history-mode" data-mode="list">List</button></div>`;
  let h = header('History', `${S.workouts.length} workout${S.workouts.length === 1 ? '' : 's'} logged`) + seg;

  if (ui.historyMode === 'list') {
    if (!S.workouts.length) return h + '<p class="empty">No workouts yet. Finish a session and it shows up here.</p>';
    let month = '';
    for (const w of sortByDateDesc(S.workouts)) {
      const m = w.date.slice(0, 7);
      if (m !== month) { month = m; h += `<div class="group-title">${dateFmt(`${m}-01`, { month: 'long', year: 'numeric' })}</div>`; }
      h += workoutCard(w);
    }
    return h;
  }

  const [y, m] = ui.calMonth.split('-').map(Number);
  const byDate = {};
  for (const w of S.workouts) (byDate[w.date] ||= []).push(w);
  const today = core.isoDate();
  const inMonth = S.workouts.filter((w) => w.date.startsWith(ui.calMonth)).length;
  const dow = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  h += `<section class="card calendar">
    <div class="cal-head">
      <button class="icon-btn" data-action="cal-move" data-delta="-1" aria-label="Previous month">‹</button>
      <div><strong>${dateFmt(`${ui.calMonth}-01`, { month: 'long', year: 'numeric' })}</strong><div class="muted small">${inMonth} workout${inMonth === 1 ? '' : 's'}</div></div>
      <button class="icon-btn" data-action="cal-move" data-delta="1" aria-label="Next month">›</button>
    </div>
    <div class="cal-grid">${dow.map((d) => `<span class="dow">${d}</span>`).join('')}
      ${core.monthGrid(y, m - 1).flat().map((d) => {
        if (!d) return '<span></span>';
        const ws = byDate[d] || [];
        const cls = [ws.length ? 'has' : '', d === today ? 'today' : '', d === ui.calSelected ? 'sel' : ''].join(' ');
        const deload = ws.some((w) => /deload/i.test(w.weekLabel || ''));
        return `<button class="day ${cls}" data-action="cal-select" data-date="${d}">${Number(d.slice(8))}${ws.length ? `<i class="${deload ? 'deload' : ''}"></i>` : ''}</button>`;
      }).join('')}
    </div></section>`;

  const sel = byDate[ui.calSelected] || [];
  h += `<div class="group-title">${dateFmt(ui.calSelected, { weekday: 'long', month: 'long', day: 'numeric' })}</div>`;
  h += sel.length ? sel.map(workoutCard).join('') : '<p class="empty">Rest day.</p>';
  h += `<button class="btn block ghost" data-action="log-past" data-date="${ui.calSelected}">+ Log a workout on this day</button>`;
  return h;
}

// ---------- Progress ----------
function lineChart(series) {
  const W = 340, H = 200, L = 40, R = 10, T = 12, B = 26;
  const pts = series.flatMap((s) => s.points);
  if (!pts.length) return '<p class="empty">No data in this range yet.</p>';
  let t0 = Math.min(...pts.map((p) => p.t)), t1 = Math.max(...pts.map((p) => p.t));
  if (t0 === t1) { t0 -= 86400000 * 3; t1 += 86400000 * 3; }
  let y0 = Math.min(...pts.map((p) => p.y)), y1 = Math.max(...pts.map((p) => p.y));
  const padY = Math.max((y1 - y0) * 0.12, 5);
  y0 = Math.max(0, y0 - padY); y1 += padY;
  const x = (t) => L + ((t - t0) / (t1 - t0)) * (W - L - R);
  const y = (v) => T + (1 - (v - y0) / (y1 - y0)) * (H - T - B);
  const ticks = [0, 1, 2, 3].map((i) => y0 + ((y1 - y0) * i) / 3);
  let svg = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Estimated one rep max over time">`;
  for (const v of ticks) svg += `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text class="axis" x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${Math.round(v)}</text>`;
  const dl = (t) => new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  svg += `<text class="axis" x="${L}" y="${H - 6}">${dl(t0)}</text><text class="axis" x="${W - R}" y="${H - 6}" text-anchor="end">${dl(t1)}</text>`;
  for (const s of series) {
    if (!s.points.length) continue;
    const sorted = [...s.points].sort((a, b) => a.t - b.t);
    let d = '';
    sorted.forEach((p, i) => {
      if (i === 0) d += `M${x(p.t)},${y(p.y)}`;
      else d += s.step ? `H${x(p.t)}V${y(p.y)}` : `L${x(p.t)},${y(p.y)}`;
    });
    if (s.step) d += `H${W - R}`;
    svg += `<path class="line ${s.cls}" d="${d}"/>`;
    if (!s.step) {
      for (const p of sorted) svg += `<circle class="dot ${s.cls}" cx="${x(p.t)}" cy="${y(p.y)}" r="${sorted.length > 40 ? 2.5 : 4}" data-action="chart-point" data-info="${esc(p.info)}"><title>${esc(p.info)}</title></circle>`;
    }
  }
  return svg + '</svg>';
}

function viewProgress(exId) {
  const withData = S.exercises.filter((e) => core.e1rmHistory(S.workouts, e.id, S.settings.formula).length);
  const ex = exById(exId) || withData.find((e) => e.category === 'main') || withData[0] || mainLifts()[0];
  if (!ex) return header('Progress') + '<p class="empty">Add an exercise to start tracking.</p>';
  const f = S.settings.formula;
  const cutoff = { '3m': 91, '6m': 182, '1y': 365 }[ui.progressRange];
  const since = cutoff ? core.isoDate(new Date(Date.now() - cutoff * 86400000)) : '0000';
  const hist = core.e1rmHistory(S.workouts, ex.id, f).filter((p) => p.date >= since);
  const allHist = core.e1rmHistory(S.workouts, ex.id, f);
  const best = allHist.reduce((m, p) => (p.e1rm > (m?.e1rm ?? 0) ? p : m), null);
  const latest = allHist.at(-1);
  const tmPts = S.tmHistory.filter((h) => h.exerciseId === ex.id && h.date >= since).map((h) => ({ t: core.parseIsoDate(h.date).getTime(), y: h.tm, info: `TM ${wt(h.tm)} · ${dateFmt(h.date)}` }));
  const recs = core.repRecords(S.workouts, ex.id);

  const options = [...new Set([...mainLifts(), ...withData])];
  let h = header('Progress', `Estimated 1RM via ${core.FORMULAS[f]}`);
  h += `<label class="field"><span>Exercise</span><select data-action-change="progress-ex">${options.map((e) => `<option value="${e.id}" ${e.id === ex.id ? 'selected' : ''}>${esc(e.name)}</option>`).join('')}</select></label>`;
  h += `<div class="stats">
    <div class="stat"><span>Best e1RM</span><b>${best ? wt(Math.round(best.e1rm)) : '—'}</b><i>${best ? `${wt(best.weight)}×${best.reps} · ${dateFmt(best.date, { month: 'short', day: 'numeric' })}` : unit()}</i></div>
    <div class="stat"><span>Latest e1RM</span><b>${latest ? wt(Math.round(latest.e1rm)) : '—'}</b><i>${latest ? dateFmt(latest.date, { month: 'short', day: 'numeric' }) : unit()}</i></div>
    <div class="stat"><span>Training max</span><b>${ex.tm > 0 ? wt(ex.tm) : '—'}</b><i>${ex.tm > 0 && best ? `${Math.round((ex.tm / best.e1rm) * 100)}% of best` : unit()}</i></div>
  </div>`;
  h += `<section class="card"><div class="chips compact">${['3m', '6m', '1y', 'all'].map((r) => `<button class="chip ${ui.progressRange === r ? 'active' : ''}" data-action="progress-range" data-range="${r}">${r.toUpperCase()}</button>`).join('')}</div>
    ${lineChart([
      { cls: 'tm', step: true, points: tmPts },
      { cls: 'e1rm', points: hist.map((p) => ({ t: core.parseIsoDate(p.date).getTime(), y: p.e1rm, info: `${dateFmt(p.date)} · ${wt(p.weight)}×${p.reps} → e1RM ${wt(Math.round(p.e1rm))}` })) },
    ])}
    <div class="legend"><span class="key e1rm"></span>e1RM <span class="key tm"></span>Training max</div>
    <p class="chart-info muted small" id="chart-info">${esc(ui.chartInfo) || 'Tap a point for details.'}</p></section>`;

  h += `<section class="card"><h2>Rep records</h2>${Object.keys(recs).length ? `<div class="rep-grid">${Object.entries(recs).map(([r, v]) => `<div><span>${r}RM</span><b>${wt(v.weight)}</b><i>${dateFmt(v.date, { month: 'short', day: 'numeric' })}</i></div>`).join('')}</div>` : '<p class="muted">No sets logged yet.</p>'}</section>`;
  if (allHist.length) {
    h += `<section class="card"><h2>Recent sessions</h2><table class="table"><thead><tr><th>Date</th><th>Best set</th><th>e1RM</th></tr></thead><tbody>
      ${[...allHist].reverse().slice(0, 12).map((p) => `<tr data-action="open-workout" data-id="${p.workoutId}"><td>${dateFmt(p.date, { month: 'short', day: 'numeric', year: '2-digit' })}</td><td>${wt(p.weight)} × ${p.reps}</td><td>${wt(Math.round(p.e1rm))}</td></tr>`).join('')}
    </tbody></table></section>`;
  }
  return h;
}

// ---------- Program: lifts & sessions ----------
function viewProgram() {
  const seg = `<div class="segmented">
    <button class="${ui.programTab === 'lifts' ? 'active' : ''}" data-action="program-tab" data-tab="lifts">Exercises</button>
    <button class="${ui.programTab === 'sessions' ? 'active' : ''}" data-action="program-tab" data-tab="sessions">Training days</button></div>`;
  let h = header('Program', 'Customize exercises and training days') + seg;
  if (ui.programTab === 'sessions') {
    const n = S.templates.length;
    h += `<section class="card"><div class="setting">
      <div><span><b>Training days per week</b></span><small>Days run in this order. The week advances once every day is done.</small></div>
      <div class="stepper"><button class="icon-btn" data-action="days" data-delta="-1" aria-label="Remove a day" ${n <= 1 ? 'disabled' : ''}>−</button><b>${n}</b><button class="icon-btn" data-action="days" data-delta="1" aria-label="Add a day" ${n >= 7 ? 'disabled' : ''}>+</button></div>
    </div></section>`;
    S.templates.forEach((t, i) => {
      const lift = exById(t.mainLiftId);
      h += `<div class="card row-card">
        <a href="#/session/${t.id}" class="grow"><div class="eyebrow">Day ${i + 1}</div><strong>${esc(t.name)}</strong><div class="muted small">Main: ${esc(lift?.name || 'none')}${lift ? ` (TM ${wt(lift.tm)} ${unit()})` : ''} · ${esc(core.SUPPLEMENTAL_TYPES[t.supplemental?.type || 'none']?.label.replace(/ \(.*\)/, '') || '')} · ${(t.accessories || []).length} accessories</div></a>
        <button class="icon-btn" data-action="move-session" data-i="${i}" data-delta="-1" ${i === 0 ? 'disabled' : ''} aria-label="Move up">↑</button>
        <button class="icon-btn" data-action="move-session" data-i="${i}" data-delta="1" ${i === S.templates.length - 1 ? 'disabled' : ''} aria-label="Move down">↓</button>
      </div>`;
    });
    return h;
  }
  const row = (e) => {
    const best = core.bestE1rm(S.workouts, e.id, S.settings.formula);
    return `<a class="card row-card" href="#/exercise/${e.id}"><div class="grow"><strong>${esc(e.name)}</strong>
      <div class="muted small">${e.category === 'main' ? `TM ${wt(e.tm)} · ` : ''}${best ? `e1RM ${wt(Math.round(best))}` : 'No history'}</div></div><span class="chev">›</span></a>`;
  };
  h += `<div class="group-title">Main 5/3/1 lifts</div>${mainLifts().map(row).join('')}`;
  h += `<div class="group-title">Accessories</div>${S.exercises.filter((e) => e.category !== 'main').map(row).join('')}`;
  return h + `<a class="btn block ghost" href="#/exercise/new">+ New exercise</a>`;
}

function ensureDraft(key, make) {
  if (ui.draftKey !== key) { ui.draftKey = key; ui.draft = make(); }
  return ui.draft;
}

function viewExercise(id) {
  const existing = exById(id);
  if (id !== 'new' && !existing) return backHeader('Not found', '#/lifts');
  const d = ensureDraft(`ex:${id}`, () => (existing ? JSON.parse(JSON.stringify(existing)) : { id: core.uid(), name: '', category: 'accessory', tm: null, increment: store.UNIT_DEFAULTS[unit()].upperInc, notes: '' }));
  let h = backHeader(id === 'new' ? 'New exercise' : esc(existing.name), '#/lifts');
  h += `<section class="card">
    <label class="field"><span>Name</span><input type="text" data-draft="name" value="${esc(d.name)}" placeholder="e.g. Front Squat"></label>
    <label class="field"><span>Type</span><select data-draft="category" data-rerender>
      <option value="main" ${d.category === 'main' ? 'selected' : ''}>Main lift (5/3/1 percentages)</option>
      <option value="accessory" ${d.category !== 'main' ? 'selected' : ''}>Accessory / assistance</option></select></label>`;
  if (d.category === 'main') {
    h += `<label class="field"><span>Training max (${unit()})</span><input type="text" inputmode="decimal" data-draft="tm" data-num value="${d.tm ?? ''}"></label>
      <label class="field"><span>Increase per cycle (${unit()})</span><input type="text" inputmode="decimal" data-draft="increment" data-num value="${d.increment ?? ''}"></label>`;
  }
  h += `<label class="field"><span>Notes</span><textarea rows="2" data-draft="notes" placeholder="Cues, setup, equipment">${esc(d.notes || '')}</textarea></label></section>`;
  if (d.category === 'main' && d.tm > 0) {
    h += `<section class="card"><h2>This cycle</h2><table class="table"><thead><tr><th>Week</th><th>Set 1</th><th>Set 2</th><th>Set 3</th></tr></thead><tbody>
      ${weeks().map((wk) => `<tr><td>${esc(wk.label)}</td>${wk.sets.map((s) => `<td>${wt(core.roundTo(d.tm * s.pct, S.settings.rounding))}×${s.reps}${s.amrap ? '+' : ''}</td>`).join('')}</tr>`).join('')}
    </tbody></table></section>`;
  }
  h += `<div class="actions">${existing ? '<button class="btn danger-ghost" data-action="delete-exercise">Delete</button>' : ''}
    <button class="btn primary grow" data-action="save-exercise">Save</button></div>`;
  if (existing) h += `<a class="btn block ghost" href="#/progress/${existing.id}">View progress</a>`;
  return h;
}

function viewSession(id) {
  const existing = S.templates.find((t) => t.id === id);
  if (id !== 'new' && !existing) return backHeader('Not found', '#/lifts');
  const d = ensureDraft(`session:${id}`, () => (existing ? JSON.parse(JSON.stringify(existing)) : {
    id: core.uid(), name: 'New Session', mainLiftId: mainLifts()[0]?.id ?? null, supplemental: { type: 'fsl', liftId: null, sets: 5, reps: 5, pct: null }, accessories: [],
  }));
  d.supplemental ||= { type: 'none' };
  const sType = d.supplemental.type || 'none';
  const mainLift = exById(d.mainLiftId);
  const opt = (list, sel, blank) => (blank ? `<option value="" ${!sel ? 'selected' : ''}>${blank}</option>` : '') + list.map((e) => `<option value="${e.id}" ${e.id === sel ? 'selected' : ''}>${esc(e.name)}</option>`).join('');
  let h = backHeader(id === 'new' ? 'New training day' : esc(existing.name), '#/lifts/days');
  h += `<section class="card">
    <label class="field"><span>Name</span><input type="text" data-draft="name" value="${esc(d.name)}"></label>
    <label class="field"><span>Main lift</span><select data-draft="mainLiftId" data-rerender>
      <option value="" ${!d.mainLiftId ? 'selected' : ''}>None (accessories only)</option>
      <optgroup label="Main lifts">${opt(mainLifts(), d.mainLiftId)}</optgroup>
      <optgroup label="Other exercises (becomes a main lift)">${opt(S.exercises.filter((e) => e.category !== 'main'), d.mainLiftId)}</optgroup>
    </select></label>
    ${mainLift ? `<label class="field"><span>${esc(mainLift.name)} training max (${unit()})</span><input type="text" inputmode="decimal" data-draft="_tm" data-num value="${d._tm ?? mainLift.tm ?? ''}" placeholder="e.g. ${unit() === 'kg' ? 100 : 225}"></label>` : ''}
  </section>
  <section class="card"><h2>Supplemental</h2>
    <label class="field"><span>Template</span><select data-draft="supplemental.type" data-rerender>
      ${Object.entries(core.SUPPLEMENTAL_TYPES).map(([k, v]) => `<option value="${k}" ${k === sType ? 'selected' : ''}>${v.label}</option>`).join('')}</select></label>`;
  if (sType !== 'none') {
    const def = core.SUPPLEMENTAL_TYPES[sType];
    h += `<label class="field"><span>Lift</span><select data-draft="supplemental.liftId">${opt(mainLifts().filter((e) => e.id !== d.mainLiftId), d.supplemental.liftId, 'Same as main lift')}</select></label>
      <div class="grid3">
        <label class="field"><span>Sets</span><input type="text" inputmode="numeric" data-draft="supplemental.sets" data-num value="${d.supplemental.sets ?? def.sets}"></label>
        <label class="field"><span>Reps</span><input type="text" inputmode="numeric" data-draft="supplemental.reps" data-num value="${d.supplemental.reps ?? def.reps}"></label>
        ${sType === 'bbb' || sType === 'custom'
          ? `<label class="field"><span>% of TM</span><input type="text" inputmode="decimal" data-draft="supplemental.pct" data-pct value="${Math.round((d.supplemental.pct ?? def.pct) * 100)}"></label>`
          : `<div class="field"><span>% of TM</span><div class="muted small pad">${sType === 'ssl' ? 'Second' : 'First'} set %</div></div>`}
      </div>`;
  }
  h += `</section><section class="card"><h2>Accessories</h2>
    ${(d.accessories || []).map((a, i) => `<div class="acc-row">
      <select data-draft="accessories.${i}.exerciseId">${opt(S.exercises, a.exerciseId)}</select>
      <input type="text" inputmode="numeric" aria-label="Sets" data-draft="accessories.${i}.sets" data-num value="${a.sets}"><span class="x">×</span>
      <input type="text" inputmode="numeric" aria-label="Reps" data-draft="accessories.${i}.reps" data-num value="${a.reps}">
      <button class="icon-btn" data-action="acc-move" data-i="${i}" data-delta="-1" aria-label="Move up" ${i === 0 ? 'disabled' : ''}>↑</button>
      <button class="icon-btn danger" data-action="acc-remove" data-i="${i}" aria-label="Remove">×</button></div>`).join('') || '<p class="muted small">No accessories yet.</p>'}
    <button class="link" data-action="acc-add">+ Add accessory</button></section>
    <div class="actions">${existing ? '<button class="btn danger-ghost" data-action="delete-session">Delete</button>' : ''}
      <button class="btn primary grow" data-action="save-session">Save training day</button></div>`;
  return h;
}

// ---------- Settings & tools ----------
function viewSettings() {
  const s = S.settings;
  const sel = (key, opts) => `<select data-setting="${key}">${opts.map(([v, l]) => `<option value="${v}" ${String(s[key]) === String(v) ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
  const tog = (key) => `<input type="checkbox" class="switch" data-setting="${key}" data-type="bool" ${s[key] ? 'checked' : ''}>`;
  const numIn = (key, extra = '') => `<input type="text" inputmode="decimal" class="narrow" data-setting="${key}" data-type="num" value="${s[key]}" ${extra}>`;
  const row = (label, ctl, help = '') => `<div class="setting"><div><span>${label}</span>${help ? `<small>${help}</small>` : ''}</div>${ctl}</div>`;
  const ws = weeks();
  return header('Settings') + `
  <section class="card"><h2>Units & loading</h2>
    ${row('Units', sel('unit', [['lb', 'Pounds (lb)'], ['kg', 'Kilograms (kg)']]))}
    ${row('Round weights to', numIn('rounding'), unit())}
    ${row('Bar weight', numIn('barWeight'), unit())}
    ${row('Plates available', `<input type="text" class="wide" data-setting="plates" data-type="list" value="${s.plates.join(', ')}">`, 'Per side, comma separated')}
  </section>
  <section class="card"><h2>5/3/1 program</h2>
    ${row('Week order', sel('weekOrder', [['531', '5s, 3s, 5/3/1'], ['351', '3s, 5s, 5/3/1']]))}
    ${row('Main sets', sel('mainStyle', [['amrap', 'Classic PR sets (+)'], ['fivespro', "5's PRO (no AMRAP)"]]))}
    ${row('Deload week', tog('deload'), 'Adds week 4 at 40/50/60%')}
    ${row('Supplemental on deload', tog('deloadSupplemental'))}
    ${row('Warm-up sets', tog('warmups'), '40/50/60% before working sets')}
    ${row('e1RM formula', sel('formula', Object.entries(core.FORMULAS)))}
  </section>
  <section class="card"><h2>Rest timer</h2>
    ${row('After main sets', numIn('restMain'), 'seconds (0 = off)')}
    ${row('After other sets', numIn('restOther'), 'seconds (0 = off)')}
    ${row('Sound when done', tog('restSound'))}
  </section>
  <section class="card"><h2>Current cycle</h2>
    ${row('Cycle number', `<input type="text" inputmode="numeric" class="narrow" data-cycle="number" value="${S.cycle.number}">`)}
    ${row('Week', `<select data-cycle="week">${ws.map((w, i) => `<option value="${i + 1}" ${S.cycle.week === i + 1 ? 'selected' : ''}>${i + 1} · ${esc(w.label)}</option>`).join('')}</select>`)}
    <button class="link" data-action="force-cycle-end">End cycle now & review training maxes</button>
  </section>
  <section class="card"><h2>Data</h2>
    <p class="muted small">Everything is stored on this device only. Export a backup now and then — iOS can clear website data if the app goes unused for weeks.</p>
    <div class="btn-row"><button class="btn" data-action="export-json">Export backup</button><button class="btn" data-action="import-json">Import backup</button><button class="btn" data-action="export-csv">Export CSV</button></div>
    <input type="file" accept="application/json,.json" id="import-file" hidden>
    <button class="link danger" data-action="reset-all">Erase all data</button>
  </section>
  <section class="card"><h2>Install on iPhone</h2>
    <p class="muted small">Open this page in Safari, tap <b>Share</b> → <b>Add to Home Screen</b>. It launches full screen and works offline.</p>
  </section>`;
}

function viewTools() {
  const t = ui.tools;
  return backHeader('Calculators', '#/today') + `
  <section class="card"><h2>Plate calculator</h2>
    <label class="field"><span>Total weight (${unit()})</span><input type="text" inputmode="decimal" data-tool="plates" value="${esc(t.plates)}" placeholder="e.g. ${unit() === 'kg' ? 100 : 225}"></label>
    <div id="tool-plates">${toolPlates()}</div>
    <p class="muted small">Bar ${wt(S.settings.barWeight)} ${unit()} · plates ${S.settings.plates.map(wt).join(', ')} — change in Settings.</p>
  </section>
  <section class="card"><h2>1RM calculator</h2>
    <div class="grid2">
      <label class="field"><span>Weight</span><input type="text" inputmode="decimal" data-tool="weight" value="${esc(t.weight)}"></label>
      <label class="field"><span>Reps</span><input type="text" inputmode="numeric" data-tool="reps" value="${esc(t.reps)}"></label>
    </div>
    <div id="tool-1rm">${tool1rm()}</div>
  </section>`;
}

function toolPlates() {
  const total = num(ui.tools.plates);
  if (!(total > 0)) return '';
  const p = core.plateBreakdown(total, S.settings.barWeight, S.settings.plates);
  if (p.belowBar) return '<p class="muted">That is lighter than the bar.</p>';
  const max = Math.max(...S.settings.plates);
  return `<div class="bar-viz"><span class="sleeve"></span>${p.perSide.map((x) => `<span class="plate" style="--h:${40 + 60 * (x / max)}%">${wt(x)}</span>`).join('')}</div>
    <p><b>${p.perSide.length ? p.perSide.map(wt).join(' + ') : 'Nothing'}</b> per side${p.remainder ? ` <span class="muted">(${wt(p.remainder)} ${unit()} can't be loaded)</span>` : ''}</p>`;
}

function tool1rm() {
  const w = num(ui.tools.weight), r = num(ui.tools.reps);
  if (!(w > 0 && r > 0)) return '';
  const e = core.e1rm(w, r, S.settings.formula);
  return `<div class="stats">${Object.entries(core.FORMULAS).map(([k, l]) => `<div class="stat"><span>${l.split(' ')[0]}</span><b>${wt(Math.round(core.e1rm(w, r, k)))}</b></div>`).join('')}</div>
    <table class="table"><thead><tr><th>%</th><th>Weight</th><th>Reps ≈</th></tr></thead><tbody>
    ${[100, 95, 90, 85, 80, 75, 70, 65, 60].map((p) => {
      const pw = core.roundTo((e * p) / 100, S.settings.rounding);
      const reps = p === 100 ? 1 : Math.max(1, Math.round(30 * (100 / p - 1)));
      return `<tr><td>${p}%</td><td>${wt(pw)}</td><td>${reps}</td></tr>`;
    }).join('')}</tbody></table>`;
}

// ---------- sheet ----------
function openSheet(html) {
  sheet.querySelector('.sheet').innerHTML = html;
  sheet.hidden = false;
}
function closeSheet() { sheet.hidden = true; }
sheet.addEventListener('click', (e) => { if (e.target === sheet) closeSheet(); });

// ---------- rest timer ----------
let audioCtx = null;
function primeAudio() {
  try { audioCtx ||= new (window.AudioContext || window.webkitAudioContext)(); if (audioCtx.state === 'suspended') audioCtx.resume(); } catch { /* no audio */ }
}
function beep() {
  if (!S.settings.restSound || !audioCtx) return;
  try {
    [0, 0.25, 0.5].forEach((d) => {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.frequency.value = 880; o.connect(g); g.connect(audioCtx.destination);
      const t = audioCtx.currentTime + d;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.3, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
      o.start(t); o.stop(t + 0.2);
    });
  } catch { /* ignore */ }
}
function startRest(sec) {
  if (!(sec > 0)) return;
  ui.rest = { endsAt: Date.now() + sec * 1000, total: sec, fired: false };
  restEl.hidden = false;
  document.body.classList.add('resting');
  tick();
}
function stopRest() {
  ui.rest = null;
  restEl.hidden = true;
  document.body.classList.remove('resting');
}
const clock = (sec) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
function tick() {
  if (ui.rest) {
    const left = Math.max(0, (ui.rest.endsAt - Date.now()) / 1000);
    restEl.querySelector('.rest-time').textContent = left > 0 ? clock(Math.ceil(left)) : 'Go!';
    restEl.querySelector('.rest-fill').style.transform = `scaleX(${ui.rest.total ? left / ui.rest.total : 0})`;
    restEl.classList.toggle('over', left <= 0);
    if (left <= 0 && !ui.rest.fired) {
      ui.rest.fired = true;
      beep();
      navigator.vibrate?.([200, 100, 200]);
      setTimeout(() => { if (ui.rest?.fired) stopRest(); }, 6000);
    }
  }
  const el = document.getElementById('elapsed');
  if (el && S.activeWorkout) el.textContent = clock((Date.now() - Date.parse(S.activeWorkout.startedAt)) / 1000);
}
setInterval(tick, 500);

// ---------- data import/export ----------
async function shareOrDownload(text, name, type) {
  const blob = new Blob([text], { type });
  try {
    const file = new File([blob], name, { type });
    if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: name }); return; }
  } catch (e) { if (e?.name === 'AbortError') return; }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

function csv() {
  const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = [['date', 'workout', 'cycle', 'week', 'exercise', 'role', 'set_type', 'percent_tm', 'weight', 'unit', 'target_reps', 'reps', 'amrap', 'done', 'e1rm']];
  for (const w of sortByDateDesc(S.workouts).reverse()) {
    for (const e of w.entries) {
      for (const s of e.sets) {
        rows.push([w.date, w.name, w.templateId ? w.cycle : '', w.templateId ? w.weekLabel : '', e.name, e.role, s.kind, s.pct ? Math.round(s.pct * 100) : '', s.weight ?? '', unit(), s.targetReps ?? '', s.reps ?? '', s.amrap ? 1 : 0, s.done ? 1 : 0, s.done ? Math.round(core.e1rm(s.weight, s.reps, S.settings.formula)) || '' : '']);
      }
    }
  }
  return rows.map((r) => r.map(q).join(',')).join('\n');
}

// ---------- routing ----------
function parseHash() {
  const parts = (location.hash.replace(/^#\/?/, '') || 'today').split('/');
  return [parts[0], parts[1]];
}

const TAB_FOR = { today: 'today', workout: 'today', history: 'history', progress: 'progress', lifts: 'lifts', exercise: 'lifts', session: 'lifts', settings: 'settings', tools: 'today' };

function render() {
  const [route, arg] = parseHash();
  let html;
  switch (route) {
    case 'workout': {
      if (arg === 'active') {
        if (!S.activeWorkout) { go('#/today'); return; }
        html = viewWorkout(S.activeWorkout, 'active');
      } else {
        const w = S.workouts.find((x) => x.id === arg);
        html = w ? viewWorkout(w, 'saved') : backHeader('Workout not found', '#/history');
      }
      break;
    }
    case 'history': html = viewHistory(); break;
    case 'progress': html = viewProgress(arg); break;
    case 'lifts': if (arg === 'days') ui.programTab = 'sessions'; html = viewProgram(); break;
    case 'exercise': html = viewExercise(arg); break;
    case 'session': html = viewSession(arg); break;
    case 'settings': html = viewSettings(); break;
    case 'tools': html = viewTools(); break;
    default: html = viewToday();
  }
  view.innerHTML = html;
  let tab = TAB_FOR[route] || 'today';
  if (route === 'workout' && arg !== 'active') tab = 'history';
  document.querySelectorAll('.tabbar a').forEach((a) => a.classList.toggle('active', a.dataset.tab === tab));
  if (location.hash !== ui.lastHash) {
    if (!['exercise', 'session'].includes(route)) { ui.draftKey = null; ui.draft = null; }
    if (route !== 'workout') ui.justFinished = null;
    if (route !== 'progress') ui.chartInfo = '';
    ui.lastHash = location.hash;
    window.scrollTo(0, 0);
  }
  tick();
}
window.addEventListener('hashchange', render);

// ---------- path helpers for drafts ----------
function setPath(obj, path, value) {
  const keys = path.split('.');
  let o = obj;
  for (let i = 0; i < keys.length - 1; i++) o = o[keys[i]] ??= {};
  o[keys.at(-1)] = value;
}
function readDraftInput(el) {
  let v = el.value;
  if ('num' in el.dataset) v = num(v);
  else if ('pct' in el.dataset) v = num(v) == null ? null : num(v) / 100;
  else if (el.tagName === 'SELECT' && v === '') v = null;
  setPath(ui.draft, el.dataset.draft, v);
  if (el.dataset.draft === 'mainLiftId') delete ui.draft._tm;
}

// ---------- actions ----------
const actions = {
  'save-setup'() {
    let n = 0;
    document.querySelectorAll('[data-setup]').forEach((el) => {
      const v = num(el.value);
      const ex = exById(el.dataset.setup);
      if (ex && v > 0) { setTm(ex, v); n++; }
    });
    if (!n) { toast('Enter at least one training max'); return; }
    persist(); render(); toast('Training maxes saved');
  },
  'next-cycle'() {
    document.querySelectorAll('[data-nexttm]').forEach((el) => {
      const ex = exById(el.dataset.nexttm);
      const v = num(el.value);
      if (ex && v > 0) setTm(ex, v);
    });
    S.cycle = { number: S.cycle.number + 1, week: 1, done: [], complete: false, startedAt: new Date().toISOString() };
    persist(); render(); toast(`Cycle ${S.cycle.number} started`);
  },
  'set-unit'(el) { if (changeUnit(el.dataset.unit)) { persist(); render(); } },
  'set-week'(el) {
    S.cycle.week = Number(el.dataset.week);
    S.cycle.complete = false;
    persist(); render();
  },
  'start-session'(el) { startSession(el.dataset.id); },
  'start-empty'() {
    if (S.activeWorkout && !confirm('Discard the workout in progress and start a new one?')) return;
    S.activeWorkout = newWorkout({});
    persist(); go('#/workout/active');
  },
  'toggle-set'(el) {
    primeAudio();
    const w = currentWorkout();
    const e = w.entries[el.dataset.e];
    const s = e.sets[el.dataset.s];
    s.done = !s.done;
    if (s.done && s.reps == null && s.targetReps != null) s.reps = s.targetReps;
    persist();
    render();
    if (s.done && parseHash()[1] === 'active' && s.kind !== 'warmup') {
      startRest(e.role === 'main' ? S.settings.restMain : S.settings.restOther);
    }
  },
  'add-set'(el) {
    const e = currentWorkout().entries[el.dataset.e];
    const last = e.sets.at(-1);
    e.sets.push(last ? { ...last, amrap: false, done: false, reps: null } : { kind: 'accessory', pct: null, weight: null, targetReps: 10, reps: null, amrap: false, done: false });
    persist(); render();
  },
  'remove-set'(el) { currentWorkout().entries[el.dataset.e].sets.pop(); persist(); render(); },
  'remove-entry'(el) {
    const w = currentWorkout();
    if (!confirm(`Remove ${w.entries[el.dataset.e].name} from this workout?`)) return;
    w.entries.splice(Number(el.dataset.e), 1);
    persist(); render();
  },
  'pick-exercise'() { openExercisePicker(); },
  'close-sheet'() { closeSheet(); },
  'add-entry'(el) { addEntry(el.dataset.id); },
  'create-and-add'() {
    const name = sheet.querySelector('[data-newex]').value.trim();
    if (!name) return;
    const ex = { id: core.uid(), name, category: 'accessory', tm: null, increment: store.UNIT_DEFAULTS[unit()].upperInc, notes: '' };
    S.exercises.push(ex);
    addEntry(ex.id);
  },
  'finish-workout'() { finishWorkout(); },
  'discard-workout'() { discardWorkout(false); },
  'delete-workout'() {
    const w = currentWorkout();
    if (!w || !confirm('Delete this workout permanently?')) return;
    S.workouts = S.workouts.filter((x) => x.id !== w.id);
    persist(); go('#/history');
  },
  'open-workout'(el) { go(`#/workout/${el.dataset.id}`); },
  'history-mode'(el) { ui.historyMode = el.dataset.mode; render(); },
  'cal-move'(el) {
    const [y, m] = ui.calMonth.split('-').map(Number);
    ui.calMonth = core.isoDate(new Date(y, m - 1 + Number(el.dataset.delta), 1)).slice(0, 7);
    render();
  },
  'cal-select'(el) { ui.calSelected = el.dataset.date; render(); },
  'log-past'(el) {
    const w = newWorkout({ date: el.dataset.date, name: 'Logged workout', cycle: null, week: null, weekLabel: '', finishedAt: new Date().toISOString() });
    S.workouts.push(w);
    persist(); go(`#/workout/${w.id}`);
  },
  'progress-range'(el) { ui.progressRange = el.dataset.range; render(); },
  'chart-point'(el) { ui.chartInfo = el.dataset.info; const c = document.getElementById('chart-info'); if (c) c.textContent = ui.chartInfo; },
  'program-tab'(el) { ui.programTab = el.dataset.tab; render(); },
  'move-session'(el) {
    const i = Number(el.dataset.i), j = i + Number(el.dataset.delta);
    if (j < 0 || j >= S.templates.length) return;
    [S.templates[i], S.templates[j]] = [S.templates[j], S.templates[i]];
    persist(); render();
  },
  'save-exercise'() {
    const d = ui.draft;
    d.name = (d.name || '').trim();
    if (!d.name) { toast('Give the exercise a name'); return; }
    const existing = exById(d.id);
    if (existing) {
      const newTm = d.tm;
      Object.assign(existing, { ...d, tm: existing.tm });
      setTm(existing, newTm);
    } else {
      const tm = d.tm;
      S.exercises.push({ ...d, tm: null });
      setTm(exById(d.id), tm);
    }
    ui.draftKey = null;
    persist(); toast('Saved'); go('#/lifts');
  },
  'delete-exercise'() {
    const id = ui.draft.id;
    const used = S.templates.filter((t) => t.mainLiftId === id || t.supplemental?.liftId === id || (t.accessories || []).some((a) => a.exerciseId === id));
    const msg = used.length ? `This exercise is used in ${used.map((t) => t.name).join(', ')}. Remove it from those sessions and delete? Past workouts are kept.` : 'Delete this exercise? Past workouts are kept.';
    if (!confirm(msg)) return;
    for (const t of S.templates) {
      if (t.mainLiftId === id) t.mainLiftId = null;
      if (t.supplemental?.liftId === id) t.supplemental.liftId = null;
      t.accessories = (t.accessories || []).filter((a) => a.exerciseId !== id);
    }
    S.exercises = S.exercises.filter((e) => e.id !== id);
    ui.draftKey = null;
    persist(); go('#/lifts');
  },
  'acc-add'() {
    const first = S.exercises.find((e) => e.category !== 'main') || S.exercises[0];
    if (!first) return;
    ui.draft.accessories.push({ exerciseId: first.id, sets: 3, reps: 10 });
    render();
  },
  'acc-move'(el) {
    const a = ui.draft.accessories, i = Number(el.dataset.i), j = i + Number(el.dataset.delta);
    if (j < 0 || j >= a.length) return;
    [a[i], a[j]] = [a[j], a[i]];
    render();
  },
  'acc-remove'(el) { ui.draft.accessories.splice(Number(el.dataset.i), 1); render(); },
  'days'(el) {
    if (Number(el.dataset.delta) > 0) {
      if (S.templates.length >= 7) return;
      const used = new Set(S.templates.map((t) => t.mainLiftId));
      const lifts = mainLifts();
      const fresh = lifts.find((e) => !used.has(e.id));
      const lift = fresh || lifts[S.templates.length % Math.max(lifts.length, 1)] || null;
      S.templates.push({ id: core.uid(), name: fresh ? `${fresh.name} Day` : `Day ${S.templates.length + 1}`, mainLiftId: lift?.id ?? null, supplemental: { type: 'fsl', liftId: null, sets: 5, reps: 5, pct: null }, accessories: [] });
      toast('Day added — tap it to choose its main lift');
    } else {
      const last = S.templates.at(-1);
      if (S.templates.length <= 1 || !confirm(`Remove "${last.name}"? Past workouts are kept.`)) return;
      S.templates.pop();
      if (S.cycle.complete === false) maybeAdvanceWeek({ templateId: S.templates[0]?.id, cycle: S.cycle.number, week: S.cycle.week });
    }
    persist(); render();
  },
  'save-session'() {
    const d = ui.draft;
    d.name = (d.name || '').trim() || 'Training day';
    const lift = exById(d.mainLiftId);
    if (lift) {
      if (lift.category !== 'main') { lift.category = 'main'; toast(`${lift.name} is now a main lift`); }
      if (d._tm > 0) setTm(lift, d._tm);
    }
    delete d._tm;
    d.accessories = d.accessories.filter((a) => exById(a.exerciseId)).map((a) => ({ ...a, sets: Math.max(1, a.sets || 1), reps: Math.max(1, a.reps || 1) }));
    const i = S.templates.findIndex((t) => t.id === d.id);
    if (i >= 0) S.templates[i] = d; else S.templates.push(d);
    ui.draftKey = null;
    persist(); toast('Training day saved'); go('#/lifts/days');
  },
  'delete-session'() {
    if (S.templates.length <= 1) { toast('You need at least one training day'); return; }
    if (!confirm('Delete this training day? Past workouts are kept.')) return;
    S.templates = S.templates.filter((t) => t.id !== ui.draft.id);
    ui.draftKey = null;
    persist(); go('#/lifts/days');
  },
  'force-cycle-end'() {
    if (!confirm(`End cycle ${S.cycle.number} now and review training maxes?`)) return;
    S.cycle.complete = true;
    persist(); go('#/today');
  },
  'export-json'() { shareOrDownload(JSON.stringify(S, null, 2), `531-backup-${core.isoDate()}.json`, 'application/json'); },
  'export-csv'() { shareOrDownload(csv(), `531-sets-${core.isoDate()}.csv`, 'text/csv'); },
  'import-json'() { document.getElementById('import-file').click(); },
  'reset-all'() {
    if (!confirm('Erase ALL workouts, exercises and settings on this device? This cannot be undone.')) return;
    if (!confirm('Really erase everything? Consider exporting a backup first.')) return;
    store.clear();
    S = store.defaultState();
    persist(); stopRest(); go('#/today'); render();
  },
  'rest-adjust'(el) { if (ui.rest) { ui.rest.endsAt += Number(el.dataset.delta) * 1000; ui.rest.total = Math.max(ui.rest.total, (ui.rest.endsAt - Date.now()) / 1000); ui.rest.fired = false; tick(); } },
  'rest-stop'() { stopRest(); },
};

document.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-action]');
  if (!el || el.disabled) return;
  const fn = actions[el.dataset.action];
  if (fn) { ev.preventDefault(); fn(el, ev); }
});

document.addEventListener('input', (ev) => {
  const el = ev.target;
  if (el.dataset.field) {
    const w = currentWorkout();
    if (!w) return;
    const e = w.entries[el.dataset.e];
    const s = e.sets[el.dataset.s];
    s[el.dataset.field] = el.dataset.field === 'reps' ? (num(el.value) == null ? null : Math.round(num(el.value))) : num(el.value);
    persist();
    const meta = document.getElementById(`meta-${el.dataset.e}-${el.dataset.s}`);
    if (meta) meta.innerHTML = setMeta(w, e, s);
  } else if (el.dataset.wfield) {
    const w = currentWorkout();
    if (!w) return;
    if (el.dataset.wfield === 'date') { if (el.value) w.date = el.value; } else w[el.dataset.wfield] = el.value;
    persist();
  } else if (el.dataset.draft && ui.draft) {
    readDraftInput(el);
  } else if (el.dataset.tool) {
    ui.tools[el.dataset.tool] = el.value;
    document.getElementById('tool-plates').innerHTML = toolPlates();
    document.getElementById('tool-1rm').innerHTML = tool1rm();
  } else if (el.dataset.filter === 'picker') {
    const q = el.value.trim().toLowerCase();
    sheet.querySelectorAll('.pick').forEach((b) => { b.hidden = q && !b.dataset.name.includes(q); });
  }
});

document.addEventListener('change', async (ev) => {
  const el = ev.target;
  if (el.dataset.draft && ui.draft) {
    readDraftInput(el);
    if ('rerender' in el.dataset) render();
  } else if (el.dataset.actionChange === 'progress-ex') {
    ui.chartInfo = '';
    go(`#/progress/${el.value}`);
  } else if (el.dataset.setting) {
    const key = el.dataset.setting;
    const t = el.dataset.type;
    if (key === 'unit') {
      if (!changeUnit(el.value)) return;
    } else if (t === 'bool') S.settings[key] = el.checked;
    else if (t === 'num') { const v = num(el.value); if (v != null && v >= 0) S.settings[key] = v; }
    else if (t === 'pct') { const v = num(el.value); if (v > 0 && v <= 100) S.settings[key] = v / 100; }
    else if (t === 'list') { const v = el.value.split(/[,\s]+/).map(num).filter((x) => x > 0); if (v.length) S.settings[key] = v; }
    else S.settings[key] = el.value;
    if (key === 'deload') S.cycle.week = Math.min(S.cycle.week, weeks().length);
    persist(); render(); toast('Saved');
  } else if (el.dataset.cycle) {
    const v = Math.round(num(el.value));
    if (v >= 1) {
      S.cycle[el.dataset.cycle] = el.dataset.cycle === 'week' ? Math.min(v, weeks().length) : v;
      S.cycle.complete = false;
      persist(); toast('Saved');
    }
  } else if (el.id === 'import-file' && el.files?.[0]) {
    try {
      const data = JSON.parse(await el.files[0].text());
      if (!data || !Array.isArray(data.exercises)) throw new Error('bad');
      if (!confirm(`Replace all current data with this backup (${(data.workouts || []).length} workouts)?`)) return;
      S = store.normalize(data);
      persist(); render(); toast('Backup imported');
    } catch {
      toast("That file isn't a valid backup");
    } finally { el.value = ''; }
  }
});

// Avoid accidental double-tap zoom & keep keyboard "Go" from submitting nothing.
document.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' && ev.target.matches('input[data-field]')) ev.target.blur(); });

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
navigator.storage?.persist?.().catch(() => {});

render();
