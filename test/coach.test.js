// The coach's door (decisions 2026-10-25 §3), against a stand-in Claude:
// the caps guard the credits, the leash is checked rather than trusted,
// grants are earned against a replayed level, and the coach is told only
// what the kid can see.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  makeCoach,
  budgetFor,
  CANNED_QUESTIONS,
  COACH_BUDGET,
  COACH_MODEL,
  FALLBACK_QUESTION,
} from '../coach/service.js';
import { makeFixtureLibrary } from '../coach/library.js';

function claude(script) {
  const calls = [];
  const fetchFn = async (url, init) => {
    const body = JSON.parse(init.body);
    calls.push({ url, headers: init.headers, body });
    const r = typeof script === 'function' ? script(body, calls.length) : script;
    if (r.status && r.status !== 200) return { ok: false, status: r.status };
    return {
      ok: true,
      json: async () => ({
        stop_reason: r.stop ?? 'end_turn',
        content: [{ type: 'text', text: JSON.stringify(r.reply) }],
        usage: { input_tokens: r.inTok ?? 1000, output_tokens: r.out ?? 50 },
      }),
    };
  };
  return { fetchFn, calls };
}

const ASK = { kid: 'Pia', said: 'why did it break?', state: { mode: 'feel' } };

test('no key, no coach — and no call ever leaves the house', async () => {
  const { fetchFn, calls } = claude({ reply: { question: 'Hm?', grant: null } });
  const coach = makeCoach({ apiKey: undefined, fetch: fetchFn });
  assert.deepEqual(await coach.ask(ASK), { on: false, why: 'no-key' });
  assert.equal(calls.length, 0);
});

test('a question comes back as asked, with the bill the kid will see', async () => {
  const { fetchFn, calls } = claude({
    reply: { question: 'Where did it snap first?', grant: null },
  });
  const coach = makeCoach({ apiKey: 'k', fetch: fetchFn });
  const r = await coach.ask(ASK);
  // 1000 in at 400 ¢/MTok + 50 out at 2000 ¢/MTok = half a cent.
  assert.deepEqual(r, {
    on: true,
    question: 'Where did it snap first?',
    grant: null,
    cost: { turn: 0.5, today: 0.5 },
    left: { calls: budgetFor(0) - 1, cents: 99.5 },
  });
  const { headers, body } = calls[0];
  assert.equal(body.model, COACH_MODEL);
  assert.equal(body.fallbacks, 'default');
  assert.equal(headers['anthropic-beta'], 'server-side-fallback-2026-07-01');
  assert.equal(body.output_config.format.type, 'json_schema');
  assert.ok(headers['x-api-key'], 'the key rides the header, never the page');
});

test('the coach is told only what the kid can see', async () => {
  const { fetchFn, calls } = claude({ reply: { question: 'And then?', grant: null } });
  const coach = makeCoach({ apiKey: 'k', fetch: fetchFn });
  await coach.ask({
    kid: 'Pia',
    said: 'more ants please',
    state: {
      mode: 'measure',
      linksPlaced: 12,
      calibration: { total: 9, hits: 7, streak: 3 },
      // none of this may reach the prompt, whatever a client posts:
      adultFlag: { signal: 'bored' },
      fingerprint: 'bored',
      debriefAnswer: 'I dunno',
    },
  });
  const sent = calls[0].body.messages.at(-1).content;
  assert.ok(!sent.includes('bored'), 'adult-only signals never reach the coach');
  assert.ok(!sent.includes('dunno'));
  const parsed = JSON.parse(sent);
  assert.equal(parsed.said, 'more ants please');
  assert.deepEqual(parsed.state.calibration, { total: 9, hits: 7, streak: 3 });
  assert.equal(parsed.state.mode, 'measure');
  assert.ok(!('adultFlag' in parsed.state));
  assert.equal(parsed.state.questionsLeft, budgetFor(0) - 1, 'the kid’s budget rides along');
});

test('a reply that is not a question is replaced, never passed through', async () => {
  const { fetchFn } = claude({
    reply: { question: 'Your bridge will hold 240 g. Trust me.', grant: null },
  });
  const coach = makeCoach({ apiKey: 'k', fetch: fetchFn });
  const r = await coach.ask(ASK);
  assert.equal(r.question, FALLBACK_QUESTION);
});

