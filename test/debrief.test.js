// The debrief's words and what travels with them (demo/debrief.js).
// The trigger is engine/journal.js's; these are the questions a kid is
// actually asked, which must work with no coach at all, must never
// classify the kid, and must leave "I don't know" free to say
// (decisions 2026-10-25, the debrief §3–§5).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEBRIEF_QUESTIONS, debriefQuestion, debriefChoices, attemptsFor, debriefRecord } from '../demo/debrief.js';

test('each kind has a canned question, so a keyless table still gets one', () => {
  for (const kind of ['resolved', 'failed', 'throwaway']) {
    const q = debriefQuestion(kind);
    assert.ok(q && q.endsWith('?'), `${kind} asks a question`);
  }
  assert.equal(debriefQuestion('nonsense'), null);
  assert.match(DEBRIEF_QUESTIONS.resolved, /different/, 'the resolved kind points at the contrast');
  assert.equal(
    DEBRIEF_QUESTIONS.failed,
    'What were you trying to find out with that build?',
    '2026-10-19 §7’s core question, unchanged',
  );
  assert.equal(DEBRIEF_QUESTIONS.throwaway, DEBRIEF_QUESTIONS.failed, '§5: the same question separates them');
});

test('the questions ask about the build, never about the kid', () => {
  for (const q of Object.values(DEBRIEF_QUESTIONS)) {
    assert.doesNotMatch(q, /you seem|you are|you have been|bored|lazy|guessing/i);
  }
});

test('“not sure” is always there to tap, and is an answer like any other', () => {
  for (const kind of ['resolved', 'failed', 'throwaway']) {
    const choices = debriefChoices(kind);
    assert.ok(choices.length >= 4);
    for (const c of choices) assert.ok(c.icon && c.label && c.said);
    const dunno = choices.find((c) => /don't know/i.test(c.said));
    assert.ok(dunno, `${kind} lets the kid say they don't know`);
  }
  assert.notDeepEqual(debriefChoices('resolved'), debriefChoices('failed'));
});

test('the coach is told the kid’s own attempts on this problem, and nothing else', () => {
  const entries = [
    { level: 'a', kind: 'binary', prediction: 'holds', outcome: 'breaks', ants: 10, hardestPct: 141, signal: 'bored' },
    { level: 'b', kind: 'binary', prediction: 'holds', outcome: 'holds', ants: 9, hardestPct: 50 },
    { level: 'a', kind: 'band', prediction: { lo: 40, hi: 90 }, outcome: 85, ants: 16, hardestPct: 97 },
  ];
  const attempts = attemptsFor(entries, 'a');
  assert.equal(attempts.length, 2, 'only this problem');
  assert.deepEqual(attempts[1], { said: '40-90 g', happened: '85 g', links: 16, hardestPct: 97 });
  for (const a of attempts) {
    assert.deepEqual(Object.keys(a).sort(), ['happened', 'hardestPct', 'links', 'said']);
  }
  assert.equal(JSON.stringify(attempts).includes('bored'), false, 'no adult signal travels with it');
});

test('an answer and a skip are both recorded, and a skip is not a failure', () => {
  assert.deepEqual(debriefRecord('resolved', 'I used more ants.'), {
    kind: 'resolved',
    said: 'I used more ants.',
  });
  assert.deepEqual(debriefRecord('failed', null), { kind: 'failed', said: null });
  assert.equal(debriefRecord('failed', 'x'.repeat(500)).said.length, 200);
});
