// The kid's side of the coach's box (demo/coachbox.js): the words it
// puts on screen. The box itself is DOM; these are the sentences, and
// what they must never say is the point — a kid is never refused a
// question, the bill is always shown, and looking at the world is free
// (decisions 2026-10-25, free items §3 and §5, questions §1–2).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PROMPTS, tickerWords, forestWords, libraryWords } from '../demo/coachbox.js';

test('the ticker shows the bill, and never says no', () => {
  const normal = tickerWords({
    on: true,
    cost: { turn: 1.8, today: 12.4 },
    left: { calls: 22, cents: 87.6 },
  });
  assert.match(normal, /this ask 1\.80¢/);
  assert.match(normal, /today 12\.40¢/);
  assert.match(normal, /22 questions left here/);

  const over = tickerWords({ on: true, cost: { turn: 2, today: 40 }, left: { calls: 0, cents: 60 } });
  assert.match(over, /ask anyway/, 'past the meter the kid is invited to ask, not refused');
  assert.doesNotMatch(over, /\bno\b|cannot|can’t/i);

  const resting = tickerWords({
    on: true,
    resting: true,
    cost: { turn: 0, today: 100 },
    left: { calls: 4, cents: 0 },
  });
  assert.match(resting, /resting until the morning/, 'the wall is a rest, not a dead button');

  assert.match(tickerWords({ on: false, why: 'no-key' }), /plays fine without one/);
  assert.match(tickerWords({ on: false, why: 'unreachable' }), /Keep building/);
});

test('looking at the world costs nothing, and says so', () => {
  const forest = forestWords({ grants: ['cargo', 'links', 'stock', 'anchor', 'fixture'], materials: ['ant', 'wood', 'silk'] });
  assert.match(forest, /someone to carry across/);
  assert.match(forest, /ant, wood, silk/);
  assert.match(forest, /free/);
  assert.match(libraryWords([{ name: 'River piling', tags: ['post'] }]), /River piling \(post\)/);
  assert.match(libraryWords([]), /Nothing has been built yet/);
});

test('the tap-to-pick prompts ask for things, and never for an answer', () => {
  assert.ok(PROMPTS.length >= 6, 'enough to play without reading');
  for (const p of PROMPTS) {
    assert.ok(p.icon && p.label && p.said.endsWith('?'), `${p.label} asks a question`);
  }
});
