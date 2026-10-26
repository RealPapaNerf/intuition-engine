// The questions a kid can ask of a system, and the interventions that
// pose them (decisions 2026-10-26 §3–§4): two of a part, a part put in
// another's place, a flow blocked — each pinned to its hand calculation
// — then the questions made from a bench, answered by the run, and the
// Consultant and the hidden fault that ride on them.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LIBRARY,
  runSystem,
  normalsOf,
  pull,
  swapBad,
  putGood,
  addCopy,
  place,
  unplace,
  block,
  benchKey,
  changes,
  ask,
  kindsFor,
  commit,
  truthOf,
  score,
  jobOf,
  consult,
  mysteries,
  pickMystery,
  mysteryBench,
  probe,
} from '../systems/index.js';

const sys = (id) => LIBRARY.find((s) => s.id === id);
const near = (got, want, rel, what = '') => assert.ok(Math.abs(got - want) <= rel * Math.abs(want), `${what} ${got} vs ${want}`);
const F = sys('flashlight');
const K = sys('kidneys');
const V = sys('flu-cell');
const C = sys('car');
// The flashlight's loop in ohms: cells, switch, resistor, the LED once on, the wire back.
const R_RES = 1000 / 21.28;
const R_LOOP = 1000 / 3333 + 1000 / 20000 + R_RES + 10 + 1000 / 50000;
const glow = (bench) => runSystem(F, bench).stats.flow.glow.max;
// Runs measured against the system as shipped, so the cascade can say what stopped.
const healthyOf = new Map(LIBRARY.map((s) => [s.id, runSystem(s)]));
const runN = (s, bench) => runSystem(s, bench, { normal: normalsOf(healthyOf.get(s.id)) });

// --- Two of a part ---------------------------------------------------------------------

test('two resistors side by side: R/2, so I = 1.2 / (R_loop − R/2)', () => {
  near(glow(addCopy(F, {}, 'resistor')), (1000 * 1.2) / (R_LOOP - R_RES / 2), 1e-4);
});

test('two batteries side by side: half the inside resistance — and twice the charge, a store each', () => {
  const r = runSystem(F, addCopy(F, {}, 'batteries'));
  near(r.stats.flow.glow.max, (1000 * 1.2) / (R_LOOP - 0.3 / 2), 1e-4, 'current');
  assert.ok(Number.isFinite(r.stats.node['cells#2'].end), 'the copy brought its own charge');
});

test('a third kidney (a transplant) clears to G / (1.5 · K)', () => {
  const r = runSystem(K, addCopy(K, {}, 'left-kidney'));
  near(r.stats.node.blood.end, 16.67 / (3 * 2.083), 2e-3);
});

test('a spare water pump is a pump: pull the first and the coolant still goes round', () => {
  const b = pull(C, addCopy(C, {}, 'water-pump'), 'water-pump');
  const r = runSystem(C, b);
  assert.equal(r.verdict, 'works');
  assert.equal(r.broke.length, 0);
});

test('only as many as there is room for', () => {
  const b = addCopy(F, {}, 'switch');
  assert.throws(() => addCopy(F, b, 'switch'), /room for only 2/);
  assert.throws(() => addCopy(K, {}, 'body'), /no room for another/);
  assert.equal(benchKey(F, b), 'switch#2=ok');
  assert.deepEqual(pull(F, b, 'switch#2'), {}, 'taking a copy out leaves nothing behind');
});

// --- A part in another part's place ----------------------------------------------------------

test('two resistors in a line: 2R, so I = 1.2 / (R_loop + R)', () => {
  const b = place(F, addCopy(F, {}, 'resistor'), 'resistor#2', 'resistor', 'inline');
  near(glow(b), (1000 * 1.2) / (R_LOOP + R_RES), 1e-4);
});

test('two lights in a line need 3.6 V, and two batteries make 3.0: dark', () => {
  const b = place(F, addCopy(F, {}, 'led'), 'led#2', 'led', 'inline');
  assert.equal(glow(b), 0);
  assert.equal(runSystem(F, b).verdict, 'fails');
});

