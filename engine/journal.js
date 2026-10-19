// The journal: the commitment log and everything computed from it.
// Implements docs/decisions/2026-10-19-brainstorm.md §3–§8.
//
// Entries record what the kid committed to and what reality said. The
// kid's own prediction and their call on the Consultant's answer are
// two separate commitments (§4).
//
// An entry:
//   level        archetype id, e.g. 'frog-bridge'
//   kind         'binary' | 'band'
//   prediction   binary: 'holds'|'breaks' · band: { lo, hi }
//   range        band only: the level's plausible answer span, so band
//                width can be judged relative to it
//   outcome      binary: 'holds'|'breaks' · band: the actual number
//   buildFailed  boolean
//   consultant   null, or { wrong, call: 'trusted'|'doubted'|'deferred',
//                caught: 'before'|'postmortem'|'never'|null }
//
// Entries may carry timestamps or durations for display; nothing in
// this module reads them. That is the §6 hard constraint: adaptation
// optimizes for prediction quality improving, never for time-on-task,
// and the duration-invariance test in test/journal.test.js keeps it so.

// Thresholds below marked REVISIT are the §"open items": picked to
// instrument, to be revisited with Stage 0 data.
export const THRESHOLDS = {
  window: 6, // entries per detection window           REVISIT
  alwaysWinRatio: 0.8, // band width / range ≥ this = always-win  REVISIT
  narrowRatio: 0.25, // band width / range ≤ this = narrow        REVISIT
  wideRatio: 0.6, // band width / range ≥ this = wide             REVISIT
  boredHitRate: 0.85, //                                          REVISIT
  failStreak: 3, //                                               REVISIT
};

export function makeJournal() {
  return { entries: [] };
}

export function record(journal, entry) {
  if (entry.kind !== 'binary' && entry.kind !== 'band') {
    throw new Error(`unknown entry kind: ${entry.kind}`);
  }
  if (entry.kind === 'band') {
    const { lo, hi } = entry.prediction ?? {};
    if (!(Number.isFinite(lo) && Number.isFinite(hi) && hi >= lo)) {
      throw new Error('band prediction needs { lo, hi } with hi >= lo');
    }
    if (!(entry.range > 0)) {
      throw new Error('band entry needs a positive range');
    }
  }
  journal.entries.push(entry);
  return entry;
}

function hit(e) {
  if (e.kind === 'binary') return e.prediction === e.outcome;
  return e.outcome >= e.prediction.lo && e.outcome <= e.prediction.hi;
}

// The kid-visible prestige stat (§8: this is all the kid sees).
export function calibration(journal) {
  let hits = 0;
  let streak = 0;
  for (const e of journal.entries) {
    if (hit(e)) {
      hits++;
      streak++;
    } else {
      streak = 0;
    }
  }
  const total = journal.entries.length;
  return { total, hits, rate: total ? hits / total : null, streak };
}

// Trust calibration (§4): correct trust = trusting when right, or
// doubting when wrong. "Deferred" — I can't judge this one, run it —
// is neither; it is counted on its own as a valid call of one's limit.
export function trustCalibration(journal) {
  let judged = 0;
  let correct = 0;
  let deferred = 0;
  for (const e of journal.entries) {
    const c = e.consultant;
    if (!c) continue;
    if (c.call === 'deferred') {
      deferred++;
      continue;
    }
    judged++;
    if ((c.call === 'trusted' && !c.wrong) || (c.call === 'doubted' && c.wrong)) {
      correct++;
    }
  }
  return { judged, correct, deferred, rate: judged ? correct / judged : null };
}

// §3: score whether and when a planted error was caught, never how
// hard the kid thought. null for rounds without a Consultant error.
export function catchScore(entry) {
  const c = entry.consultant;
  if (!c || !c.wrong) return null;
  if (c.call === 'deferred') return 'valid-limit';
  if (c.caught === 'before') return 'top';
  if (c.caught === 'postmortem') return 'positive';
  return 'zero';
}

function lastWindow(journal, n = THRESHOLDS.window) {
  return journal.entries.slice(-n);
}

function widthRatio(e) {
  return (e.prediction.hi - e.prediction.lo) / e.range;
}

