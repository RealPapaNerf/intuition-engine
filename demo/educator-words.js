// The adult-only packet, in plain words (decisions 2026-10-25 §5,
// questions §4). Nothing here detects anything: the signals are exactly
// engine/journal.js's fingerprint / recommend / adultFlag, and the
// reliance reading is coach/educator.js's. This file only says them out
// loud, for an adult, on a page the kid never opens.
//
// The tone rule that matters: these describe a situation, never a kid.
// "Bored" is a shape in a log — narrow bands, high hit rate — and the
// words say what was seen and what to try, not what the kid is.

export const SIGNALS = Object.freeze({
  bored: 'Calling it right nearly every time, with narrow bands — the problems are too easy.',
  overwhelmed: 'Wide bands and builds that keep failing — the problems are too hard right now.',
  'unclear-ask-debrief':
    'Predictions that cannot lose, or that never move. Could be coasting, could be a different goal — ask.',
});

export const ACTIONS = Object.freeze({
  'raise-sim-cost': 'Make testing cost something — fewer tries, more thinking before the gate.',
  'change-skin': 'Change the costume; the same physics in a new scene often re-engages.',
  'adjust-depth': 'Move the depth',
  'flag-adult': 'Sit with them — this has persisted through everything else.',
  debrief: 'Ask them what they were going for. The log cannot tell these apart.',
});

export function signalWords(signal) {
  return signal ? SIGNALS[signal] ?? signal : 'Nothing flagged.';
}

export function actionWords(rec) {
  if (!rec) return '';
  const base = ACTIONS[rec.action] ?? rec.action;
  return rec.action === 'adjust-depth' ? `${base} ${rec.direction === 'up' ? 'up' : 'down'}.` : base;
}

// Leaning on the coach is an adult's signal, never a wall for the kid
// (questions §4): asks are not journal entries and feed nothing else.
export function relianceWords(coach = {}) {
  const bits = [`${coach.asks ?? 0} asks`];
  if (coach.over > 0) bits.push(`${coach.over} past the pacing meter`);
  if (coach.nearGuard) bits.push('neared the day’s credit guard');
  if (coach.resting) bits.push('hit it — the coach rested');
  if (coach.reliant) bits.push('asking far more than building');
  return bits.join(' · ');
}

export function predictionText(e) {
  if (!e) return '';
  return e.kind === 'band' ? `${e.prediction.lo}–${e.prediction.hi} g` : e.prediction ?? '—';
}

export function outcomeText(e) {
  if (!e) return '';
  return e.kind === 'band' ? `${e.outcome} g` : e.outcome;
}

export function wasHit(e) {
  if (!e) return false;
  return e.kind === 'band'
    ? e.outcome >= e.prediction.lo && e.outcome <= e.prediction.hi
    : e.prediction === e.outcome;
}

const CAUGHT = Object.freeze({
  before: 'doubted it before the test',
  postmortem: 'named the error afterwards',
  never: 'did not catch it',
});

// What the kid did about the Consultant — their second, separate
// commitment (2026-10-19 §4).
export function consultantText(e) {
  const c = e?.consultant;
  if (!c) return '—';
  const call = { trusted: 'trusted', doubted: 'doubted', deferred: 'couldn’t judge, ran it' }[c.call] ?? c.call;
  if (!c.wrong) return `${call} · it was right`;
  return `${call} · it was wrong, ${CAUGHT[c.caught] ?? 'unresolved'}`;
}

export function when(at) {
  if (!Number.isFinite(at)) return '';
  const d = new Date(at);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}
