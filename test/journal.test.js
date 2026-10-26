// Tests for the commitment journal — including the §6 hard constraint:
// no adaptation output may depend on time-on-task.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  makeJournal,
  record,
  calibration,
  trustCalibration,
  catchScore,
  detectThrowaway,
  fingerprint,
  recommend,
  needsDebrief,
  debriefKind,
  adultFlag,
  THRESHOLDS,
} from '../engine/journal.js';

const W = THRESHOLDS.window;

function band(level, lo, hi, outcome, extra = {}) {
  return { level, kind: 'band', prediction: { lo, hi }, range: 10, outcome, buildFailed: false, consultant: null, ...extra };
}

test('calibration: hits, rate and streak over binary and band entries', () => {
  const j = makeJournal();
  record(j, { level: 'a', kind: 'binary', prediction: 'holds', outcome: 'holds', buildFailed: false, consultant: null });
  record(j, { level: 'a', kind: 'binary', prediction: 'holds', outcome: 'breaks', buildFailed: true, consultant: null });
  record(j, band('b', 2, 4, 3));
  record(j, band('b', 2, 4, 5)); // miss
  record(j, band('b', 2, 4, 2.5));
  const c = calibration(j);
  assert.equal(c.total, 5);
  assert.equal(c.hits, 3);
  assert.equal(c.streak, 1);
});

test('trust calibration: separate commitments, deferred counted apart', () => {
  const j = makeJournal();
  const mk = (call, wrong) =>
    record(j, band('a', 1, 9, 5, { consultant: { wrong, call, caught: null } }));
  mk('trusted', false); // correct trust
  mk('doubted', true); // correct doubt
  mk('trusted', true); // swallowed a wrong answer
  mk('deferred', true); // a valid call of one's own limit
  const t = trustCalibration(j);
  assert.equal(t.judged, 3);
  assert.equal(t.correct, 2);
  assert.equal(t.deferred, 1);
});

test('catch scoring follows the decisions table', () => {
  const mk = (call, caught, wrong = true) =>
    catchScore(band('a', 1, 2, 1.5, { consultant: { wrong, call, caught } }));
  assert.equal(mk('doubted', 'before'), 'top');
  assert.equal(mk('trusted', 'postmortem'), 'positive');
  assert.equal(mk('deferred', null), 'valid-limit');
  assert.equal(mk('trusted', 'never'), 'zero');
  assert.equal(mk('trusted', null, false), null); // no planted error that round
});

test('throwaway detector: always-win bands flag; honest bands do not', () => {
  const lazy = makeJournal();
  for (let i = 0; i < W; i++) record(lazy, band('a', 0, 9, 5)); // width 9 of range 10
  assert.ok(detectThrowaway(lazy).throwaway);
  assert.ok(detectThrowaway(lazy).reasons.includes('bands-always-win'));

  const honest = makeJournal();
  for (let i = 0; i < W * 2; i++) {
    const width = 4 - i * 0.15; // narrowing
    record(honest, band('a', 5 - width / 2, 5 + width / 2, 5 + (i % 2 ? 0.3 : -0.3)));
  }
  assert.equal(detectThrowaway(honest).throwaway, false);
});

test('many builds with honest narrowing bands never flag (build count is not the detector)', () => {
  const j = makeJournal();
  for (let i = 0; i < 30; i++) {
    const width = Math.max(0.6, 4 - i * 0.12);
    record(j, band('a', 5 - width / 2, 5 + width / 2, 5));
  }
  assert.equal(detectThrowaway(j).throwaway, false);
  const f = fingerprint(j);
  assert.ok(f === null || f === 'bored', `honest kid flagged as ${f}`);
});

test('fingerprints: overwhelmed and unclear-ask-debrief', () => {
  const over = makeJournal();
  for (let i = 0; i < W; i++) {
    // wide misses, failing builds, bands wobbling but not narrowing
    record(over, band('a', 1, 8 + i * 0.01, 9.5, { buildFailed: true }));
  }
  assert.equal(fingerprint(over), 'overwhelmed');
  assert.deepEqual(recommend(over, { persistence: 3 }), {
    signal: 'overwhelmed',
    action: 'adjust-depth',
    direction: 'down',
  });

  const lazy = makeJournal();
  for (let i = 0; i < W; i++) record(lazy, band('a', 0, 9, 5));
  assert.equal(fingerprint(lazy), 'unclear-ask-debrief');
  assert.deepEqual(recommend(lazy), { signal: 'unclear-ask-debrief', action: 'debrief' });
});