test('two switches side by side is OR; two in a line is AND', () => {
  const stuck = swapBad(F, {}, 'switch', 'stuck-off');
  const beside = addCopy(F, stuck, 'switch'); // copies go in beside the first
  assert.equal(runSystem(F, beside).verdict, 'works', 'either one will do');
  const inline = place(F, beside, 'switch#2', 'switch', 'inline');
  assert.equal(runSystem(F, inline).verdict, 'fails', 'both must be on');
  assert.equal(runSystem(F, putGood(F, inline, 'switch')).verdict, 'works');
});

test('a wire where the resistor was is a short: ~115 mA, and the light burns out', () => {
  const b = place(F, pull(F, addCopy(F, {}, 'wire'), 'resistor'), 'wire#2', 'resistor', 'beside');
  const r = runSystem(F, b);
  near(r.stats.flow.glow.max, (1000 * 1.2) / (R_LOOP - R_RES + 1000 / 50000), 1e-4, 'short');
  assert.equal(r.broke[0]?.part, 'led');
  assert.deepEqual(unplace(F, b, 'wire#2').parts['wire#2'], { as: 'ok' }, 'put back where copies go: beside its own');
});

test('a part a run burns stays burnt wherever it was put', () => {
  const b = place(F, addCopy(F, {}, 'led'), 'led#2', 'resistor', 'beside');
  const r = runSystem(F, pull(F, b, 'resistor'));
  // the second light where the resistor was, in a line with the first: 3.6 V needed, dark
  assert.equal(r.stats.flow['glow#2'].max, 0);
});

test('only two-ended parts move, and only to a spot that carries the same thing', () => {
  assert.throws(() => place(F, {}, 'batteries', 'resistor', 'beside'), /two ends/);
  assert.throws(() => place(C, {}, 'hoses', 'engine', 'beside'), /not a spot/);
  assert.throws(() => place(F, {}, 'resistor', 'resistor', 'beside'), /itself/);
  const b = place(F, addCopy(F, {}, 'resistor'), 'resistor#2', 'resistor', 'inline');
  assert.throws(() => place(F, b, 'resistor', 'led', 'beside'), /connected to/);
});

test('a bypass hose beside the first one, past the thermostat: the engine runs cool', () => {
  const r = runSystem(C, addCopy(C, {}, 'hoses'));
  const g = (40 * 75) / (40 + 75) + 2; // one open hose in series with radiator and fan, plus the block's own
  near(r.stats.node.block.end, 25 + (1000 * r.stats.flow.burn.end) / g, 1e-3, 'like no thermostat at all');
});

test('two fuel pumps make up for a weak one', () => {
  const weak = swapBad(C, {}, 'fuel-pump', 'weak');
  assert.equal(runSystem(C, weak).verdict, 'fails');
  assert.equal(runSystem(C, addCopy(C, weak, 'fuel-pump')).verdict, 'works');
});

// --- Blocking a flow -------------------------------------------------------------------------

test('block one kidney’s water and only the water changes: waste G/K = 4, water above normal doubles', () => {
  const r = runSystem(K, block(K, {}, 'left-water'));
  near(r.stats.node.blood.end, 16.67 / (2 * 2.083), 2e-3, 'waste');
  near(r.stats.node['body-water'].end - 42, (0.1042 - 0.0333) / 0.1417, 2e-3, 'water');
  assert.deepEqual(changes(K, block(K, {}, 'left-water')), [{ flow: 'left-water', blocked: true, part: 'left-kidney' }]);
});

test('block the drinking and the body dries out in about four days', () => {
  // The kidneys let the 0.25 L above normal go in the first hours; after
  // that only skin and breath take water: (42 − 39) / 0.0333 = 90 h more.
  const r = runSystem(K, block(K, {}, 'drink'));
  assert.equal(r.verdict, 'fails');
  assert.equal(r.failure.check, 2, 'the dried-out check');
  assert.ok(r.failedAt > (42 - 39) / 0.0333 && r.failedAt < (42.25 - 39) / 0.0333, `${r.failedAt} h`);
});

test('block the door and no virus gets in; block the scissors and none get out', () => {
  assert.equal(runSystem(V, block(V, {}, 'enter')).stats.node.freed.end, 0);
  const stuck = runSystem(V, block(V, {}, 'release'));
  assert.equal(stuck.stats.node.freed.end, 0);
  assert.ok(stuck.stats.node.ready.end > 100);
});

