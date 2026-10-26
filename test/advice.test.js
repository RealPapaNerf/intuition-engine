// The Consultant's words and scoring (demo/advice.js). The engine plants
// the error (engine/consultant.js); this is what the kid is asked about
// it and what the journal is told. Two commitments stay apart — the
// kid's prediction, and their call on the advice — and naming the KIND
// of wrong is the scored part (2026-10-19 §3–4, 2026-10-25 §4).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { claimWords, wrongKinds, caughtBy, postmortemWords, callWords } from '../demo/advice.js';

const wrongFeel = { quantity: 'verdict', claim: 'holds', wrong: true, errorType: 'confident-nonsense', truth: 'breaks' };
const rightFeel = { quantity: 'verdict', claim: 'breaks', wrong: false, errorType: null, truth: 'breaks' };
const wrongBand = { quantity: 'breaking-load', claim: 850, wrong: true, errorType: 'magnitude', truth: 85 };

test('the claim is said in the costume’s own words, and never hedged', () => {
  assert.match(claimWords(wrongFeel, { cargoName: 'Hopper (50 g)' }), /will hold Hopper \(50 g\)/);
  assert.match(claimWords(wrongBand), /about 850 g/);
  assert.match(
    claimWords({ quantity: 'breaking-load', claim: 0 }),
    /carries nothing at all/,
    'a zero claim is still a claim',
  );
  assert.equal(claimWords(null), '');
});

test('doubting a planted error catches it before the test', () => {
  assert.equal(caughtBy(wrongFeel, null, 'doubted'), 'before');
  assert.equal(caughtBy(wrongFeel, null, 'trusted'), 'never', 'uncaught until the postmortem says otherwise');
  assert.equal(caughtBy(wrongFeel, 'confident-nonsense', 'trusted'), 'postmortem');
  assert.equal(caughtBy(wrongFeel, 'answered-different-question', 'trusted'), 'never');
  assert.equal(caughtBy(wrongFeel, 'none', 'trusted'), 'never', 'calling a wrong claim right is a miss');
  assert.equal(caughtBy(rightFeel, 'none', 'trusted'), null, 'nothing was planted to catch');
  assert.equal(caughtBy(wrongBand, 'magnitude', 'deferred'), 'postmortem');
});

test('the kinds offered are the ones that mode can really produce', () => {
  const band = wrongKinds('measure').map((k) => k.id);
  assert.deepEqual(band, ['magnitude', 'unit-slip', 'limiting-case', 'none']);
  const feel = wrongKinds('feel').map((k) => k.id);
  assert.deepEqual(feel, ['answered-different-question', 'confident-nonsense', 'none']);
  for (const k of [...wrongKinds('measure'), ...wrongKinds('feel')]) {
    assert.ok(k.label.length > 0 && !/stupid|dumb|bad/i.test(k.label));
  }
});

test('the postmortem tells the truth, and scores the catch not the kid', () => {
  assert.match(postmortemWords(wrongBand, 'magnitude'), /Caught it — it really carries 85 g/);
  assert.match(postmortemWords(wrongBand, 'unit-slip'), /not the kind of wrong/);
  assert.match(postmortemWords(wrongBand, 'none'), /it really carries 85 g/);
  assert.match(postmortemWords(rightFeel, null), /right about four times in five/);
  for (const pick of ['magnitude', 'unit-slip', 'none']) {
    assert.doesNotMatch(postmortemWords(wrongBand, pick), /you (never|always|should)/i);
  }
});

test('the kid’s call is reported back as a call, not a grade', () => {
  assert.match(callWords(wrongFeel, 'trusted'), /trusted it — and it was wrong/);
  assert.match(callWords(rightFeel, 'trusted'), /trusted it, and it was right/);
  assert.match(callWords(wrongFeel, 'doubted'), /Good catch/);
  assert.match(callWords(rightFeel, 'doubted'), /doubted it, but it was right/);
  assert.match(callWords(wrongFeel, 'deferred'), /That is a real answer/, 'knowing your limit is an answer');
  assert.equal(callWords(null, 'trusted'), '');
});
