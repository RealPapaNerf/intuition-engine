// The negotiators pack against hand calculations: the point arithmetic
// of a hidden brief, the Pareto frontier, the predict gate's scoring,
// and the counterpart's discoverable rules.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateBrief,
  points,
  priorities,
  paretoFrontier,
  judgeDeal,
  moneyOnTheTable,
  allDeals,
  violatesCap,
  OFFER_LETTER as B,
  makeCounterpart,
  respond,
  remember,
  RULES,
  margin,
  turningPoint,
  commitPrep,
  scorePrep,
  footrule,
  reactionEntry,
} from '../negotiation/index.js';
import { makeJournal, record, calibration } from '../engine/journal.js';

// A two-issue brief small enough to do on paper. Issue A is a straight
// fight (p wants 1, q wants 0); issue B is compatible (both want 1).
const TINY = validateBrief({
  id: 'tiny',
  user: 'p',
  counterpart: 'q',
  parties: [
    { id: 'p', reservation: 4 },
    { id: 'q', reservation: 8 },
  ],
  issues: [
    { id: 'A', name: 'A', options: ['a0', 'a1'], points: { p: [0, 10], q: [10, 0] } },
    { id: 'B', name: 'B', options: ['b0', 'b1'], points: { p: [0, 4], q: [0, 8] } },
  ],
});

test('points add up per side, by hand', () => {
  // A1B0: p = 10 + 0, q = 0 + 0
  assert.equal(points(TINY, 'p', { A: 1, B: 0 }), 10);
  assert.equal(points(TINY, 'q', { A: 1, B: 0 }), 0);
  // A0B1: p = 0 + 4, q = 10 + 8
  assert.equal(points(TINY, 'p', { A: 0, B: 1 }), 4);
  assert.equal(points(TINY, 'q', { A: 0, B: 1 }), 18);
  assert.equal(allDeals(TINY).length, 4);
});

test('the Pareto frontier is the two deals with the compatible issue settled right', () => {
  // (p,q): A0B0 (0,10), A0B1 (4,18), A1B0 (10,0), A1B1 (14,8).
  // A0B1 dominates A0B0; A1B1 dominates A1B0. The other two stand.
  const f = paretoFrontier(TINY).map((d) => `${d.A}${d.B}`).sort();
  assert.deepEqual(f, ['01', '11']);
  const j = judgeDeal(TINY, { A: 1, B: 0 });
  assert.equal(j.joint, 10);
  assert.equal(j.maxJoint, 22); // A0B1: 4 + 18
  assert.equal(j.efficiency, 10 / 22);
  assert.equal(j.onFrontier, false);
  assert.deepEqual(moneyOnTheTable(TINY, { A: 1, B: 0 }), { A: 1, B: 1 });
  // p cleared 4, q did not clear 8: a loss for both by the brief's rule
  assert.equal(j.bothWin, false);
  assert.equal(judgeDeal(TINY, { A: 1, B: 1 }).bothWin, true);
  assert.equal(judgeDeal(TINY, { A: 1, B: 1 }).moneyOnTheTable, null);
});

test('a brief that cannot be honest is refused', () => {
  assert.throws(
    () => validateBrief({ id: 'x', parties: [{ id: 'p', reservation: 1 }, { id: 'q', reservation: 99 }], issues: TINY.issues }),
    /can never reach its reservation/,
  );
  assert.throws(
    () => validateBrief({ id: 'x', parties: [{ id: 'p', reservation: 1 }], issues: TINY.issues }),
    /exactly two parties/,
  );
  assert.throws(() => {
    B.issues[0].points.manager[0] = 999;
  }, TypeError);
  assert.throws(() => {
    B.parties[1].reservation = 0;
  }, TypeError);
});

test('the Offer Letter: priorities by swing, the cap, and the shape of its frontier', () => {
  assert.deepEqual(priorities(B, 'manager'), ['start', 'salary', 'remote', 'title', 'bonus']);
  assert.deepEqual(priorities(B, 'candidate'), ['remote', 'salary', 'start', 'bonus', 'title']);
  assert.equal(violatesCap(B, 'manager', { salary: 4, start: 0, remote: 0, bonus: 0, title: 0 }), 'salary');
  assert.equal(violatesCap(B, 'manager', { salary: 3, start: 0, remote: 0, bonus: 0, title: 0 }), null);
  const frontier = paretoFrontier(B);
  // The compatible issue: every efficient deal carries the senior title.
  assert.ok(frontier.every((d) => d.title === 1));
  // The logroll: the manager gets her start date, the candidate the remote days.
  const logroll = { salary: 2, start: 0, remote: 3, bonus: 2, title: 1 };
  assert.ok(frontier.some((d) => Object.keys(d).every((k) => d[k] === logroll[k])));
  const j = judgeDeal(B, logroll);
  assert.equal(j.points.candidate, 20 + 0 + 45 + 14 + 15);
  assert.equal(j.points.manager, 20 + 45 + 0 + 4 + 12);
  assert.ok(j.bothWin);
  // Trading the title away "to get something" is pure loss: a deal
  // exists that is better for both, and every such deal has the title.
  const traded = { ...logroll, title: 0 };
  const better = moneyOnTheTable(B, traded);
  assert.equal(better.title, 1);
  assert.ok(points(B, 'candidate', better) >= points(B, 'candidate', traded));
  assert.ok(points(B, 'manager', better) > points(B, 'manager', traded));
});

