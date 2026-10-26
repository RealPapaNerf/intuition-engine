// Hand-calculation validation for the systems pack: the honest-physics
// contract, again. Each test states the textbook formula — Ohm's law,
// a voltage divider, an RC charge, a clearance's steady state, a
// doubling time — and checks the solver lands on it. Plus the rules
// that make a run a run: what a pulled part takes with it, what a bad
// part is, ratings, gates, rationing, conservation, and that nothing in
// the pack can read a clock.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { validateSystem, runSystem, pull, swapBad, putGood, benchKey, changes, partState, isPresent } from '../systems/index.js';

const close = (got, want, rel = 1e-9, what = '') =>
  assert.ok(Math.abs(got - want) <= rel * Math.max(1, Math.abs(want)), `${what} ${got} vs ${want}`);

// A system with only what a test needs: one substance by default, the
// goal a formality unless the test is about the goal.
function sys({ time = { unit: 's', step: 1, run: 10 }, substances, nodes, parts, checks, measure }) {
  return validateSystem({
    id: 'bench-test',
    title: 'Bench test',
    model: 'A test system.',
    intro: 'For the tests.',
    time,
    substances: substances ?? [{ id: 'q', name: 'stuff', amount: 'u', level: 'u' }],
    nodes,
    parts,
    goal: { says: 'It works.', asks: 'Will it work?', checks: checks ?? [{ part: parts[0].id, intact: true, fails: 'It broke.' }] },
    measure,
  });
}

const store = (id, capacity, start = 0, extra = {}) => ({ id, substance: 'q', kind: 'store', capacity, start, ...extra });
const fixed = (id, level) => ({ id, substance: 'q', kind: 'fixed', level });
const junction = (id) => ({ id, substance: 'q', kind: 'junction' });
const part = (id, flows = [], extra = {}) => ({ id, name: id, at: [0, 0], flows, ...extra });

// --- The level laws -----------------------------------------------------------

test("Ohm's law in series: I = (V − Vf) / (R_cell + R + R_led)", () => {
  // Two cells at 3.0 V (0.3 Ω inside), a 47 Ω resistor, a red LED that
  // needs 1.8 V and then behaves like 10 Ω. In mA, V, mS.
  const s = sys({
    substances: [{ id: 'q', name: 'charge', amount: 'mC', level: 'V' }],
    nodes: [store('cell', 3e6, 9e6), junction('plus'), junction('mid'), fixed('gnd', 0)],
    parts: [
      part('cells', [{ id: 'inside', law: 'conduct', from: 'cell', to: 'plus', g: 1000 / 0.3 }], { holds: ['cell'] }),
      part('resistor', [{ id: 'r', law: 'conduct', from: 'plus', to: 'mid', g: 1000 / 47 }]),
      part('led', [{ id: 'light', law: 'oneway', from: 'mid', to: 'gnd', g: 100, drop: 1.8 }]),
    ],
  });
  const r = runSystem(s);
  // At the cells' level after the first second (they drain a hair while
  // it passes): exact. At their nominal 3.0 V: to a few parts per million.
  const cell = r.trace.nodes.cell[1];
  close(r.trace.flows.light[1], (1000 * (cell - 1.8)) / (0.3 + 47 + 10), 1e-9, 'LED current');
  close(r.trace.flows.light[1], (1000 * (3.0 - 1.8)) / (0.3 + 47 + 10), 1e-5, 'LED current at 3.0 V');
  // and the resistor carries exactly what the LED does: a junction stores nothing
  close(r.trace.flows.r[1], r.trace.flows.light[1], 1e-9, 'KCL');
});

test('a voltage divider: V_mid = V · R2 / (R1 + R2)', () => {
  const s = sys({
    nodes: [fixed('top', 10), junction('mid'), fixed('gnd', 0)],
    parts: [part('r1', [{ id: 'a', law: 'conduct', from: 'top', to: 'mid', g: 1 / 1000 }]), part('r2', [{ id: 'b', law: 'conduct', from: 'mid', to: 'gnd', g: 1 / 3000 }])],
  });
  const r = runSystem(s);
  close(r.trace.nodes.mid[1], (10 * 3000) / 4000, 1e-12, 'divider');
  close(r.trace.flows.a[1], 10 / 4000, 1e-12, 'divider current');
});

