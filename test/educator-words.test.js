// The adult-only packet in words (demo/educator-words.js). The signals
// themselves are engine/journal.js's and coach/educator.js's; nothing
// here detects anything. Two things the tests hold onto: the words
// describe a situation and never label a kid, and a kid's call on the
// Consultant is reported as the separate commitment it is.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SIGNALS,
  signalWords,
  actionWords,
  relianceWords,
  predictionText,
  outcomeText,
  wasHit,
  consultantText,
} from '../demo/educator-words.js';

test('a signal describes what was seen, not who the kid is', () => {
  for (const [signal, words] of Object.entries(SIGNALS)) {
    assert.equal(signalWords(signal), words);
    assert.doesNotMatch(words, /\bis (a|an) \w+ kid\b/i);
    assert.doesNotMatch(words, /lazy|bright|slow|gifted/i);
  }
  assert.match(signalWords('bored'), /problems are too easy/, 'bored is a property of the problems');
  assert.equal(signalWords(null), 'Nothing flagged.');
});

test('the response ladder says what to try, with its direction', () => {
  assert.match(actionWords({ signal: 'bored', action: 'adjust-depth', direction: 'up' }), /depth up\./);
  assert.match(actionWords({ signal: 'overwhelmed', action: 'adjust-depth', direction: 'down' }), /depth down\./);
  assert.match(actionWords({ signal: 'bored', action: 'raise-sim-cost' }), /cost something/);
  assert.match(actionWords({ signal: 'unclear-ask-debrief', action: 'debrief' }), /Ask them/);
  assert.equal(actionWords(null), '');
});

test('leaning on the coach reads as counts, never as a verdict on the kid', () => {
  assert.equal(relianceWords({ asks: 0 }), '0 asks');
  const heavy = relianceWords({ asks: 14, over: 3, nearGuard: true, resting: true, reliant: true });
  assert.match(heavy, /14 asks/);
  assert.match(heavy, /3 past the pacing meter/);
  assert.match(heavy, /neared the day’s credit guard/);
  assert.match(heavy, /asking far more than building/);
});

test('an attempt reads as what was said and what reality did', () => {
  const band = { kind: 'band', prediction: { lo: 40, hi: 90 }, outcome: 85, range: 500 };
  assert.equal(predictionText(band), '40–90 g');
  assert.equal(outcomeText(band), '85 g');
  assert.equal(wasHit(band), true);
  assert.equal(wasHit({ ...band, outcome: 120 }), false);
  const binary = { kind: 'binary', prediction: 'holds', outcome: 'breaks' };
  assert.equal(predictionText(binary), 'holds');
  assert.equal(wasHit(binary), false);
});

test('the Consultant column keeps the second commitment separate', () => {
  assert.equal(consultantText({ consultant: null }), '—');
  assert.match(consultantText({ consultant: { wrong: false, call: 'trusted' } }), /trusted · it was right/);
  assert.match(
    consultantText({ consultant: { wrong: true, call: 'trusted', caught: 'never' } }),
    /it was wrong, did not catch it/,
  );
  assert.match(
    consultantText({ consultant: { wrong: true, call: 'doubted', caught: 'before' } }),
    /doubted · it was wrong, doubted it before the test/,
  );
  assert.match(
    consultantText({ consultant: { wrong: true, call: 'deferred', caught: 'postmortem' } }),
    /couldn’t judge, ran it · it was wrong, named the error afterwards/,
  );
});