// --- The questions ------------------------------------------------------------------------------

test('the kinds rotate round by round, feel and measure apart', () => {
  const b = pull(C, {}, 'alternator');
  const feel = [0, 1, 2, 3, 4].map((round) => ask(C, b, { mode: 'feel', round, seed: 's' }).type);
  assert.deepEqual(feel, ['works', 'direction', 'first', 'keeps', 'job']);
  const measure = [0, 1].map((round) => ask(C, b, { mode: 'measure', round, seed: 's' }).type);
  assert.deepEqual(measure, ['reading', 'when']);
  assert.equal(ask(C, b, { mode: 'feel', kind: 'keeps', seed: 's' }).type, 'keeps', 'a kind can be asked for');
});

test('a question is made from the bench alone: the same bench, the same question, whatever the run', () => {
  const b = pull(K, {}, 'left-kidney');
  for (let round = 0; round < 5; round++) assert.deepEqual(ask(K, b, { round, seed: 'x' }), ask(K, b, { round, seed: 'x' }));
  // "which stops first" offers every part that could, so the menu gives nothing away
  const q = ask(C, pull(C, {}, 'battery'), { kind: 'first', seed: 'x' });
  assert.deepEqual(q.options.map((o) => o.id).sort(), [...C.parts.filter((p) => p.id !== 'battery' && p.flows.length).map((p) => p.id), 'nothing'].sort());
});

test('direction: one kidney → more waste; no alternator → less charge; no fan → engine heat the same', () => {
  const dir = (s, bench, node) => {
    const q = { type: 'direction', kind: 'binary', about: { node, stat: node === 'blood' ? 'max' : 'mean' } };
    return truthOf(s, q, runSystem(s, bench), healthyOf.get(s.id), bench).value;
  };
  assert.equal(dir(K, pull(K, {}, 'left-kidney'), 'blood'), 'up');
  assert.equal(dir(C, pull(C, {}, 'alternator'), 'battery'), 'down');
  assert.equal(dir(C, pull(C, {}, 'fan'), 'block'), 'same', 'the thermostat holds it at ~90 °C either way');
});

test('which stops first: the hoses, at once, when the water pump goes; the loop, when the wire goes', () => {
  const pump = pull(C, {}, 'water-pump');
  const q = ask(C, pump, { kind: 'first', seed: 's' });
  const t = truthOf(C, q, runN(C, pump), healthyOf.get('car'), pump);
  assert.deepEqual(t.set, ['hoses']);
  const wire = pull(F, {}, 'wire');
  const tw = truthOf(F, ask(F, wire, { kind: 'first', seed: 's' }), runN(F, wire), healthyOf.get('flashlight'), wire);
  assert.ok(tw.set.includes('led') && tw.set.includes('resistor'), `${tw.set}`);
  // one kidney out: nothing else stops — the other just carries more
  const kid = pull(K, {}, 'left-kidney');
  assert.deepEqual(truthOf(K, ask(K, kid, { kind: 'first', seed: 's' }), runN(K, kid), healthyOf.get('kidneys'), kid).set, ['nothing']);
});

test('keeps working: the other kidney does; the spark plugs do not, without a battery', () => {
  const kid = pull(K, {}, 'left-kidney');
  const qk = ask(K, kid, { kind: 'keeps', seed: 's' });
  assert.ok(['right-kidney', 'body'].includes(qk.about.part), 'a neighbour: it shares the blood');
  const right = { type: 'keeps', kind: 'binary', about: { part: 'right-kidney' } };
  assert.equal(truthOf(K, right, runN(K, kid), healthyOf.get('kidneys'), kid).value, 'yes');
  const bat = pull(C, {}, 'battery');
  const q = { type: 'keeps', kind: 'binary', about: { part: 'ignition' } };
  assert.equal(truthOf(C, q, runN(C, bat), healthyOf.get('car'), bat).value, 'no');
});