test('parallel paths add: flow = (g1 + g2) · ΔV', () => {
  // Two fixed ends can't be joined directly (nothing could feel it), so
  // the pair hangs off a junction fed through a near-perfect wire.
  const t = sys({
    nodes: [fixed('hi', 5), junction('x'), fixed('lo', 1)],
    parts: [
      part('feed', [{ id: 'f', law: 'conduct', from: 'hi', to: 'x', g: 1e6 }]),
      part('p1', [{ id: 'a', law: 'conduct', from: 'x', to: 'lo', g: 2 }]),
      part('p2', [{ id: 'b', law: 'conduct', from: 'x', to: 'lo', g: 3 }]),
    ],
  });
  const r = runSystem(t);
  close(r.trace.flows.a[1] + r.trace.flows.b[1], (2 + 3) * (5 - 1), 1e-5, 'parallel');
  close(r.trace.flows.b[1] / r.trace.flows.a[1], 3 / 2, 1e-9, 'split by conductance');
});

test('RC charge: backward Euler gives V_n = V0·(1 − (1 + dt/τ)^−n), and → V0·(1 − e^(−t/τ))', () => {
  // A 2 F capacitor charging from 5 V through 0.5 Ω: τ = R·C = 1 s.
  const make = (step) =>
    sys({
      time: { unit: 's', step, run: 3 },
      nodes: [fixed('src', 5), store('cap', 2, 0)],
      parts: [part('r', [{ id: 'i', law: 'conduct', from: 'src', to: 'cap', g: 2 }])],
    });
  const coarse = runSystem(make(0.1), {}, { samples: 1000 });
  for (const n of [1, 5, 30]) close(coarse.trace.nodes.cap[n], 5 * (1 - (1 + 0.1) ** -n), 1e-9, `step ${n}`);
  const fine = runSystem(make(0.001), {}, { samples: 3000 });
  const at1s = fine.trace.nodes.cap[fine.trace.t.findIndex((t) => Math.abs(t - 1) < 1e-9)];
  close(at1s, 5 * (1 - Math.exp(-1)), 1e-3, 'one time constant');
});

test('clearance: a stock fed at G and cleared at K settles at G/K, with τ = V/K', () => {
  // The kidney's arithmetic: 16.67 mmol/h of waste into 42 L, cleared at
  // 4.167 L/h. C_ss = G/K = 4 mmol/L; from empty, (1 − 1/e) of it at τ.
  const G = 400 / 24;
  const K = 100 / 24;
  const V = 42;
  const s = sys({
    time: { unit: 'h', step: 0.01, run: 200 },
    substances: [{ id: 'q', name: 'urea', amount: 'mmol', level: 'mmol/L' }],
    nodes: [store('blood', V, 0), fixed('out', 0)],
    parts: [part('body', [{ id: 'make', law: 'pump', from: null, to: 'blood', rate: G }]), part('kidney', [{ id: 'clear', law: 'conduct', from: 'blood', to: 'out', g: K }])],
  });
  const r = runSystem(s, {}, { samples: 20000 });
  close(r.stats.node.blood.end, G / K, 1e-6, 'steady state');
  const tau = V / K;
  const i = r.trace.t.findIndex((t) => t >= tau - 1e-9);
  close(r.trace.nodes.blood[i], (G / K) * (1 - Math.exp(-r.trace.t[i] / tau)), 2e-3, 'at τ');
  // and at steady state what comes in goes out
  close(r.stats.flow.clear.end, G, 1e-6, 'balance');
});

test('a spillway (oneway with a drop) holds the level at drop + inflow/g', () => {
  const s = sys({
    time: { unit: 'h', step: 0.05, run: 500 },
    nodes: [store('water', 1, 42), fixed('out', 0)],
    parts: [part('drink', [{ id: 'in', law: 'pump', from: null, to: 'water', rate: 0.07 }]), part('kidney', [{ id: 'spill', law: 'oneway', from: 'water', to: 'out', g: 0.28, drop: 42 }])],
  });
  const r = runSystem(s);
  close(r.stats.node.water.end, 42 + 0.07 / 0.28, 1e-6, 'spillway level');
});