test('a refusal or an overrun falls back to the canned question', async () => {
  for (const stop of ['refusal', 'max_tokens']) {
    const { fetchFn } = claude({ stop, reply: { question: 'ignored?', grant: null } });
    const r = await makeCoach({ apiKey: 'k', fetch: fetchFn }).ask(ASK);
    assert.deepEqual([r.on, r.question, r.grant], [true, FALLBACK_QUESTION, null], stop);
  }
});

test('a granted slug arrives in SI, validated against the replayed level', async () => {
  const { fetchFn } = claude({
    reply: {
      question: 'One slug! What will 80 slimy grams do to your bridge?',
      grant: { kind: 'cargo', name: 'Slug', grams: 80 },
    },
  });
  const r = await makeCoach({ apiKey: 'k', fetch: fetchFn }).ask(ASK);
  assert.deepEqual(r.grant, { kind: 'cargo', name: 'Slug', mass: 0.08 });
});

test('a grant the world cannot hold is dropped, the question kept', async () => {
  const bad = [
    { kind: 'cargo', name: 'Moose', grams: 900000 },
    { kind: 'links', count: 500 },
    { kind: 'stock', material: 'silk', count: 10000 },
    { kind: 'anchor', points: [[99, 99]] },
    { kind: 'wish', count: 1 },
  ];
  for (const grant of bad) {
    const { fetchFn } = claude({ reply: { question: 'Here you go?', grant } });
    const r = await makeCoach({ apiKey: 'k', fetch: fetchFn }).ask(ASK);
    assert.equal(r.on, true);
    assert.equal(r.grant, null, JSON.stringify(grant));
    assert.equal(r.question, 'Here you go?');
  }
});

test('grants are judged against the grant list, not the client’s level object', async () => {
  // 30 granted links already; 10 more would pass the base jar but not
  // the variant's. The replay catches it even if a client lied by hand.
  const { fetchFn } = claude({
    reply: { question: 'More?', grant: { kind: 'links', count: 10 } },
  });
  const coach = makeCoach({ apiKey: 'k', fetch: fetchFn });
  const r = await coach.ask({
    ...ASK,
    state: { grants: [{ kind: 'links', count: 30 }], jar: 1 },
  });
  assert.equal(r.grant, null, 'jar-full on the replayed variant');

  const bad = await coach.ask({ ...ASK, state: { grants: [{ kind: 'links', count: 999 }] } });
  assert.deepEqual(bad, { on: false, why: 'bad-state' });
});

test('the budget is a meter, not a wall: past it the coach keeps answering', async () => {
  const { fetchFn, calls } = claude({ reply: { question: 'Hm?', grant: null } });
  const coach = makeCoach({
    apiKey: 'k',
    fetch: fetchFn,
    budget: { startCalls: 2, floorCalls: 2, shrinkEvery: 1e9 },
  });
  assert.equal((await coach.ask(ASK)).on, true);
  assert.equal((await coach.ask(ASK)).on, true);
  const over = await coach.ask(ASK); // past the meter — still answered
  assert.equal(over.on, true);
  assert.equal(over.question, 'Hm?');
  assert.equal(over.left.calls, 0);
  assert.equal(calls.length, 3, 'the third ask still calls out');
  const third = JSON.parse(calls[2].body.messages.at(-1).content).state;
  assert.equal(third.overBudget, true, 'the coach is told, and shifts posture');
  assert.equal(third.questionsLeft, 0, 'the meter never goes negative on the kid');
  assert.equal(JSON.parse(calls[0].body.messages.at(-1).content).state.overBudget, false);
});

test('the cents guard is the one wall — and behind it, the free deck', async () => {
  let day = Date.parse('2026-10-25T10:00:00Z');
  const { fetchFn, calls } = claude({ reply: { question: 'Hm?', grant: null } });
  const coach = makeCoach({ apiKey: 'k', fetch: fetchFn, caps: { dayCents: 1 }, now: () => day });
  assert.equal((await coach.ask(ASK)).resting, undefined);
  assert.equal((await coach.ask(ASK)).on, true); // today now 1.0 of 1
  const rested = await coach.ask(ASK);
  assert.equal(calls.length, 2, 'a tripped guard never calls out');
  assert.equal(rested.on, true, 'the kid still gets a question');
  assert.equal(rested.resting, true);
  assert.ok(CANNED_QUESTIONS.includes(rested.question), 'the free deck answers');
  assert.deepEqual(rested.cost, { turn: 0, today: 1 });
  assert.equal(rested.grant, null, 'grants wait for morning');
  const again = await coach.ask(ASK);
  assert.notEqual(again.question, rested.question, 'the deck rotates, not a broken record');

  day += 24 * 60 * 60 * 1000; // the next morning
  assert.equal((await coach.ask(ASK)).resting, undefined, 'morning refills the jar');
  assert.equal(calls.length, 3);
});