function median(xs) {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : null;
}

// §5: the detector is throwaway predictions, never build count.
export function detectThrowaway(journal) {
  const bands = journal.entries.filter((e) => e.kind === 'band');
  const reasons = [];
  if (bands.length >= THRESHOLDS.window) {
    const win = bands.slice(-THRESHOLDS.window);
    const ratios = win.map(widthRatio);
    if (median(ratios) >= THRESHOLDS.alwaysWinRatio) {
      reasons.push('bands-always-win');
    }
    if (bands.length >= THRESHOLDS.window * 2) {
      const prev = bands
        .slice(-THRESHOLDS.window * 2, -THRESHOLDS.window)
        .map(widthRatio);
      if (median(ratios) >= median(prev)) reasons.push('bands-not-narrowing');
    }
    // Numbers that don't move: the same band repeated on the same level.
    const byLevel = new Map();
    let repeats = 0;
    for (const e of win) {
      const key = e.level;
      const sig = `${e.prediction.lo}:${e.prediction.hi}`;
      if (byLevel.get(key) === sig) repeats++;
      byLevel.set(key, sig);
    }
    if (repeats >= THRESHOLDS.window / 2) reasons.push('prediction-unchanged');
  }
  return { throwaway: reasons.length > 0, reasons };
}

// §5: four causes, one detector. Bored and overwhelmed are readable
// from the log; the rational experimenter and the different-goal kid
// look alike in the numbers, so they come back as 'unclear-ask-debrief'
// and the coach's question separates them (§7).
export function fingerprint(journal) {
  const win = lastWindow(journal);
  if (win.length < THRESHOLDS.window) return null;

  const { throwaway } = detectThrowaway(journal);
  if (throwaway) return 'unclear-ask-debrief';

  const bands = win.filter((e) => e.kind === 'band');
  const hits = win.filter(hit).length / win.length;
  const ratio = bands.length ? median(bands.map(widthRatio)) : null;

  let failStreak = 0;
  for (let i = journal.entries.length - 1; i >= 0; i--) {
    if (journal.entries[i].buildFailed) failStreak++;
    else break;
  }

  if (ratio != null && ratio >= THRESHOLDS.wideRatio && failStreak >= THRESHOLDS.failStreak) {
    return 'overwhelmed';
  }
  if (hits >= THRESHOLDS.boredHitRate && (ratio == null || ratio <= THRESHOLDS.narrowRatio)) {
    return 'bored';
  }
  return null;
}

// §6: the automatic response ladder. `persistence` is how many
// consecutive detection windows the caller has seen this signal; the
// ladder escalates only while it persists. Pure function of the log —
// no engagement-time input exists to optimize for.
const LADDER = ['raise-sim-cost', 'change-skin', 'adjust-depth', 'flag-adult'];

export function recommend(journal, { persistence = 1 } = {}) {
  const signal = fingerprint(journal);
  if (signal === null) return null;
  if (signal === 'unclear-ask-debrief') return { signal, action: 'debrief' };
  const action = LADDER[Math.min(persistence - 1, LADDER.length - 1)];
  const out = { signal, action };
  if (action === 'adjust-depth') {
    out.direction = signal === 'overwhelmed' ? 'down' : 'up';
  }
  return out;
}

// §7: debriefs run after a failed build or a throwaway streak, never
// every level.
export function needsDebrief(journal) {
  const last = journal.entries[journal.entries.length - 1];
  if (last && last.buildFailed) return true;
  return detectThrowaway(journal).throwaway;
}

// §7–§8: the adult-only packet — a flagged diagnosis with evidence
// attached. The kid never sees this.
export function adultFlag(journal, debriefAnswer = null) {
  const bands = journal.entries.filter((e) => e.kind === 'band');
  const win = bands.slice(-THRESHOLDS.window);
  return {
    adultOnly: true,
    signal: fingerprint(journal),
    debriefAnswer,
    evidence: {
      calibration: calibration(journal),
      trust: trustCalibration(journal),
      throwaway: detectThrowaway(journal),
      medianBandWidthRatio: win.length ? median(win.map(widthRatio)) : null,
    },
  };
}