test('a oneway passes nothing backwards and nothing below its drop', () => {
  const s = sys({
    nodes: [fixed('lo', 1), junction('x'), fixed('hi', 3)],
    parts: [part('valve', [{ id: 'v', law: 'oneway', from: 'lo', to: 'x', g: 10, drop: 0 }]), part('load', [{ id: 'l', law: 'conduct', from: 'hi', to: 'x', g: 1 }])],
  });
  const r = runSystem(s);
  assert.equal(r.trace.flows.v[1], 0, 'pushed backwards, it stays shut');
  close(r.trace.nodes.x[1], 3, 1e-12, 'so the junction sits at the high side');
  const t = sys({
    nodes: [fixed('a', 1.5), junction('x'), fixed('gnd', 0)],
    parts: [part('led', [{ id: 'v', law: 'oneway', from: 'a', to: 'x', g: 10, drop: 1.8 }]), part('r', [{ id: 'l', law: 'conduct', from: 'x', to: 'gnd', g: 1 }])],
  });
  assert.equal(runSystem(t).trace.flows.v[1], 0, '1.5 V cannot push past a 1.8 V drop');
});

test('a junction on nothing floats: it reads no level and carries nothing', () => {
  const s = sys({
    nodes: [junction('x'), junction('y')],
    parts: [part('wire', [{ id: 'w', law: 'conduct', from: 'x', to: 'y', g: 1 }])],
  });
  const r = runSystem(s);
  assert.ok(Number.isNaN(r.trace.nodes.x[1]));
  assert.equal(r.trace.flows.w[1], 0);
});

test('conservation: stores joined only to each other keep every bit of their stuff', () => {
  const s = sys({
    time: { unit: 's', step: 0.1, run: 50 },
    nodes: [store('a', 1, 10), store('b', 2, 0), store('c', 0.5, 3)],
    parts: [part('ab', [{ id: 'x', law: 'conduct', from: 'a', to: 'b', g: 0.7 }]), part('bc', [{ id: 'y', law: 'conduct', from: 'b', to: 'c', g: 0.3 }])],
  });
  const r = runSystem(s, {}, { samples: 500 });
  const total = (k) => r.trace.nodes.a[k] * 1 + r.trace.nodes.b[k] * 2 + r.trace.nodes.c[k] * 0.5;
  for (const k of [0, 10, 100, r.trace.t.length - 1]) close(total(k), 13, 1e-12, `total at sample ${k}`);
  // and they end level with each other: (10 + 3) / (1 + 2 + 0.5)
  close(r.stats.node.b.end, 13 / 3.5, 1e-6, 'common level');
});

// --- Machines -----------------------------------------------------------------

test('a pump moves its rate exactly, and stops when its source is dry — never below zero', () => {
  const s = sys({
    time: { unit: 'min', step: 1, run: 20 },
    nodes: [store('tank', 1, 10), store('bucket', 1, 0)],
    parts: [part('pump', [{ id: 'p', law: 'pump', from: 'tank', to: 'bucket', rate: 0.75 }])],
  });
  const r = runSystem(s, {}, { samples: 20 });
  close(r.trace.nodes.bucket[4], 3, 1e-12, 'four minutes at 0.75');
  close(r.stats.node.tank.end, 0, 1e-12, 'emptied');
  close(r.stats.node.bucket.end, 10, 1e-12, 'all of it arrived');
  assert.ok(Math.min(...r.trace.nodes.tank) >= 0, 'never negative');
  const stop = r.events.find((e) => e.kind === 'stopped');
  assert.equal(stop.flow, 'p');
  assert.deepEqual(stop.why, { dry: 'tank' });
  close(stop.t, 14, 1e-12, 'ran dry at the end of the fourteenth minute: 13 × 0.75, then the last 0.25');
});