test('the job question offers the part’s own job once, among others’, and model-made jobs read the wiring', () => {
  const b = pull(C, {}, 'alternator');
  const q = ask(C, b, { kind: 'job', focus: 'alternator', seed: 's' });
  assert.equal(q.options.filter((o) => o.id === 'right').length, 1);
  assert.equal(q.options.find((o) => o.id === 'right').label, jobOf(C, C.parts.find((p) => p.id === 'alternator')));
  assert.equal(new Set(q.options.map((o) => o.label)).size, q.options.length, 'no two options alike');
  // without an author's words, the job is the model's own wiring
  const bare = { ...C.parts.find((p) => p.id === 'alternator'), job: null };
  assert.equal(jobOf(C, bare), 'turns engine turning into battery charge');
  const pump = { ...C.parts.find((p) => p.id === 'water-pump'), job: null };
  assert.equal(jobOf(C, pump), 'is needed by Coolant hoses', 'a cost is not a job: what needs it is');
});

test('when: the engine seizes at ~8 min without a radiator; "never" sits at the top of the scale', () => {
  const b = pull(C, {}, 'radiator');
  const q = ask(C, b, { mode: 'measure', kind: 'when', seed: 's' });
  assert.deepEqual([q.max, q.resolution], [90, 5]);
  assert.equal(truthOf(C, q, runSystem(C, b), healthyOf.get('car'), b).value, 10, 'seized at 7.9, on a 5-minute grid');
  const fan = pull(C, {}, 'fan');
  assert.deepEqual(truthOf(C, q, runSystem(C, fan), healthyOf.get('car'), fan), { value: 90, maxed: true });
});

test('answers are checked before the run, and scored into journal entries', () => {
  const q = ask(K, pull(K, {}, 'left-kidney'), { mode: 'measure', kind: 'reading', seed: 's' });
  assert.throws(() => commit(q, { lo: 5, hi: 3 }), /low number goes first/);
  assert.throws(() => commit(q, { lo: 0.5, hi: 3 }), /steps of 1/);
  assert.throws(() => commit(ask(K, {}, { seed: 's' }), 'maybe'), /pick one/);
  const b = pull(K, {}, 'left-kidney');
  const r = runSystem(K, b);
  const { entry, hit } = score(K, q, commit(q, { lo: 6, hi: 9 }), r, healthyOf.get('kidneys'), { bench: b, setup: benchKey(K, b) });
  assert.equal(hit, true);
  assert.deepEqual(
    { kind: entry.kind, about: entry.about, prediction: entry.prediction, range: entry.range, outcome: entry.outcome, buildFailed: entry.buildFailed, level: entry.level },
    { kind: 'band', about: 'reading', prediction: { lo: 6, hi: 9 }, range: 80, outcome: 8, buildFailed: false, level: 'sys:kidneys' },
  );
  // a repair that does not hold is a failed build; an experiment never is
  const qw = ask(F, {}, { seed: 's' });
  const burnt = runSystem(F, swapBad(F, {}, 'resistor', 'jumper')).after;
  const half = putGood(F, burnt, 'resistor');
  const res = runSystem(F, half);
  assert.equal(score(F, qw, commit(qw, 'works'), res, healthyOf.get('flashlight'), { bench: half, repair: true }).entry.buildFailed, true);
  assert.equal(score(F, qw, commit(qw, 'fails'), res, healthyOf.get('flashlight'), { bench: half }).entry.buildFailed, false);
});

test('when several parts stop together, naming any of them is right', () => {
  const b = pull(C, {}, 'battery');
  const q = ask(C, b, { kind: 'first', seed: 's' });
  const r = runN(C, b);
  const t = truthOf(C, q, r, healthyOf.get('car'), b);
  assert.ok(t.set.length > 1, `${t.set}`);
  for (const id of t.set) assert.equal(score(C, q, commit(q, id), r, healthyOf.get('car'), { bench: b }).hit, true);
});

// --- The Consultant ----------------------------------------------------------------------------

