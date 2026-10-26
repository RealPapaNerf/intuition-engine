// Pull It Apart's words: the cascade says what the solver found, in the
// system's own names; the Consultant's wrong claims read exactly like
// its right ones; the follow-ups ask and never tell.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LIBRARY, runSystem, normalsOf, pull, swapBad, block, addCopy, place, changes, ask, consult } from '../systems/index.js';
import {
  changeWords,
  eventWords,
  truthWords,
  claimWords,
  wrongKinds,
  timeWords,
  onScale,
  EXPLAIN_QUESTION,
  EXPLAIN_CHOICES,
  DEBRIEF_RESOLVED,
  DEBRIEF_FOR,
} from '../demo/apart-words.js';

const sys = (id) => LIBRARY.find((s) => s.id === id);
const F = sys('flashlight');
const C = sys('car');
const K = sys('kidneys');

test('the cascade says what broke and why, with the numbers and units the solver found', () => {
  const r = runSystem(F, swapBad(F, {}, 'resistor', 'jumper'), { normal: normalsOf(runSystem(F)) });
  const lines = r.events.map((e) => (e.kind === 'changed' ? changeWords(F, e) : eventWords(F, e)));
  assert.equal(lines[0], 'You put in a plain wire instead.');
  assert.match(lines[1], /^At 1 s: 💥 Light \(LED\) broke: too much through it \(115 mA; it can take 30\.0 mA\)\.$/);
  assert.ok(lines.includes('At 2 s: The light went dark.'));
  const car = runSystem(C, pull(C, {}, 'alternator'), { normal: normalsOf(runSystem(C)) });
  const spark = car.events.find((e) => e.flow === 'make-spark');
  assert.match(eventWords(C, spark), /Spark plugs stopped — battery charge got too low \(under 9\.00 V\)/);
});

test('every change the bench can hold is said back', () => {
  const b = block(F, place(F, addCopy(F, {}, 'resistor'), 'resistor#2', 'resistor', 'inline'), 'return');
  const said = changes(F, b).map((c) => changeWords(F, c));
  assert.deepEqual(said, ['You added another Resistor in line with Resistor.', '⛔ You blocked Wire back: wire out of the light → the batteries’ minus end.']);
  assert.equal(changeWords(K, changes(K, pull(K, {}, 'left-kidney'))[0]), 'You took out Left kidney.');
});

test('what happened is said for every kind of question', () => {
  const b = pull(K, {}, 'left-kidney');
  const reading = ask(K, b, { mode: 'measure', kind: 'reading', seed: 's' });
  assert.equal(truthWords(K, reading, { value: 8, maxed: false }), 'It was 8 mmol/L.');
  assert.equal(truthWords(K, reading, { value: 80, maxed: true }), 'More than the scale goes: past 80 mmol/L.');
  assert.equal(truthWords(K, { type: 'works' }, { value: 'works' }), `It still works: ${K.goal.says}`);
  assert.equal(truthWords(K, { type: 'first' }, { value: 'nothing', set: ['nothing'] }), 'Nothing else stopped.');
  assert.match(truthWords(K, { type: 'direction', about: { node: 'blood' } }, { value: 'up', before: 4, after: 8 }), /^It went up: 4\.00 mmol\/L before, 8\.00 mmol\/L after\.$/);
  assert.match(truthWords(C, { type: 'when' }, { value: 10, maxed: false }), /^It stopped doing its job at about 10 min\.$/);
});

test('the Consultant sounds the same right or wrong: no tells in the words', () => {
  const b = pull(K, {}, 'left-kidney');
  const q = ask(K, b, { kind: 'works', seed: 's' });
  const right = claimWords(K, q, { claim: 'works', wrong: false });
  const wrong = claimWords(K, q, { claim: 'fails', wrong: true });
  assert.match(right, /^🤖 The Consultant says: “It will still do its job\.”$/);
  assert.match(wrong, /^🤖 The Consultant says: “It will stop doing its job\.”$/);
  const r = consult({ system: K, bench: b, question: ask(K, b, { mode: 'measure', kind: 'reading', seed: 's' }), seed: 'x' });
  assert.doesNotMatch(claimWords(K, ask(K, b, { mode: 'measure', kind: 'reading', seed: 's' }), r), /maybe|probably|not sure|i think/i);
});

test('the postmortem offers the kinds of wrong that question can carry, and "it was right"', () => {
  for (const type of ['works', 'direction', 'reading']) {
    const kinds = wrongKinds({ type });
    assert.equal(kinds[kinds.length - 1].id, 'none');
    assert.ok(kinds.length >= 3);
  }
});

test('the follow-ups ask, never tell; "not sure" is always there', () => {
  assert.match(EXPLAIN_QUESTION, /\?$/);
  for (const list of [EXPLAIN_CHOICES, DEBRIEF_RESOLVED, DEBRIEF_FOR]) {
    assert.ok(list.some((c) => c.label === 'not sure'), 'saying so is free');
    for (const c of list) assert.doesNotMatch(c.said, /you seem|you are|bored|lazy/i, 'never classifies the kid');
  }
});

test('time and readings read the way a kid reads them', () => {
  assert.equal(timeWords(38.75, 'h'), '39 h');
  assert.equal(timeWords(60, 'h'), '60 h (day 3)');
  assert.equal(timeWords(7.9, 'min'), '7.9 min');
  assert.equal(onScale(8, 1, 'mmol/L'), '8 mmol/L');
  assert.equal(onScale(1030, 10, 'viruses'), '1,030 viruses');
  assert.equal(onScale(2.5, 0.5, 'h'), '2.5 h');
});
