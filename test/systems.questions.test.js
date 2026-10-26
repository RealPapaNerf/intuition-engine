// The questions a kid can ask of a system, and the interventions that
// pose them (decisions 2026-10-26 §3–§4): two of a part, a part put in
// another's place, a flow blocked — each pinned to its hand calculation
// — then the questions made from a bench, answered by the run, and the
// Consultant and the hidden fault that ride on them.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LIBRARY,
  validateSystem,
  wiring,
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

test('a spare battery pack takes over when the first comes out: the minus spring stays', () => {
  const spare = pull(F, addCopy(F, {}, 'batteries'), 'batteries');
  near(glow(spare), (1000 * 1.2) / R_LOOP, 1e-4, 'one pack again');
  // and with none at all the loop is dead: its wires float, the light carries nothing
  const none = runSystem(F, pull(F, {}, 'batteries'));
  assert.equal(none.stats.flow.glow.max, 0);
  assert.ok(Number.isNaN(none.trace.nodes.plus[1]), 'no level from nowhere');
});

test('a spare light is a light: pull the first and the flashlight still shines', () => {
  // The goal and the instrument read every copy of the part, the way a
  // need is met by any of it: "it glows" if any light does.
  for (const b of [pull(F, addCopy(F, {}, 'led'), 'led'), swapBad(F, addCopy(F, {}, 'led'), 'led', 'burnt')]) {
    const r = runSystem(F, b);
    assert.equal(r.verdict, 'works', benchKey(F, b));
    near(r.stats.all.flow.glow.max, (1000 * 1.2) / R_LOOP, 1e-4, 'the spare carries what one light does');
    assert.equal(r.reading.value, Math.round((1000 * 1.2) / R_LOOP));
  }
  // side by side, each light gets a share: two LEDs in parallel are 5 Ω,
  // so each carries half of 1.2 / (R_loop − 5)
  const both = runSystem(F, addCopy(F, {}, 'led'));
  near(both.stats.all.flow.glow.max, (1000 * 1.2) / (R_LOOP - 5) / 2, 1e-4, 'the brightest of two');
});