test('the predict gate: ranking, wall and worry scored against the brief, into the journal', () => {
  const prep = commitPrep(B, 'manager', {
    ranking: ['salary', 'start', 'remote', 'bonus', 'title'],
    walkAway: { lo: 105, hi: 112 },
    worry: 'deadline',
  });
  const s = scorePrep(B, prep);
  assert.equal(s.ranking.footrule, 1 + 1 + 0 + 1 + 1); // salary/start swapped, bonus/title swapped
  assert.equal(s.wall.actual, 110);
  assert.equal(s.wall.hit, true);
  assert.equal(s.worry.hit, true);
  const j = makeJournal();
  for (const e of s.entries) record(j, e);
  const c = calibration(j);
  assert.equal(c.total, 3);
  assert.equal(c.hits, 2); // top priority wrong, wall and worry right
  assert.equal(footrule(['a', 'b'], ['a', 'b']), 0);
  assert.throws(() => commitPrep(B, 'manager', { ranking: ['salary'], walkAway: { lo: 1, hi: 2 }, worry: 'deadline' }), /every issue/);
  assert.throws(() => commitPrep(B, 'manager', { ranking: priorities(B, 'manager'), walkAway: { lo: 5, hi: 2 }, worry: 'deadline' }), /hi >= lo/);
  record(j, reactionEntry(B, 'counter', 'accept'));
  assert.equal(calibration(j).hits, 2);
});

const lowball = { salary: 4, start: 3, remote: 3, bonus: 3, title: 1 }; // everything the candidate wants
const fair = { salary: 2, start: 0, remote: 3, bonus: 2, title: 1 }; // the logroll

function play(moves, memory = null) {
  let s = makeCounterpart(B, { memory });
  const replies = [];
  for (const m of moves) {
    const r = respond(B, s, m);
    s = r.state;
    replies.push(r.reply);
  }
  return { s, replies };
}

test('trust buys flexibility: the margin rule, by hand', () => {
  assert.equal(margin(0), 10);
  assert.equal(margin(3), 4);
  assert.equal(margin(5), 0);
  assert.equal(margin(9), 0);
});

test('an offer is weighed with the hidden schedule: accept at reservation plus margin, else counter toward what she values', () => {
  // fair gives the manager 81 ≥ 50 + 10: accepted cold.
  const { s, replies } = play([{ kind: 'offer', deal: fair }]);
  assert.equal(replies[0].reaction, 'accept');
  assert.equal(s.done, 'accepted');

  // Everything the candidate wants violates the salary cap: the counter
  // starts from the cap (manager: 10 + 0 + 0 + 0 + 12 = 22), then asks
  // on the issue with the most left to gain: start date (45 left vs 30
  // on salary) 12 → 8 weeks (+10 = 32), 8 → 4 weeks (+20 = 52); now 15
  // is left on start and 30 on salary, so salary $110k → $105k (+10 =
  // 62 ≥ 60). Remote days, bonus and title untouched: the counter *is*
  // the tell about what she values.
  const r = play([{ kind: 'offer', deal: lowball }]);
  assert.equal(r.replies[0].reaction, 'cap');
  const c = r.s.counter;
  assert.deepEqual(c, { salary: 2, start: 1, remote: 3, bonus: 3, title: 1 });
  assert.equal(points(B, 'manager', c), 62);
  assert.equal(r.s.topic, 'start');
  assert.match(r.replies[0].text, /\$110k/);
});

test('a far-off offer costs trust, unless the accusation audit went first', () => {
  const cold = { salary: 3, start: 3, remote: 3, bonus: 3, title: 1 }; // manager: 10+0+0+0+12 = 22 < 50-20
  const bare = play([{ kind: 'offer', deal: cold }]);
  assert.equal(bare.replies[0].reaction, 'insult');
  assert.equal(bare.s.meter.trust, RULES.insult);
  const audited = play([{ kind: 'audit' }, { kind: 'offer', deal: cold }]);
  assert.equal(audited.replies[1].reaction, 'counter');
  assert.equal(audited.s.meter.trust, RULES.audit);
  // the shield is for the first offer only
  const again = play([{ kind: 'audit' }, { kind: 'offer', deal: cold }, { kind: 'offer', deal: cold }]);
  assert.equal(again.replies[2].reaction, 'insult');
});