test('every ask is reported to the educator window, which never blocks one', async () => {
  const notes = [];
  const educator = { noteAsk: (kid, info) => notes.push([kid, info.nearGuard, info.resting === true]) };
  // 1000 in at 400 ¢/MTok + 500 out at 2000 ¢/MTok = 1.4 ¢ a turn.
  const { fetchFn } = claude({ reply: { question: 'Hm?', grant: null }, out: 500 });
  const coach = makeCoach({
    apiKey: 'k',
    fetch: fetchFn,
    caps: { dayCents: 2.5, warnAt: 0.8 },
    educator,
  });
  await coach.ask(ASK); // 1.4 of 2.5 — quiet
  await coach.ask(ASK); // 2.8 — past the 2.0 warning band
  await coach.ask(ASK); // the wall: resting
  assert.deepEqual(notes, [
    ['Pia', false, false],
    ['Pia', true, false],
    ['Pia', true, true],
  ]);

  // A window that throws never costs the kid their question.
  const broken = {
    noteAsk: () => {
      throw new Error('boom');
    },
  };
  const ok = await makeCoach({
    apiKey: 'k',
    fetch: claude({ reply: { question: 'Hm?', grant: null } }).fetchFn,
    educator: broken,
  }).ask(ASK);
  assert.equal(ok.on, true);
});

test('spoken mode rides the state for the pre-reader', async () => {
  const { fetchFn, calls } = claude({ reply: { question: 'Up or down?', grant: null } });
  const coach = makeCoach({ apiKey: 'k', fetch: fetchFn });
  await coach.ask({ ...ASK, state: { spoken: true } });
  await coach.ask(ASK);
  assert.equal(JSON.parse(calls[0].body.messages.at(-1).content).state.spoken, true);
  assert.equal(JSON.parse(calls[1].body.messages.at(-1).content).state.spoken, false);
});

test('the question budget starts big and shrinks as the library grows', async () => {
  assert.equal(budgetFor(0), COACH_BUDGET.startCalls);
  assert.equal(budgetFor(4), COACH_BUDGET.startCalls - 2);
  assert.equal(budgetFor(10000), COACH_BUDGET.floorCalls, 'never below the floor');

  const shelf = (n) => ({ list: () => new Array(n).fill(0), search: () => [], place: () => null });
  const { fetchFn } = claude({ reply: { question: 'Hm?', grant: null } });
  const coach = makeCoach({ apiKey: 'k', fetch: fetchFn, library: shelf(10) });
  const r = await coach.ask(ASK);
  assert.equal(r.left.calls, budgetFor(10) - 1, 'a rich library means a tighter budget');
});

test('an API that errors or vanishes turns the coach off without spending', async () => {
  const err = makeCoach({ apiKey: 'k', fetch: claude({ status: 500 }).fetchFn });
  assert.deepEqual(await err.ask(ASK), { on: false, why: 'api-500' });
  const gone = makeCoach({
    apiKey: 'k',
    fetch: async () => {
      throw new Error('no net');
    },
  });
  assert.deepEqual(await gone.ask(ASK), { on: false, why: 'unreachable' });
  assert.deepEqual(gone.left('Pia'), { calls: budgetFor(0), cents: 100 }, 'nothing was spent');
});

