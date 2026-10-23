// The lens only asks (invariant 5), and it cannot see the other side's
// brief — enforced here, not just stated.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { cue, ALL_CUES, pinnedNotes, OFFER_LETTER as B, commitPrep } from '../negotiation/index.js';

test('every cue is a question, with no number in it and no verdict on the kid', () => {
  assert.ok(ALL_CUES.length > 20);
  for (const c of ALL_CUES) {
    assert.match(c, /\?$/, `not a question: ${c}`);
    assert.doesNotMatch(c, /\d/, `a number in a cue: ${c}`);
    assert.doesNotMatch(c, /you seem|you are being|you're being|you should|try /i, `the coach told instead of asked: ${c}`);
  }
});

test('the lens module imports nothing that could hold a brief', async () => {
  const src = await readFile(new URL('../negotiation/lens.js', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /^\s*import\b/m, 'lens.js must stand alone');
});

test('no cue carries a word of the hidden brief', () => {
  const manager = B.parties.find((p) => p.id === 'manager');
  const hidden = [manager.position, manager.interest, manager.fear, ...manager.brief, ...Object.values(B.voice)]
    .join(' ')
    .toLowerCase()
    .match(/[a-z']{6,}/g); // distinctive words only
  const distinctive = new Set(hidden.filter((w) => !['should', 'really', 'before', 'anything', 'thinking', 'through', 'something', 'because', 'another'].includes(w)));
  const moments = [{ move: 'open' }, { move: 'walked' }, { move: 'closed' }, { move: 'beforeOffer' }];
  for (const key of ['mirror:talk', 'label:right', 'offer:counter', 'offer:cap', 'pressure:once', 'ultimatum:walk', 'pitch:talk', 'silence:quiet']) {
    const [move, reaction] = key.split(':');
    moments.push({ move, reaction });
  }
  for (const m of moments) {
    for (let turn = 0; turn < 4; turn++) {
      const c = cue(m, turn).toLowerCase();
      for (const w of c.match(/[a-z']{6,}/g) ?? []) {
        // words a coach needs that also appear in any character's mouth
        if (['matters', 'nothing', 'minute', 'change', 'offer', 'deadline', 'question', 'already', 'between'].includes(w)) continue;
        assert.ok(!distinctive.has(w) || ['finance', 'launch', 'quarter', 'headcount', 'closes'].every((h) => w !== h), `hidden word in a cue: ${w}`);
      }
      assert.doesNotMatch(c, /finance|launch|quarter|headcount|\$|110/);
    }
  }
});

test('prep notes are the user\'s own commitments, in the names the user already has', () => {
  const prep = commitPrep(B, 'manager', {
    ranking: ['remote', 'salary', 'start', 'bonus', 'title'],
    walkAway: { lo: 100, hi: 110 },
    worry: 'office',
  });
  const names = {
    issue: (id) => B.issues.find((i) => i.id === id).name,
    value: (v) => `$${v}k`,
    worry: (id) => B.worries.find((w) => w.id === id).text,
  };
  const notes = pinnedNotes(prep, names);
  assert.equal(notes.length, 4);
  assert.match(notes[0], /Remote days/);
  assert.match(notes[2], /\$100k–\$110k/);
  assert.match(notes[3], /office/);
  assert.deepEqual(pinnedNotes(null, names), []);
});