test('a machine takes its inputs in proportion and stops on the scarcest: c = min(a0/2, b0/1)', () => {
  const s = sys({
    time: { unit: 'min', step: 0.5, run: 30 },
    nodes: [store('a', 1, 20), store('b', 1, 6), store('c', 1, 0)],
    parts: [part('m', [{ id: 'make', law: 'react', inputs: { a: 2, b: 1 }, outputs: { c: 1 }, rate: 1 }])],
  });
  const r = runSystem(s);
  close(r.stats.node.c.end, 6, 1e-9, 'made');
  close(r.stats.node.a.end, 20 - 12, 1e-9, 'a left');
  close(r.stats.node.b.end, 0, 1e-12, 'b used up');
});

test('two machines short of one input share it in proportion, and the store never goes negative', () => {
  const s = sys({
    time: { unit: 's', step: 1, run: 3 },
    nodes: [store('pool', 1, 3), fixed('out', 0)],
    parts: [part('big', [{ id: 'b', law: 'pump', from: 'pool', to: 'out', rate: 4 }]), part('small', [{ id: 's', law: 'pump', from: 'pool', to: 'out', rate: 2 }])],
  });
  const r = runSystem(s, {}, { samples: 3 });
  // wanted 6 in the first second, 3 there: each gets half of its want
  close(r.trace.flows.b[1], 2, 1e-12, 'big');
  close(r.trace.flows.s[1], 1, 1e-12, 'small');
  assert.equal(r.trace.nodes.pool[1], 0);
});

test('a full buffer passes what flows through it: throughput = the slower of in and out', () => {
  const s = sys({
    time: { unit: 'min', step: 0.1, run: 30 },
    nodes: [fixed('src', 0), store('buffer', 1, 5, { max: 5 }), store('done', 1, 0)],
    parts: [part('in', [{ id: 'fill', law: 'pump', from: null, to: 'buffer', rate: 10 }]), part('out', [{ id: 'drain', law: 'pump', from: 'buffer', to: 'done', rate: 9.5 }])],
  });
  const r = runSystem(s);
  close(r.stats.flow.drain.end, 9.5, 1e-9, 'the consumer runs flat out');
  close(r.stats.flow.fill.end, 9.5, 1e-9, 'the producer is held to what fits');
  assert.ok(r.stats.node.buffer.max <= 5 + 1e-12, 'never over max');
});

test('helpers multiply a machine: rate = k × helpers', () => {
  const s = sys({
    time: { unit: 'min', step: 1, run: 1 },
    nodes: [store('ribosomes', 1, 40), store('parts', 1, 1e6), store('made', 1, 0)],
    parts: [part('make', [{ id: 'm', law: 'react', inputs: { parts: 1 }, outputs: { made: 1 }, rate: 0.25, by: ['ribosomes'] }])],
  });
  close(runSystem(s).stats.node.made.end, 0.25 * 40, 1e-12, 'made in a minute');
});

test('a thing that helps make itself doubles: x_n = x0·(1 + k·dt)^n → doubling time ln2/k', () => {
  const k = 0.02;
  const make = (step) =>
    sys({
      time: { unit: 'min', step, run: 100 },
      nodes: [fixed('soup', 0), store('copies', 1, 10)],
      parts: [part('copier', [{ id: 'c', law: 'react', inputs: { soup: 1 }, outputs: { copies: 1 }, rate: k, by: ['copies'] }])],
    });
  const coarse = runSystem(make(1), {}, { samples: 100 });
  close(coarse.trace.nodes.copies[50], 10 * (1 + k) ** 50, 1e-12, 'discrete');
  const fine = runSystem(make(0.01), {}, { samples: 10000 });
  const doubling = Math.log(2) / k;
  const i = fine.trace.t.findIndex((t) => t >= doubling - 1e-9);
  close(fine.trace.nodes.copies[i], 10 * Math.exp(k * fine.trace.t[i]), 1e-3, 'continuous');
  close(fine.trace.nodes.copies[i], 20, 2e-3, 'about twice as many after ln2/k');
});

// --- Needs, gates, ratings ------------------------------------------------------

