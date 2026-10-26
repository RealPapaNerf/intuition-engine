// The built-in systems, pinned to their hand calculations: what each one
// teaches is a number someone can check with a pencil, and these tests
// keep it so. If a system file's numbers change, these say what lesson
// moved with them.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LIBRARY, runSystem, pull, swapBad, putGood, addCopy, block, benchKey, isPresent } from '../systems/index.js';

const sys = (id) => LIBRARY.find((s) => s.id === id);
const near = (got, want, rel, what = '') => assert.ok(Math.abs(got - want) <= rel * Math.abs(want), `${what} ${got} vs ${want}`);

test('every built-in system validates, runs healthy, and meets its own goal', () => {
  assert.deepEqual(LIBRARY.map((s) => s.id), ['flashlight', 'kidneys', 'flu-cell', 'car', 'bathtub']);
  for (const s of LIBRARY) {
    const r = runSystem(s);
    assert.equal(r.verdict, 'works', `${s.id} as it ships`);
    assert.deepEqual(r.diag.unsettled, 0, `${s.id}: every oneway settled`);
    assert.ok(r.diag.clamped < 1e-9, `${s.id}: nothing went below empty`);
    assert.deepEqual(r.broke, [], `${s.id}: nothing breaks as it ships, so a kid never starts from a broken part`);
  }
});

test('every single change a kid can make to a built-in runs clean: every oneway settles, nothing goes below empty', () => {
  for (const s of LIBRARY) {
    const benches = [];
    for (const p of s.parts) {
      if (!p.keep) benches.push(pull(s, {}, p.id));
      if (!p.installed) benches.push(putGood(s, {}, p.id));
      for (const f of p.faults) benches.push(swapBad(s, {}, p.id, f.id));
      if (p.copies) benches.push(addCopy(s, {}, p.id));
      for (const f of p.flows) benches.push(block(s, {}, f.id));
    }
    for (const b of benches) {
      const r = runSystem(s, b);
      assert.equal(r.diag.unsettled, 0, `${s.id} ${benchKey(s, b)}`);
      assert.ok(r.diag.clamped < 1e-9, `${s.id} ${benchKey(s, b)}: ${r.diag.clamped} made from nowhere`);
    }
  }
});

// --- The flashlight: Ohm's law, and the loop -----------------------------------------

const F = sys('flashlight');
// The loop's resistances in ohms: cells 0.3, switch 0.05, resistor 47,
// the LED's 10 once it is on, the wire back 0.02.
const R_LOOP = 1000 / 3333 + 1000 / 20000 + 1000 / 21.28 + 10 + 1000 / 50000;

test('flashlight: I = (3.0 − 1.8) / R_loop ≈ 21 mA, under the LED’s 30 mA', () => {
  const r = runSystem(F);
  near(r.stats.flow.glow.max, 1000 * (3.0 - 1.8) / R_LOOP, 1e-4, 'LED current');
  assert.equal(r.reading.value, 21);
});

test('flashlight: a circuit is a loop — pull any piece of it and the light goes out', () => {
  for (const part of ['batteries', 'switch', 'resistor', 'led', 'wire']) {
    const r = runSystem(F, pull(F, {}, part));
    assert.equal(r.verdict, 'fails', part);
    assert.equal(r.stats.flow.glow.max, 0, `${part}: nothing flows`);
  }
});

test('flashlight: a plain wire for the resistor lets ~115 mA through, and the LED burns out', () => {
  const r = runSystem(F, swapBad(F, {}, 'resistor', 'jumper'));
  const rNoResistor = R_LOOP - 1000 / 21.28 + 1000 / 50000;
  near(r.stats.flow.glow.max, 1000 * 1.2 / rNoResistor, 1e-4, 'short-circuit current');
  assert.deepEqual(r.broke, [{ part: 'led', t: 1 }]);
  assert.equal(r.verdict, 'fails');
});

test('flashlight: fixing what burned is not fixing why it burned', () => {
  const burnt = runSystem(F, swapBad(F, {}, 'resistor', 'jumper')).after;
  assert.equal(runSystem(F, putGood(F, burnt, 'led')).broke[0]?.part, 'led', 'a new LED, same wire: burns again');
  assert.equal(runSystem(F, putGood(F, burnt, 'resistor')).verdict, 'fails', 'the right resistor, the burnt LED: still dark');
  assert.equal(runSystem(F, putGood(F, putGood(F, burnt, 'resistor'), 'led')).verdict, 'works', 'both: light');
});

test('flashlight: a second LED next to the first halves its share — I_each = ½ · 1.2 / (R_series + 10/2)', () => {
  const r = runSystem(F, addCopy(F, {}, 'led'));
  const series = R_LOOP - 10;
  near(r.stats.flow.glow.max, (0.5 * 1000 * 1.2) / (series + 5), 1e-4, 'each');
  near(r.stats.flow['glow#2'].max, r.stats.flow.glow.max, 1e-9, 'twins share evenly');
  assert.equal(r.verdict, 'works');
});