test('a copy of a part that gates its own flow gates its copy of it', () => {
  // A float valve: it lets water in while the tank is under 4. One step
  // of backward Euler from empty: L = 10·g/(1 + g) — 5 through one valve
  // (g = 1), 20/3 through two (g = 2) — and then each shuts its own flow.
  const s = validateSystem({
    id: 'float',
    title: 'Float valves',
    model: 'A test.',
    intro: 'For the tests.',
    time: { unit: 's', step: 1, run: 10 },
    substances: [{ id: 'q', name: 'water', amount: 'L', level: 'L' }],
    nodes: [
      { id: 'main', substance: 'q', kind: 'fixed', level: 10 },
      { id: 'tank', substance: 'q', kind: 'store', capacity: 1, start: 0 },
    ],
    parts: [{ id: 'valve', name: 'Float valve', at: [0, 0], copies: 1, flows: [{ id: 'fill', law: 'conduct', from: 'main', to: 'tank', g: 1 }], gates: [{ flow: 'fill', by: 'tank', open: 'below', at: 4 }] }],
    goal: { says: 'It fills.', asks: 'Will it fill?', checks: [{ read: { node: 'tank' }, above: 1, when: 'end', fails: 'Empty.' }] },
  });
  const two = addCopy(s, {}, 'valve');
  near(runSystem(s).stats.node.tank.end, 5, 1e-12, 'one valve');
  near(runSystem(s, two).stats.node.tank.end, 20 / 3, 1e-12, 'two valves, each shut by its own float');
  assert.deepEqual(wiring(s, two).flows.map((f) => [f.id, f.gates]), [['fill', ['valve']], ['fill#2', ['valve#2']]]);
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

test('a wire beside a resistor that has another in line with it bridges that one only', () => {
  // resistor, then resistor#2 in line; the wire across the first:
  // R = (R_res ∥ R_wire) + R_res, so the loop is R_loop + (R_res ∥ R_wire)
  let b = place(F, addCopy(F, {}, 'resistor'), 'resistor#2', 'resistor', 'inline');
  b = place(F, addCopy(F, b, 'wire'), 'wire#2', 'resistor', 'beside');
  const par = 1 / (1 / R_RES + 50000 / 1000);
  near(glow(b), (1000 * 1.2) / (R_LOOP + par), 1e-4, 'not a short past both');
  assert.equal(runSystem(F, b).verdict, 'works');
});

test('a copy taken out takes its clamp with it, and what sat in its place goes home', () => {
  const clamped = pull(F, block(F, addCopy(F, {}, 'resistor'), 'squeeze#2'), 'resistor#2');
  assert.deepEqual(clamped, {});
  near(glow(addCopy(F, clamped, 'resistor')), (1000 * 1.2) / (R_LOOP - R_RES / 2), 1e-4, 'a fresh copy starts fresh');
  const sat = pull(F, place(F, addCopy(F, addCopy(F, {}, 'resistor'), 'wire'), 'wire#2', 'resistor#2', 'inline'), 'resistor#2');
  assert.deepEqual(sat, { parts: { 'wire#2': { as: 'ok' } } });
  assert.throws(() => place(F, {}, 'wire', 'resistor#2', 'beside'), /no resistor#2 on the bench/);
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
  // Without the water pump the hoses never carry a drop: quiet from the
  // start, far longer than the warm-up they rest through as shipped. The
  // radiator goes quiet a moment later, once its coolant has cooled to the air.
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

test('keeps working: pull the fan and the radiator still lets heat out through its fins', () => {
  const fan = pull(C, {}, 'fan');
  const q = { type: 'keeps', kind: 'binary', about: { part: 'radiator' } };
  assert.equal(truthOf(C, q, runN(C, fan), healthyOf.get('car'), fan).value, 'yes');
});

test('a part counts as stopped only when it rests longer than it ever does as shipped', () => {
  // As shipped, the radiator idles while the engine warms and the hoses
  // rest whenever the thermostat shuts. Changes that leave the cooling
  // alone shift when the thermostat opens and shuts, and stop nothing.
  const H = healthyOf.get('car');
  for (const b of [swapBad(C, {}, 'fuel-pump', 'weak'), swapBad(C, {}, 'battery', 'old'), swapBad(C, {}, 'alternator', 'worn'), addCopy(C, {}, 'water-pump'), pull(C, {}, 'fan')]) {
    const r = runN(C, b);
    for (const id of ['hoses', 'radiator']) {
      assert.equal(truthOf(C, { type: 'keeps', kind: 'binary', about: { part: id } }, r, H, b).value, 'yes', `${benchKey(C, b)}: ${id}`);
    }
  }
  // Two doors let the virus in faster, so the outside runs out sooner:
  // the door goes quiet for good earlier than it does as shipped.
  const doors = addCopy(V, {}, 'receptor');
  const qv = { type: 'keeps', kind: 'binary', about: { part: 'receptor' } };
  assert.equal(truthOf(V, qv, runN(V, doors), healthyOf.get('flu-cell'), doors).value, 'no');
});

test('many stops at once: every one is counted, however long the run’s event list grows', () => {
  // Sixteen lamps of four filaments each on one switch: pull it, and
  // sixty-four flows stop at the same moment — more than the page's
  // list of events keeps.
  const lamps = Array.from({ length: 16 }, (_, i) => ({
    id: `lamp-${i}`,
    name: `Lamp ${i}`,
    at: [i % 8, 1 + Math.floor(i / 8)],
    flows: [0, 1, 2, 3].map((k) => ({ id: `l${i}-${k}`, law: 'conduct', from: 'bus', to: 'gnd', g: 1 })),
  }));
  const s = validateSystem({
    id: 'lamps',
    title: 'Lamps',
    model: 'A test.',
    intro: 'For the tests.',
    time: { unit: 's', step: 1, run: 5 },
    substances: [{ id: 'q', name: 'electricity', amount: 'C', level: 'V' }],
    nodes: [
      { id: 'mains', substance: 'q', kind: 'fixed', level: 10 },
      { id: 'bus', substance: 'q', kind: 'junction' },
      { id: 'gnd', substance: 'q', kind: 'fixed', level: 0 },
    ],
    parts: [{ id: 'switch', name: 'Switch', at: [0, 0], flows: [{ id: 'feed', law: 'conduct', from: 'mains', to: 'bus', g: 100 }] }, ...lamps],
    goal: { says: 'The lamps glow.', asks: 'Will the lamps glow?', checks: [{ read: { flow: 'l15-3' }, above: 0.01, fails: 'Dark.' }] },
  });
  const H = runSystem(s);
  const b = pull(s, {}, 'switch');
  const r = runSystem(s, b, { normal: normalsOf(H) });
  assert.equal(r.events.length, 60, 'the page’s list is cut short');
  assert.ok(!r.events.some((e) => e.part === 'lamp-15' && e.kind === 'stopped'), 'and lamp 15 fell off it');
  assert.equal(truthOf(s, { type: 'keeps', kind: 'binary', about: { part: 'lamp-15' } }, r, H, b).value, 'no');
  assert.deepEqual(truthOf(s, ask(s, b, { kind: 'first', seed: 's' }), r, H, b).set, lamps.map((l) => l.id));
});

test('which stops first offers a part that can only break, and is right about it', () => {
  // A fuse holds no flow of its own; it breaks when the current through
  // the heater it guards is too much. Doubled heater: it blows at once.
  const s = validateSystem({
    id: 'fuse',
    title: 'Fuse',
    model: 'A test.',
    intro: 'For the tests.',
    time: { unit: 's', step: 1, run: 5 },
    substances: [{ id: 'q', name: 'electricity', amount: 'C', level: 'V' }],
    nodes: [
      { id: 'mains', substance: 'q', kind: 'fixed', level: 10 },
      { id: 'bus', substance: 'q', kind: 'junction' },
      { id: 'gnd', substance: 'q', kind: 'fixed', level: 0 },
    ],
    parts: [
      { id: 'heater', name: 'Heater', at: [1, 0], copies: 1, flows: [{ id: 'heat', law: 'conduct', from: 'bus', to: 'gnd', g: 1 }] },
      { id: 'feed', name: 'Wire', at: [0, 0], flows: [{ id: 'in', law: 'conduct', from: 'mains', to: 'bus', g: 100 }] },
      { id: 'fuse', name: 'Fuse', at: [0, 1], ratings: [{ node: 'bus', below: 9.85 }] },
      { id: 'lamp', name: 'Lamp', at: [2, 0], flows: [{ id: 'glow', law: 'conduct', from: 'bus', to: 'gnd', g: 0.1 }] },
    ],
    goal: { says: 'It stays on.', asks: 'Will it stay on?', checks: [{ part: 'fuse', intact: true, fails: 'The fuse blew.' }] },
  });
  const H = runSystem(s);
  assert.deepEqual(H.broke, [], 'one heater: the bus sits at 10·100/101.1 = 9.89 V, inside the fuse’s limit');
  const b = addCopy(s, {}, 'heater');
  const r = runSystem(s, b, { normal: normalsOf(H) });
  const q = ask(s, b, { kind: 'first', seed: 's' });
  assert.ok(q.options.some((o) => o.id === 'fuse'), 'on the menu');
  assert.deepEqual(truthOf(s, q, r, H, b).set, ['fuse']);
});

test('more or less "than it ships" is never asked of a store only an added part brings', () => {
  const s = validateSystem({
    id: 'jar',
    title: 'Jar',
    model: 'A test.',
    intro: 'For the tests.',
    time: { unit: 's', step: 1, run: 5 },
    substances: [{ id: 'q', name: 'water', amount: 'L', level: 'L' }],
    nodes: [
      { id: 'tank', substance: 'q', kind: 'store', capacity: 1, start: 10 },
      { id: 'kept', substance: 'q', kind: 'store', capacity: 1, start: 0 },
    ],
    parts: [
      { id: 'tank', name: 'Tank', at: [0, 0], holds: ['tank'] },
      { id: 'jar', name: 'Spare jar', at: [1, 0], installed: false, holds: ['kept'], flows: [{ id: 'catch', law: 'conduct', from: 'tank', to: 'kept', g: 1 }] },
    ],
    goal: { says: 'There is water.', asks: 'Will there be water?', checks: [{ read: { node: 'tank' }, above: 1, fails: 'Dry.' }] },
  });
  const b = putGood(s, {}, 'jar');
  for (let round = 0; round < 12; round++) {
    const q = ask(s, b, { kind: 'direction', round, seed: `r${round}` });
    if (q.type === 'direction') assert.notEqual(q.about.node, 'kept');
  }
});

test('"how long until" names the checks it times, when the goal also has one judged at the end', () => {
  const q = ask(C, pull(C, {}, 'radiator'), { mode: 'measure', kind: 'when', seed: 's' });
  assert.match(q.asks, /“The engine overheated and seized\.”/);
  assert.ok(!kindsFor(V, {}, 'measure').includes('when'), 'a goal judged only at the end has no moment to predict');
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