test('a flow that needs a part stops when that part comes out, and says why', () => {
  const s = sys({
    nodes: [store('tank', 1, 100), store('engine', 1, 0)],
    parts: [part('feed', [{ id: 'f', law: 'pump', from: 'tank', to: 'engine', rate: 1, needs: [{ part: 'pump' }] }]), part('pump')],
  });
  assert.equal(runSystem(s).stats.node.engine.end, 10);
  const r = runSystem(s, pull(s, {}, 'pump'));
  assert.equal(r.stats.node.engine.end, 0);
  const stop = r.events.find((e) => e.kind === 'stopped');
  assert.deepEqual([stop.t, stop.flow, stop.why], [0, 'f', { missing: 'pump' }]);
});

test('a flow that needs a level stops when the level sinks below it — the battery that dies late', () => {
  // A 12.6 V battery (4 Ah per volt, 50.4 Ah) drained at 0.25 Ah/min;
  // the drain needs 9 V. It falls 0.0625 V a minute, so it reaches 9 V
  // after (12.6 − 9) / 0.0625 = 57.6 minutes and stops there.
  const s = sys({
    time: { unit: 'min', step: 0.1, run: 90 },
    nodes: [store('battery', 4, 50.4)],
    parts: [part('lights', [{ id: 'draw', law: 'pump', from: 'battery', to: null, rate: 0.25, needs: [{ node: 'battery', atLeast: 9 }] }])],
  });
  const r = runSystem(s, {}, { samples: 900 });
  const stop = r.events.find((e) => e.kind === 'stopped');
  assert.deepEqual(stop.why, { low: 'battery', atLeast: 9 });
  // A need is judged at the start of a step, so it can run one step past
  // the line: within a step of 57.6 min, and within a step's drain of 9 V.
  assert.ok(Math.abs(stop.t - 57.6) <= 0.1 + 1e-9, `stopped at ${stop.t}`);
  assert.ok(r.stats.node.battery.end >= 9 - (0.25 * 0.1) / 4 - 1e-12, `ended at ${r.stats.node.battery.end}`);
});

test('a gate with a band holds a level between its marks — the thermostat', () => {
  // Heat in at 10/min; a drain of 50/min that opens above 90 and shuts
  // below 86. The level should live between the marks, give or take a
  // step's worth of change either side.
  const s = sys({
    time: { unit: 'min', step: 0.1, run: 60 },
    nodes: [store('block', 1, 80), fixed('air', 0)],
    parts: [
      part('engine', [{ id: 'heat', law: 'pump', from: null, to: 'block', rate: 10 }]),
      part('hose', [{ id: 'cool', law: 'pump', from: 'block', to: 'air', rate: 50 }]),
      part('thermostat', [], { gates: [{ flow: 'cool', by: 'block', open: 'above', at: 90, band: 4 }] }),
    ],
  });
  const r = runSystem(s, {}, { samples: 600 });
  const late = r.trace.nodes.block.slice(100);
  assert.ok(Math.max(...late) <= 90 + 1 + 1e-9, `peak ${Math.max(...late)}`);
  assert.ok(Math.min(...late) >= 86 - 5 - 1e-9, `trough ${Math.min(...late)}`);
  assert.ok(new Set(r.trace.flows.cool.slice(100).map((v) => v > 0)).size === 2, 'the gate opened and shut');
  // Pull the thermostat and nothing holds the hose shut: it drains flat out.
  const open = runSystem(s, pull(s, {}, 'thermostat'));
  close(open.stats.node.block.end, 0, 1e-12, 'no thermostat: runs cold');
});

test('a gate stuck shut, or open, is a bad thermostat', () => {
  const s = sys({
    time: { unit: 'min', step: 0.1, run: 30 },
    nodes: [store('block', 1, 80), fixed('air', 0)],
    parts: [
      part('engine', [{ id: 'heat', law: 'pump', from: null, to: 'block', rate: 10 }]),
      part('hose', [{ id: 'cool', law: 'pump', from: 'block', to: 'air', rate: 50 }]),
      part('thermostat', [], {
        gates: [{ flow: 'cool', by: 'block', open: 'above', at: 90, band: 4 }],
        faults: [
          { id: 'shut', name: 'stuck shut', changes: [{ gate: 'cool', stuck: 'shut' }] },
          { id: 'open', name: 'stuck open', changes: [{ gate: 'cool', stuck: 'open' }] },
        ],
      }),
    ],
  });
  close(runSystem(s, swapBad(s, {}, 'thermostat', 'shut')).stats.node.block.end, 80 + 300, 1e-9, 'stuck shut: it only heats');
  close(runSystem(s, swapBad(s, {}, 'thermostat', 'open')).stats.node.block.end, 0, 1e-12, 'stuck open: it only cools');
});

