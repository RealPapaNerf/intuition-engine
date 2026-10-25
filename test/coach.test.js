// The coach's door (decisions 2026-10-25 §3), against a stand-in Claude:
// the caps guard the credits, the leash is checked rather than trusted,
// grants are earned against a replayed level, and the coach is told only
// what the kid can see.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { makeCoach, COACH_CAPS, COACH_MODEL, FALLBACK_QUESTION } from '../coach/service.js';
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
        usage: { output_tokens: r.out ?? 50 },
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

test('a question comes back as asked, with the day’s remaining jar', async () => {
  const { fetchFn, calls } = claude({
    reply: { question: 'Where did it snap first?', grant: null },
  });
  const coach = makeCoach({ apiKey: 'k', fetch: fetchFn });
  const r = await coach.ask(ASK);
  assert.deepEqual(r, {
    on: true,
    question: 'Where did it snap first?',
    grant: null,
    left: { calls: COACH_CAPS.calls - 1, outputTokens: COACH_CAPS.outputTokens - 50 },
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

test('the day’s jar empties: calls capped, tokens capped, morning refills', async () => {
  let day = Date.parse('2026-10-25T10:00:00Z');
  const { fetchFn, calls } = claude({ reply: { question: 'Hm?', grant: null }, out: 40 });
  const coach = makeCoach({
    apiKey: 'k',
    fetch: fetchFn,
    caps: { calls: 2, outputTokens: 1000 },
    now: () => day,
  });
  assert.equal((await coach.ask(ASK)).on, true);
  assert.equal((await coach.ask(ASK)).on, true);
  const spent = await coach.ask(ASK);
  assert.deepEqual([spent.on, spent.why], [false, 'jar-empty']);
  assert.equal(calls.length, 2, 'a spent jar never calls out');

  day += 24 * 60 * 60 * 1000; // the next morning
  assert.equal((await coach.ask(ASK)).on, true);

  // A reply may finish past the token cap; the next call never starts.
  const tokens = makeCoach({
    apiKey: 'k',
    fetch: claude({ reply: { question: 'Hm?', grant: null }, out: 1100 }).fetchFn,
    caps: { calls: 10, outputTokens: 1000 },
  });
  assert.equal((await tokens.ask(ASK)).on, true);
  assert.equal((await tokens.ask(ASK)).why, 'jar-empty', 'tokens cap on their own');
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
  assert.deepEqual(await gone.left('Pia'), COACH_CAPS, 'nothing was spent');
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

    // A fresh build that passes the gate joins the library for the next coach.
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

    // A floating build is dropped and never saved.
    const floating = claude({
      reply: {
        question: 'A cloud?',
        grant: {
          kind: 'fixture',
          name: 'Sky plank',
          tags: [],
          members: [{ a: [5, 2], b: [6, 2], mat: 'wood' }],
          roots: [],
        },
      },
    });
    const no = await makeCoach({ apiKey: 'k', fetch: floating.fetchFn, library }).ask(ASK);
    assert.equal(no.grant, null);
    assert.equal(library.list().length, 2);
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