test('the library rides the ask, a pick is resolved, a fresh build is saved', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'coach-lib-'));
  try {
    const library = makeFixtureLibrary({ dir });
    const piling = library.save({
      name: 'River piling',
      tags: ['post', 'pile', 'wood'],
      members: [
        { a: [0, 0], b: [0, 1], mat: 'wood' },
        { a: [0, 1], b: [0, 2], mat: 'wood' },
      ],
      roots: [[0, 0]],
    });

    // Grab before you build: the matches travel with the ask, and the
    // coach's pick comes back as a concrete, validated fixture.
    const pick = claude({
      reply: {
        question: 'A piling it is — what will lean on it first?',
        grant: { kind: 'library', id: piling.id, at: [5, -3] },
      },
    });
    const coach = makeCoach({ apiKey: 'k', fetch: pick.fetchFn, library });
    const r = await coach.ask({ kid: 'Pia', said: 'can I have a post in the river?', state: {} });
    const sent = JSON.parse(pick.calls[0].body.messages.at(-1).content);
    assert.deepEqual(sent.library, [{ id: piling.id, name: 'River piling', tags: ['post', 'pile', 'wood'] }]);
    assert.equal(r.grant.kind, 'fixture');
    assert.equal(r.grant.name, 'River piling');
    assert.deepEqual(r.grant.roots, [[5, -3]]);

    // A pick placed in the air is dropped by the same gate as anything.
    const badPick = claude({
      reply: { question: 'Here?', grant: { kind: 'library', id: piling.id, at: [5, 1] } },
    });
    const dropped = await makeCoach({ apiKey: 'k', fetch: badPick.fetchFn, library }).ask(ASK);
    assert.equal(dropped.grant, null);

    // A fresh build the coach shares joins the library for the next coach.
    const fresh = claude({
      reply: {
        question: 'One tree, growing — what does your bridge think of it?',
        grant: {
          kind: 'fixture',
          name: 'Bent tree',
          tags: ['tree', 'branch'],
          members: [
            { a: [3, -3], b: [3, -2], mat: 'wood' },
            { a: [3, -2], b: [4, -1], mat: 'wood' },
          ],
          roots: [[3, -3]],
          share: true,
        },
      },
    });
    const grew = await makeCoach({ apiKey: 'k', fetch: fresh.fetchFn, library }).ask({
      kid: 'Pia',
      said: 'is there a tree?',
      state: {},
    });
    assert.equal(grew.grant.kind, 'fixture');
    const names = library.list().map((e) => e.name);
    assert.deepEqual(names.sort(), ['Bent tree', 'River piling']);
    assert.equal(library.list().find((e) => e.name === 'Bent tree').author, 'Pia');

    // A grant of scattered pieces is dropped and never saved — one
    // object per ask. (A floating one-piece branch is fine now: the
    // solver, not the gate, decides whether it stays up.)
    const pieces = claude({
      reply: {
        question: 'Two bits?',
        grant: {
          kind: 'fixture',
          name: 'Bag of bits',
          tags: [],
          members: [
            { a: [5, 2], b: [6, 2], mat: 'wood' },
            { a: [8, 2], b: [9, 2], mat: 'wood' },
          ],
          roots: [],
        },
      },
    });
    const no = await makeCoach({ apiKey: 'k', fetch: pieces.fetchFn, library }).ask(ASK);
    assert.equal(no.grant, null);
    assert.equal(library.list().length, 2);

    // A build the coach doubts is granted all the same — the kid plays —
    // but it waits on the pending shelf for an adult, never the library
    // (grant freely §2).
    const doubted = claude({
      reply: {
        question: 'There it is — will the ants mind it?',
        grant: {
          kind: 'fixture',
          name: 'Odd totem',
          tags: ['totem'],
          members: [
            { a: [6, -3], b: [6, -2], mat: 'wood' },
            { a: [6, -2], b: [7, -2], mat: 'wood' },
          ],
          roots: [[6, -3]],
          share: false,
        },
      },
    });
    const held = await makeCoach({ apiKey: 'k', fetch: doubted.fetchFn, library }).ask({
      kid: 'Pia',
      said: 'build me a totem',
      state: {},
    });
    assert.equal(held.grant.kind, 'fixture', 'the kid still gets the thing');
    assert.equal(library.list().length, 2, 'the shelf is untouched');
    assert.deepEqual(
      library.pending().map((e) => [e.name, e.author]),
      [['Odd totem', 'Pia']],
      'the adult decides whether it publishes',
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a kid name is required and bounded', async () => {
  const { fetchFn } = claude({ reply: { question: 'Hm?', grant: null } });
  const coach = makeCoach({ apiKey: 'k', fetch: fetchFn });
  assert.equal((await coach.ask({ said: 'hi' })).why, 'bad-kid');
  assert.equal((await coach.ask({ kid: 'x'.repeat(41), said: 'hi' })).why, 'bad-kid');
});

// Stage 0 found this one: with no key nothing is granted, and a kid
// taps a picture into silence. Whether a coach exists at all is world
// knowledge, free and askable before the first tap (demo/coachbox.js
// asks once on load) — and it never says anything about the key.
test('the coach says whether it is there at all', () => {
  assert.equal(makeCoach({ apiKey: 'k', fetch: async () => ({}) }).here(), true);
  assert.equal(makeCoach({ apiKey: '', fetch: async () => ({}) }).here(), false);
  assert.equal(makeCoach({ apiKey: undefined, fetch: async () => ({}) }).here(), false);
});