test('a rating breaks a part only after it has been over for longer than it can take', () => {
  const s = sys({
    time: { unit: 'min', step: 0.5, run: 10 },
    nodes: [store('block', 1, 100)],
    parts: [part('engine', [{ id: 'heat', law: 'pump', from: null, to: 'block', rate: 5 }], { ratings: [{ node: 'block', above: 120, for: 2 }] })],
    checks: [{ part: 'engine', intact: true, fails: 'The engine seized.' }],
  });
  const r = runSystem(s, {}, { samples: 20 });
  // over 120 from t = 4.5 (122.5); broken once over for more than 2 min:
  // at 4.5 (0.5), 5 (1), 5.5 (1.5), 6 (2), 6.5 (2.5 > 2) → breaks at 6.5
  assert.deepEqual(r.broke, [{ part: 'engine', t: 6.5 }]);
  assert.equal(r.verdict, 'fails');
  close(r.failedAt, 6.5, 1e-12, 'the goal fails the moment it breaks');
  close(r.stats.node.block.end, 100 + 5 * 6.5, 1e-9, 'and a broken engine makes no more heat');
});

test('what broke stays broken: the next run starts with it broken, until a good one goes in', () => {
  const s = sys({
    nodes: [fixed('hi', 3), fixed('gnd', 0), junction('x')],
    parts: [
      part('r', [{ id: 'rr', law: 'conduct', from: 'hi', to: 'x', g: 1 / 47 }], { faults: [{ id: 'jumper', name: 'a plain wire', changes: [{ flow: 'rr', set: { g: 1e4 } }] }] }),
      part('led', [{ id: 'light', law: 'oneway', from: 'x', to: 'gnd', g: 0.1, drop: 1.8 }], { ratings: [{ flow: 'light', above: 0.03 }] }),
    ],
    checks: [{ read: { flow: 'light' }, above: 0.002, fails: 'Dark.' }],
  });
  const burnt = runSystem(s, swapBad(s, {}, 'r', 'jumper'));
  assert.deepEqual(burnt.broke.map((b) => b.part), ['led']);
  assert.equal(partState(s, burnt.after, 'led').broken, true);
  // Fix the resistor and only the resistor: still dark — the LED is still burnt.
  const halfFixed = putGood(s, burnt.after, 'r');
  assert.equal(runSystem(s, halfFixed).verdict, 'fails');
  // Fix the cause and replace what it burnt: light.
  assert.equal(runSystem(s, putGood(s, halfFixed, 'led')).verdict, 'works');
  // And replacing the LED without fixing the cause burns the new one too.
  assert.equal(runSystem(s, putGood(s, burnt.after, 'led')).broke[0].part, 'led');
});

// --- Pulling, nesting, bad parts ---------------------------------------------------

test('pull a part and the stores it holds go with it: everything that used them stops', () => {
  const s = sys({
    nodes: [store('tank', 1, 100), store('engine', 1, 0)],
    parts: [part('tank', [], { holds: ['tank'] }), part('line', [{ id: 'f', law: 'pump', from: 'tank', to: 'engine', rate: 1 }])],
  });
  const r = runSystem(s, pull(s, {}, 'tank'));
  assert.ok(Number.isNaN(r.stats.node.tank.end), 'no tank, no level');
  const stop = r.events.find((e) => e.kind === 'stopped');
  assert.deepEqual([stop.flow, stop.why], ['f', { gone: 'tank' }]);
});