test('listening gathers information: questions reveal priorities in order; the right label gets "that\'s right"', () => {
  const { s, replies } = play([{ kind: 'question' }, { kind: 'question' }, { kind: 'label', worry: 'money' }, { kind: 'label', worry: 'deadline' }]);
  assert.match(replies[0].text, /start date/);
  assert.match(replies[1].text, /salary/);
  assert.equal(replies[2].reaction, 'wrong');
  assert.equal(replies[3].reaction, 'right');
  assert.match(replies[3].text, /^That's right/);
  assert.equal(s.meter.trust, RULES.question * 2 + RULES.labelWrong + RULES.labelRight);
  assert.ok(s.revealed.includes('interest'));
});

test('mirrors draw out a position on the live topic; too many in a row annoy', () => {
  const { replies } = play([{ kind: 'question' }, { kind: 'mirror' }, { kind: 'mirror' }, { kind: 'mirror' }]);
  assert.match(replies[1].text, /start date, in 2 weeks/);
  assert.equal(replies[2].reaction, 'talk');
  assert.equal(replies[3].reaction, 'annoyed');
});

test('a pressure move works once, then poisons the meter and the next session', () => {
  const mid = { salary: 3, start: 2, remote: 3, bonus: 3, title: 1 }; // manager 32
  const warm = [{ kind: 'audit' }, { kind: 'question' }]; // trust 3
  const once = play([...warm, { kind: 'offer', deal: mid }, { kind: 'pressure' }]);
  assert.equal(once.replies[3].reaction, 'once');
  assert.equal(once.s.meter.trust, 3 + RULES.pressureOnce);
  // the free pass: her counter clears bare reservation, no margin. From
  // 32, start 8 → 4 weeks is +20 = 52; a step back would cost 20 and
  // drop her under 50, and salary is capped, so nothing comes back.
  assert.deepEqual(once.s.counter, { salary: 3, start: 1, remote: 3, bonus: 3, title: 1 });
  assert.equal(points(B, 'manager', once.s.counter), 52);
  const twice = play([...warm, { kind: 'offer', deal: mid }, { kind: 'pressure' }, { kind: 'pressure' }]);
  assert.equal(twice.replies[4].reaction, 'burned');
  assert.equal(twice.s.meter.trust, 3 + RULES.pressureOnce + RULES.pressureBurned);
  // cold, the second pressure is also the last straw
  const cold = play([{ kind: 'offer', deal: mid }, { kind: 'pressure' }, { kind: 'pressure' }]);
  assert.equal(cold.s.done, 'walked');
  const memory = remember(twice.s);
  assert.deepEqual(memory, { burned: true });
  const next = makeCounterpart(B, { memory });
  assert.equal(next.meter.trust, RULES.startBurned);
  assert.match(next.transcript[0].text, /last time/);
});

test('an ultimatum she cannot take: she stays at good trust and walks at bad', () => {
  const bad = { salary: 3, start: 3, remote: 3, bonus: 3, title: 1 };
  const cold = play([{ kind: 'ultimatum', deal: bad }]);
  assert.equal(cold.replies[0].reaction, 'walk');
  assert.equal(cold.s.done, 'walked');
  const warm = play([{ kind: 'audit' }, { kind: 'question' }, { kind: 'ultimatum', deal: bad }]);
  assert.equal(warm.replies[2].reaction, 'stay');
  assert.equal(warm.s.done, null);
  assert.equal(warm.s.meter.trust, RULES.audit + RULES.question + RULES.ultimatum);
});

test('enough trust and she volunteers; enough contempt and she leaves', () => {
  const warm = play([{ kind: 'audit' }, { kind: 'label', worry: 'deadline' }, { kind: 'question' }]);
  // trust 2 → 5 → 6: priorities 1 and 2 volunteered by threshold
  assert.ok(warm.s.revealed.includes('p1') && warm.s.revealed.includes('p2'));
  const cold = play([{ kind: 'pitch' }, { kind: 'pitch' }, { kind: 'pitch' }]);
  assert.equal(cold.s.done, 'walked');
  assert.equal(cold.replies[2].reaction, 'walk');
});

test('accepting her counter closes; the replay finds the line where it turned', () => {
  const { s } = play([{ kind: 'pitch' }, { kind: 'offer', deal: lowball }, { kind: 'label', worry: 'deadline' }, { kind: 'accept' }]);
  assert.equal(s.done, 'closed');
  assert.deepEqual(s.deal, s.counter);
  const tp = turningPoint(s.meter);
  assert.equal(tp.why, 'label-right');
  const fell = play([{ kind: 'pitch' }, { kind: 'pitch' }, { kind: 'pitch' }]);
  assert.equal(turningPoint(fell.s.meter).turn, 1);
});

test('HARD CONSTRAINT: the counterpart never reads a clock (the feed line)', () => {
  const moves = [{ kind: 'audit' }, { kind: 'question' }, { kind: 'offer', deal: lowball }, { kind: 'mirror' }, { kind: 'label', worry: 'deadline' }, { kind: 'accept' }];
  const quick = play(moves.map((m, i) => ({ ...m, at: 1000 + i * 10, durationMs: 10 })));
  const slow = play(moves.map((m, i) => ({ ...m, at: 1000 + i * 3_600_000, durationMs: 3_600_000 })));
  assert.deepEqual(quick.s, slow.s);
  assert.deepEqual(quick.replies, slow.replies);
});