test('response ladder escalates with persistence and tops out at the adult', () => {
  const over = makeJournal();
  for (let i = 0; i < W; i++) {
    record(over, band('a', 1, 8 + i * 0.01, 9.5, { buildFailed: true }));
  }
  assert.equal(recommend(over, { persistence: 1 }).action, 'raise-sim-cost');
  assert.equal(recommend(over, { persistence: 2 }).action, 'change-skin');
  assert.equal(recommend(over, { persistence: 4 }).action, 'flag-adult');
  assert.equal(recommend(over, { persistence: 9 }).action, 'flag-adult');
});

test('HARD CONSTRAINT: outputs are invariant to session duration (the feed line)', () => {
  const build = (durations) => {
    const j = makeJournal();
    for (let i = 0; i < W * 2; i++) {
      record(j, band('a', 0, 9, 5, {
        buildFailed: i % 2 === 0,
        at: 1000 + i * durations,
        durationMs: durations,
        consultant: { wrong: i % 5 === 0, call: 'trusted', caught: 'never' },
      }));
    }
    return j;
  };
  const quick = build(10);
  const slow = build(3_600_000); // same log, 360,000× the time-on-task
  assert.deepEqual(recommend(quick, { persistence: 2 }), recommend(slow, { persistence: 2 }));
  assert.deepEqual(detectThrowaway(quick), detectThrowaway(slow));
  assert.deepEqual(fingerprint(quick), fingerprint(slow));
  assert.deepEqual(adultFlag(quick), adultFlag(slow));
});

test('debrief runs after a failed build or a throwaway streak, not every level', () => {
  const j = makeJournal();
  record(j, band('a', 4, 6, 5));
  assert.equal(needsDebrief(j), false);
  record(j, band('a', 4, 6, 9, { buildFailed: true }));
  assert.equal(needsDebrief(j), true);
});

test('the adult flag is marked adult-only and carries evidence', () => {
  const j = makeJournal();
  for (let i = 0; i < W; i++) record(j, band('a', 0, 9, 5));
  const flag = adultFlag(j, 'I dunno');
  assert.equal(flag.adultOnly, true);
  assert.equal(flag.signal, 'unclear-ask-debrief');
  assert.equal(flag.debriefAnswer, 'I dunno');
  assert.ok(flag.evidence.throwaway.throwaway);
  assert.ok(flag.evidence.medianBandWidthRatio > 0.8);
});

// The debrief, as amended 2026-10-25: a third trigger for the moment
// the owner described at the kitchen table — a problem the kid got
// right after getting it wrong, where the contrast between their own
// two attempts is the lesson. Still never every level: §7 calls that a
// toll, and a kid who sails through first time is never stopped.
test('a problem resolved after a failure asks for a debrief; a clean first run does not', () => {
  const clean = makeJournal();
  record(clean, band('a', 4, 6, 5));
  assert.equal(debriefKind(clean), null, 'first time right: no toll');

  const j = makeJournal();
  record(j, band('a', 4, 6, 9, { buildFailed: true }));
  assert.equal(debriefKind(j), 'failed');
  record(j, band('a', 4, 6, 5));
  assert.equal(debriefKind(j), 'resolved', 'it broke, then it held — ask about the contrast');
  assert.equal(needsDebrief(j), true);

  // A different problem is a different problem: the earlier failure on
  // level 'a' is nothing to compare a success on 'b' with.
  const other = makeJournal();
  record(other, band('a', 4, 6, 9, { buildFailed: true }));
  record(other, band('b', 4, 6, 5));
  assert.equal(debriefKind(other), null);
});

test('the debrief kind names which question to ask, failed before resolved', () => {
  const j = makeJournal();
  record(j, band('a', 4, 6, 9, { buildFailed: true }));
  record(j, band('a', 4, 6, 5));
  record(j, band('a', 4, 6, 9, { buildFailed: true }));
  assert.equal(debriefKind(j), 'failed', 'the build that just fell down is the live question');
  const throwaway = makeJournal();
  for (let i = 0; i < W; i++) record(throwaway, band('a', 0, 9, 5));
  assert.equal(debriefKind(throwaway), 'throwaway');
});