test('the Consultant: deterministic, wrong about one time in five, and never wrong by telling the truth', () => {
  let wrong = 0;
  let n = 0;
  const benches = [pull(K, {}, 'left-kidney'), pull(K, pull(K, {}, 'left-kidney'), 'right-kidney'), swapBad(K, {}, 'right-kidney', 'sick')];
  const runs = benches.map((b) => runSystem(K, b));
  for (let i = 0; i < 300; i++) {
    benches.forEach((b, j) => {
      for (const kind of ['works', 'direction', 'reading']) {
        const mode = kind === 'reading' ? 'measure' : 'feel';
        const q = ask(K, b, { mode, kind, seed: `q${i}` });
        const a = consult({ system: K, bench: b, question: q, seed: `k${i}:${j}:${kind}`, result: runs[j], healthy: healthyOf.get('kidneys') });
        assert.deepEqual(a, consult({ system: K, bench: b, question: q, seed: `k${i}:${j}:${kind}`, result: runs[j], healthy: healthyOf.get('kidneys') }));
        n++;
        if (a.wrong) {
          wrong++;
          assert.notEqual(a.claim, a.truth, `${kind}: a wrong claim that is true`);
        } else assert.equal(a.claim, a.truth);
      }
    });
  }
  assert.ok(wrong / n > 0.16 && wrong / n < 0.24, `wrong ${wrong}/${n}`);
});

test('the Consultant’s errors are the catchable kinds, and it keeps quiet on questions it does not answer', () => {
  const kinds = (bench, kind, mode = 'feel') => {
    const seen = new Set();
    const r = runSystem(K, bench);
    for (let i = 0; i < 400; i++) {
      const q = ask(K, bench, { mode, kind, seed: 'q' });
      const a = consult({ system: K, bench, question: q, seed: `s${i}`, result: r, healthy: healthyOf.get('kidneys') });
      if (a.wrong) seen.add(a.errorType);
    }
    return seen;
  };
  assert.deepEqual([...kinds(pull(K, {}, 'left-kidney'), 'works')], ['ignored-spare'], 'one kidney is fine: forgetting the other is the error');
  const none = pull(K, pull(K, {}, 'left-kidney'), 'right-kidney');
  assert.ok(kinds(none, 'reading', 'measure').has('no-way-out'), 'no kidneys: "it settles" is the bathtub mistake');
  assert.ok(kinds(none, 'works').has('buffer-forever'), 'it fails a day and a half in: "it keeps going" forgets that');
  const noDoor = pull(V, {}, 'receptor');
  const q = ask(V, noDoor, { mode: 'measure', kind: 'reading', seed: 'q' });
  const errs = new Set();
  for (let i = 0; i < 200; i++) {
    const a = consult({ system: V, bench: noDoor, question: q, seed: `v${i}` });
    if (a.wrong) errs.add(a.errorType);
  }
  assert.deepEqual([...errs], ['limiting-case']);
  assert.equal(consult({ system: K, bench: none, question: ask(K, none, { kind: 'job', seed: 'q' }), seed: 's' }), null);
});

// --- Something's wrong --------------------------------------------------------------------------

test('every mystery shows a symptom; a system with a spare for everything hides two faults', () => {
  const flash = mysteries(F);
  assert.ok(flash.length >= 6);
  for (const m of flash) assert.equal(runSystem(F, mysteryBench(F, m)).verdict, 'fails', JSON.stringify(m));
  assert.ok(!flash.some((m) => m[0].fault === 'tired'), 'tired batteries still light it: no symptom, no mystery');
  const kid = mysteries(K);
  assert.ok(kid.every((m) => m.length === 2), 'one bad kidney shows nothing');
  assert.deepEqual(pickMystery(F, 'kid-1'), pickMystery(F, 'kid-1'));
});

test('a probe reads the part at the symptom, beside what a healthy one reads', () => {
  const b = mysteryBench(F, [{ part: 'batteries', fault: 'flat' }]);
  const p = probe(F, runSystem(F, b), healthyOf.get('flashlight'), 'batteries');
  const cells = p.readings.find((r) => r.id === 'cells');
  near(cells.value, 3.0 * 0.55, 1e-3, 'flat');
  near(cells.normal, 3.0, 1e-3, 'healthy');
  const glowing = probe(F, runSystem(F, b), healthyOf.get('flashlight'), 'led').readings.find((r) => r.id === 'glow');
  assert.equal(glowing.value, 0);
  near(glowing.normal, (1000 * 1.2) / R_LOOP, 1e-3);
});