test('a part inside another comes out with it', () => {
  const s = sys({
    nodes: [store('kits', 1, 100), store('made', 1, 0)],
    parts: [part('cytoplasm', [], { holds: ['kits'] }), part('ribosomes', [{ id: 'm', law: 'pump', from: 'kits', to: 'made', rate: 1 }], { within: 'cytoplasm' })],
  });
  const bench = pull(s, {}, 'cytoplasm');
  assert.equal(isPresent(s, bench, 'ribosomes'), false);
  assert.equal(runSystem(s, bench).stats.node.made.end, 0);
});

test('a bad part is the same part with different numbers, within the laws', () => {
  const s = sys({
    nodes: [store('cell', 1, 2), fixed('gnd', 0)],
    parts: [
      part('battery', [{ id: 'd', law: 'conduct', from: 'cell', to: 'gnd', g: 0.1 }], {
        holds: ['cell'],
        faults: [
          { id: 'dead', name: 'a dead one', changes: [{ node: 'cell', start: 0.1 }] },
          { id: 'leaky', name: 'a leaky one', changes: [{ flow: 'd', scale: { g: 5 } }] },
        ],
      }),
    ],
  });
  const bad = runSystem(s, swapBad(s, {}, 'battery', 'dead'), { samples: 10 });
  close(bad.trace.nodes.cell[0], 0.2, 1e-12, 'starts with a tenth');
  const leaky = runSystem(s, swapBad(s, {}, 'battery', 'leaky'), { samples: 10 });
  close(leaky.trace.flows.d[1], 0.5 * 2 / 1.5, 1e-9, 'five times the conductance (backward Euler: g·V/(1 + g·dt/C))');
});

// --- The bench -------------------------------------------------------------------------

test('the bench: keys are canonical, changes are listed, a kept part stays in', () => {
  const s = sys({
    nodes: [store('a', 1, 1)],
    parts: [part('stage', [], { keep: true }), part('x', [], { faults: [{ id: 'bad', name: 'a bad one', changes: [{ broken: true }] }] }), part('spare', [], { installed: false })],
  });
  assert.equal(benchKey(s, {}), '');
  const b = putGood(s, swapBad(s, {}, 'x', 'bad'), 'spare');
  assert.equal(benchKey(s, b), 'x=bad:bad,spare=ok');
  assert.deepEqual(changes(s, b).map((c) => [c.part, c.as]), [['x', 'bad'], ['spare', 'ok']]);
  assert.equal(benchKey(s, putGood(s, b, 'x')), 'spare=ok', 'a good one back in is no change at all');
  assert.throws(() => pull(s, {}, 'stage'), /stays in/);
  assert.throws(() => swapBad(s, {}, 'x', 'nope'), /no bad version/);
  // A bad part that arrives broken is broken from the first step.
  assert.equal(runSystem(s, swapBad(s, {}, 'x', 'bad')).verdict, 'works', 'x was not in the goal');
});

// --- The record, and the feed line -------------------------------------------------------

test('a run is a pure function of the system and the bench', () => {
  const s = sys({
    time: { unit: 'min', step: 0.5, run: 20 },
    nodes: [store('a', 1, 10), store('b', 2, 0), fixed('out', 0)],
    parts: [part('p', [{ id: 'x', law: 'react', inputs: { a: 1 }, outputs: { b: 2 }, rate: 0.3, by: ['a'] }]), part('q', [{ id: 'y', law: 'conduct', from: 'b', to: 'out', g: 0.1 }])],
  });
  assert.deepEqual(runSystem(s), runSystem(s));
});

test('nothing in the systems pack can read a clock or roll a die', () => {
  const dir = new URL('../systems/', import.meta.url);
  const files = readdirSync(dir, { recursive: true }).filter((f) => String(f).endsWith('.js'));
  assert.ok(files.length >= 4);
  for (const f of files) {
    const src = readFileSync(new URL(String(f), dir), 'utf8');
    assert.doesNotMatch(src, /\bDate\b|performance\.|Math\.random|setTimeout|setInterval|requestAnimationFrame/, `${f} reads a clock`);
  }
});

// --- What the validator refuses -------------------------------------------------------------

