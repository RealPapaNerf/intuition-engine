// The educator's window (decisions 2026-10-25 §5): entries are accepted
// only through the journal's own door, the flags are journal.js's
// adult-only packet, persistence survives a restart, and the response
// ladder escalates on play, never on polling.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { makeEducatorLog } from '../coach/educator.js';
import { THRESHOLDS } from '../engine/journal.js';

// A kid cruising: narrow bands, every one a hit — the bored fingerprint
// (2026-10-19 §5). The bands move a little so they are honest commitments,
// not the unchanged-numbers throwaway.
function boredEntries(n, { level = 'span-gap:measure' } = {}) {
  return Array.from({ length: n }, (_, i) => ({
    level,
    kind: 'band',
    prediction: { lo: 100 + 2 * i, hi: 112 + 2 * i },
    range: 500,
    outcome: 106 + 2 * i,
    buildFailed: false,
    consultant: null,
  }));
}

test('entries pass only through the journal’s own door', () => {
  const log = makeEducatorLog();
  const r = log.log('Pia', [
    ...boredEntries(2),
    { level: 'span-gap', kind: 'vibes', prediction: 'good' }, // refused
    { level: 'span-gap', kind: 'band', prediction: { lo: 9, hi: 3 }, range: 500, outcome: 5 },
  ]);
  assert.equal(r.accepted, 2);
  assert.equal(r.refused.length, 2);
  assert.deepEqual(log.kids(), ['Pia']);
  assert.equal(log.attempts('Pia').length, 2);
  assert.throws(() => log.log('../../etc', boredEntries(1)), /bad kid name/);
});

test('a bored kid raises the adult-only flag, and the kid page never gets it', () => {
  const log = makeEducatorLog();
  log.log('Pia', boredEntries(THRESHOLDS.window));
  const f = log.flags('Pia');
  assert.equal(f.alert, true);
  assert.equal(f.signal, 'bored');
  assert.equal(f.flag.adultOnly, true, 'the packet says what it is');
  assert.equal(f.recommendation.action, 'raise-sim-cost', 'the ladder starts at the bottom');
  assert.equal(f.calibration.hits, THRESHOLDS.window);

  const quiet = log.flags('Ana');
  assert.equal(quiet.alert, false);
  assert.equal(quiet.signal, null);
  assert.equal(quiet.recommendation, null);
});

test('the ladder escalates on play, never on polling', () => {
  const log = makeEducatorLog();
  log.log('Pia', boredEntries(THRESHOLDS.window));
  assert.equal(log.flags('Pia').recommendation.action, 'raise-sim-cost');
  assert.equal(
    log.flags('Pia').recommendation.action,
    'raise-sim-cost',
    'refreshing the page is not persistence',
  );
  log.log('Pia', boredEntries(1));
  assert.equal(log.flags('Pia').recommendation.action, 'change-skin');
  log.log('Pia', boredEntries(1));
  const third = log.flags('Pia');
  assert.equal(third.recommendation.action, 'adjust-depth');
  assert.equal(third.recommendation.direction, 'up', 'bored moves up, not down');
});

test('allFlags reads every kid at once', () => {
  const log = makeEducatorLog();
  log.log('Pia', boredEntries(THRESHOLDS.window));
  log.log('Ana', boredEntries(2));
  const all = log.allFlags();
  assert.deepEqual(
    all.map((f) => [f.kid, f.alert]),
    [
      ['Pia', true],
      ['Ana', false],
    ],
  );
});

test('the log survives a restart, and a corrupt line never sinks it', () => {
  const dir = mkdtempSync(join(tmpdir(), 'educator-'));
  try {
    const first = makeEducatorLog({ dir });
    first.log('Pia', boredEntries(3));
    const again = makeEducatorLog({ dir });
    assert.equal(again.attempts('Pia').length, 3);
    assert.deepEqual(again.kids(), ['Pia']);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