test('flashlight: tired batteries (1.98 V) still light it, dimly; flat ones (1.65 V) cannot pass 1.8 V', () => {
  const tired = runSystem(F, swapBad(F, {}, 'batteries', 'tired'));
  near(tired.stats.flow.glow.max, 1000 * (1.98 - 1.8) / R_LOOP, 1e-3, 'dim');
  assert.equal(tired.verdict, 'works');
  assert.equal(runSystem(F, swapBad(F, {}, 'batteries', 'flat')).stats.flow.glow.max, 0);
});

// --- The kidneys: stocks, flows, a spare, and a delay -------------------------------------

const K = sys('kidneys');
const G = 16.67; // mmol/h of urea made
const K2 = 2 * 2.083; // L/h cleared by two kidneys

test('kidneys: two clear the waste to G/K = 4 mmol/L, and one kidney is enough (G/(K/2) = 8)', () => {
  near(runSystem(K).stats.node.blood.end, G / K2, 1e-3, 'two');
  const one = runSystem(K, pull(K, {}, 'left-kidney'));
  near(one.stats.node.blood.end, G / (K2 / 2), 1e-3, 'one');
  assert.equal(one.verdict, 'works', 'the spare is the surprise');
});

test('kidneys: with none, waste climbs a straight line at G/V and water at (in − out) — and water crosses first', () => {
  const none = runSystem(K, pull(K, pull(K, {}, 'left-kidney'), 'right-kidney'));
  // urea: (20 − 4) / (16.67 / 42) = 40.3 h · water: (45 − 42.25) / (0.1042 − 0.0333) = 38.8 h
  assert.equal(none.failure.check, 1, 'the water check fails first');
  near(none.failedAt, (45 - 42.25) / (0.1042 - 0.0333), 0.01, 'water crosses');
  const urea20 = none.trace.t[none.trace.nodes.blood.findIndex((v) => v >= 20)];
  assert.ok(Math.abs(urea20 - (20 - 4) / (G / 42)) < 1, `urea crosses 20 at ${urea20} h`);
  near(none.stats.node.blood.max, 4 + (G / 42) * 168, 0.01, 'a week of it');
});

test('kidneys: dialysis alone keeps a body with no kidneys alive (G/K_dialysis ≈ 15 mmol/L)', () => {
  const b = putGood(K, pull(K, pull(K, {}, 'left-kidney'), 'right-kidney'), 'dialysis');
  const r = runSystem(K, b);
  assert.equal(r.verdict, 'works');
  assert.ok(r.stats.node.blood.max < G / 1.1 && r.stats.node.blood.max > 14, `${r.stats.node.blood.max}`);
});

test('kidneys: two sick kidneys fail slowly — waste heads for G/(0.15·K) ≈ 27 and passes 20 near 82 h', () => {
  const b = swapBad(K, swapBad(K, {}, 'left-kidney', 'sick'), 'right-kidney', 'sick');
  const r = runSystem(K, b);
  const css = G / (0.15 * K2);
  const tau = 42 / (0.15 * K2);
  assert.equal(r.failure.check, 0);
  near(r.failedAt, tau * Math.log((css - 4) / (css - 20)), 0.02, 'when the waste passes 20');
});

// --- The virus: a loop that feeds itself, and the cell it needs ----------------------------

const V = sys('flu-cell');

test('virus: early on, the recipes grow by e^(0.03·t) — copying at 0.04 less packing at 0.01', () => {
  // Coats are made at 0.2 per recipe per minute and a virus takes 20, so
  // packing is held to 0.01 per recipe per minute; the net is 0.03.
  const r = runSystem(V, {}, { samples: 960 });
  const at = (min) => r.trace.nodes.recipes[r.trace.t.findIndex((t) => t >= min)];
  near(at(120) / at(80), Math.exp(0.03 * 40), 0.03, 'growth over 40 minutes');
});

test('virus: about a thousand new viruses by eight hours, and the cell is spent', () => {
  const r = runSystem(V);
  assert.ok(r.stats.node.freed.end > 800 && r.stats.node.freed.end < 1300, `${r.stats.node.freed.end}`);
  assert.ok(r.stats.node.energy.end < 1, 'its energy is gone');
});

test('virus: every step it needs is a place to stop it', () => {
  const out = (b) => runSystem(V, b).stats.node.freed.end;
  assert.equal(out(pull(V, {}, 'receptor')), 0, 'no door, no way in');
  assert.ok(out(pull(V, {}, 'copier')) <= 10 + 1e-9, 'no copier: only the ten that came in');
  assert.equal(out(pull(V, {}, 'ribosomes')), 0, 'no coats');
  assert.equal(out(pull(V, {}, 'scissors')), 0, 'no scissors: stuck inside');
  assert.ok(runSystem(V, pull(V, {}, 'scissors')).stats.node.ready.end > 100, '…piling up');
  // no power plants: the cell's starting energy lets out a third of a virus, then nothing
  assert.ok(out(pull(V, {}, 'mitochondria')) < 1, 'no energy');
});