test('a system may choose laws and numbers, never write a law', () => {
  const ok = {
    id: 'v',
    title: 'V',
    model: 'A model.',
    intro: 'Hello.',
    time: { unit: 's', step: 1, run: 10 },
    substances: [
      { id: 'q', name: 'stuff', amount: 'u' },
      { id: 'h', name: 'heat', amount: 'kJ', level: '°C' },
    ],
    nodes: [store('a', 1, 1), fixed('b', 0), { id: 'hot', substance: 'h', kind: 'store', capacity: 1 }, junction('j')],
    parts: [part('p', [{ id: 'f', law: 'conduct', from: 'a', to: 'b', g: 1 }], { faults: [{ id: 'weak', name: 'a weak one', changes: [{ flow: 'f', scale: { g: 0.5 } }] }] })],
    goal: { says: 'It works.', asks: 'Will it work?', checks: [{ part: 'p', intact: true, fails: 'No.' }] },
  };
  assert.doesNotThrow(() => validateSystem(ok));
  const refuse = (change, pattern) => {
    const bad = structuredClone(ok);
    change(bad);
    assert.throws(() => validateSystem(bad), pattern);
  };
  refuse((s) => (s.parts[0].flows[0].law = 'teleport'), /law must be one of/);
  refuse((s) => (s.parts[0].flows[0].formula = 'x*2') && (s.parts[0].flows[0].law = 'formula'), /law must be one of/);
  refuse((s) => (s.parts[0].flows[0].to = 'hot'), /different substances/);
  refuse((s) => s.parts.push(part('q', [{ id: 'g2', law: 'conduct', from: 'b', to: 'b', g: 1 }])), /to itself/);
  refuse((s) => (s.nodes.push(fixed('c', 1)), s.parts.push(part('q', [{ id: 'g2', law: 'conduct', from: 'b', to: 'c', g: 1 }]))), /two fixed levels/);
  refuse((s) => s.parts.push(part('q', [{ id: 'm', law: 'react', inputs: { j: 1 }, outputs: { a: 1 }, rate: 1 }])), /junction/);
  refuse((s) => s.parts.push(part('q', [{ id: 'm', law: 'react', inputs: { a: 1 }, outputs: { a: 1 }, rate: 1 }])), /same node/);
  refuse((s) => (s.parts[0].flows[0].g = -1), /g must be a number/);
  refuse((s) => (s.parts[0].faults[0].changes = [{ flow: 'f', scale: { g: -2 } }]), /scale g must be a number/);
  refuse((s) => (s.parts[0].faults[0].changes = [{ flow: 'f', set: { rate: 3 } }]), /has no rate/);
  refuse((s) => s.parts.push(part('q', [], { faults: [{ id: 'x', name: 'x', changes: [{ flow: 'f', scale: { g: 2 } }] }] })), /own flows/);
  refuse((s) => s.parts.push(part('q', [], { within: 'q' })), /within must name another part/);
  refuse((s) => s.parts.push(part('q', [], { within: 'r' }), part('r', [], { within: 'q' })), /inside itself/);
  refuse((s) => s.parts.push(part('q', [], { keep: true, within: 'p' })), /cannot be kept in/);
  refuse((s) => s.parts.push(part('p', [])), /share an id/);
  refuse((s) => (s.goal.asks = 'Will it work.'), /question/);
  refuse((s) => (s.goal.checks = []), /at least 1/);
  refuse((s) => (s.time.step = 0.0001), /more than 20000 steps/);
  refuse((s) => (s.measure = { says: 'How much?', read: { node: 'a', stat: 'end' }, unit: 'u', max: 10, resolution: 3 }), /whole number of resolutions/);
  refuse((s) => (s.parts[0].at = undefined), /at must be \[column, row\]/);
  refuse((s) => (s.parts[0].ratings = [{ flow: 'f', below: 1 }]), /only above/);
  refuse((s) => (s.parts[0].gates = [{ flow: 'nope', by: 'a', open: 'above', at: 1 }]), /names no flow/);
});

test('a system is frozen once checked', () => {
  const s = sys({ nodes: [store('a', 1, 1)], parts: [part('p')] });
  assert.throws(() => {
    s.nodes[0].capacity = 99;
  }, TypeError);
});