test('virus: pull the cytoplasm and the machines floating in it go too', () => {
  const b = pull(V, {}, 'cytoplasm');
  assert.equal(isPresent(V, b, 'ribosomes'), false);
  assert.equal(isPresent(V, b, 'mitochondria'), false);
  assert.equal(runSystem(V, b).stats.node.freed.end, 0);
});

test('virus: medicines hold it back without switching it off', () => {
  for (const [part, fault] of [['copier', 'jammed'], ['scissors', 'tamiflu']]) {
    const n = runSystem(V, swapBad(V, {}, part, fault)).stats.node.freed.end;
    assert.ok(n > 100 && n < 500, `${part}:${fault} → ${n}`);
  }
});

// --- The car: buffers, feedback, ratings ---------------------------------------------------

const C = sys('car');

test('car: 1.5 km a minute for 90 minutes, with the thermostat holding the engine near 90 °C', () => {
  const r = runSystem(C, {}, { samples: 900 });
  near(r.stats.node.trip.end, 1.5 * 90, 1e-3, 'distance');
  // It opens above 90 and shuts below 86; open, the hose pulls the block
  // down about 2 °C a step, so it can dip that far under 86 before the
  // valve has shut.
  const warm = r.trace.nodes.block.slice(r.trace.t.findIndex((t) => t >= 10));
  assert.ok(Math.max(...warm) < 93 && Math.min(...warm) > 83, `${Math.min(...warm)}–${Math.max(...warm)}`);
});

test('car: without the thermostat it runs cool at T = 25 + heat / (g_hose ⊕ g_radiator + g_block)', () => {
  const r = runSystem(C, pull(C, {}, 'thermostat'));
  const g = (40 * 75) / (40 + 75) + 2; // hose in series with radiator and fan, plus the block's own
  near(r.stats.node.block.end, 25 + (1000 * r.stats.flow.burn.end) / g, 1e-3, 'cool and steady');
  assert.equal(r.verdict, 'works', 'nothing breaks: a surprise');
});

test('car: pull the alternator and the battery carries it for about an hour, then the spark dies', () => {
  const r = runSystem(C, pull(C, {}, 'alternator'), { samples: 900 });
  const stop = r.events.find((e) => e.kind === 'stopped' && e.flow === 'make-spark');
  assert.deepEqual(stop.why, { low: 'battery', atLeast: 9 });
  // what the battery holds above 9 V, over what everything draws
  const usable = 3.97 * (50 / 3.97 - 9);
  const draw = usable / stop.t;
  assert.ok(draw > 0.2 && draw < 0.3, `drawing ${draw} Ah/min`);
  near(r.stats.node.trip.end, 1.5 * stop.t, 0.03, 'it drove until then');
  assert.equal(r.verdict, 'fails');
});

test('car: lose the cooling and the engine seizes; the fan is not needed at speed', () => {
  for (const part of ['radiator', 'water-pump', 'hoses']) {
    const r = runSystem(C, pull(C, {}, part));
    assert.equal(r.broke[0]?.part, 'engine', part);
    assert.ok(r.broke[0].t < 15, `${part}: seized at ${r.broke[0].t}`);
  }
  assert.equal(runSystem(C, swapBad(C, {}, 'thermostat', 'stuck-shut')).broke[0]?.part, 'engine');
  assert.equal(runSystem(C, pull(C, {}, 'fan')).verdict, 'works');
});

// --- The bathtub: the stock and flow there is nothing simpler than -----------------------

const B = sys('bathtub');

test('bathtub: it settles where in = out — 8 L/min = 0.8 L/min/cm × h, so h = 10 cm', () => {
  near(runSystem(B).stats.node.tub.end, 8 / 0.8, 1e-6, 'depth');
});

test('bathtub: no drain, and it rises 8/6 cm a minute to the top at (30 − 10) / (8/6) = 15 min', () => {
  const r = runSystem(B, pull(B, {}, 'drain'));
  assert.equal(r.failure.check, 1, 'it overflowed');
  near(r.failedAt, (30 - 10) / (8 / 6), 0.01, 'when');
});

test('bathtub: no tap, and it drains as 10·e^(−t/τ), τ = 6/0.8, under 5 cm at τ·ln 2', () => {
  const r = runSystem(B, pull(B, {}, 'tap'));
  assert.equal(r.failure.check, 0, 'it ran dry');
  near(r.failedAt, (6 / 0.8) * Math.log(2), 0.03, 'when');
});

test('bathtub: two taps settle twice as deep (20 cm), under the top — the stock does not follow the flow', () => {
  const r = runSystem(B, addCopy(B, {}, 'tap'));
  assert.equal(r.verdict, 'works');
  // it climbs toward 20 with τ = 7.5 min: 20 − 10·e^(−30/7.5) after half an hour
  near(r.stats.node.tub.end, 20 - 10 * Math.exp(-30 / 7.5), 0.01, 'still rising at the end');
});
