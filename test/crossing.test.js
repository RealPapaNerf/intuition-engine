// The crossing: hand calculations for cargo walking a built structure,
// and the two claims the quasi-static crossing rests on — the cargo on
// a joint is the worst case, and the verdict is the statics.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  makeModel,
  addNode,
  addMember,
  settle,
  activeMembers,
  utilization,
  makeCrossing,
  advanceCrossing,
  runCrossing,
  crossingCases,
  SHED_MARGIN,
  shed,
  ANT,
  SPAN_GAP,
  makeBlueprint,
  addLink,
  removeLink,
  buildModel,
  findRoute,
  linkKey,
  pointKey,
} from '../engine/index.js';

const g = 9.81;
const FINE = { tol: 1e-14, maxSteps: 400000 };

function relErr(got, want) {
  return Math.abs(got - want) / Math.abs(want);
}

// Two ants from banks 0.2 m apart meet at an apex 0.1 m down: θ = 45°.
// The apex carries one ant's mass (half of each arm) plus the cargo.
function vBridge({ armMass = ANT.mass } = {}) {
  const model = makeModel();
  const left = addNode(model, { x: -0.1, y: 0, fixed: true });
  const right = addNode(model, { x: 0.1, y: 0, fixed: true });
  const apex = addNode(model, { x: 0, y: -0.1, mass: 0 });
  const arms = [addMember(model, left, apex, ANT), addMember(model, apex, right, ANT)];
  for (const m of arms) m.mass = armMass;
  return { model, route: [left, apex, right], arms, apex };
}

// Hand calc for the loaded V: arms stretch to L = L0(1 + T/EA), the apex
// drops to h = √(L² − 0.1²), and T = W·L/(2h). Solved by fixed point.
function vHandCalc(cargoMass) {
  const W = (cargoMass + ANT.mass) * g;
  const L0 = Math.hypot(0.1, 0.1);
  let T = W / (2 * Math.SQRT1_2);
  for (let i = 0; i < 50; i++) {
    const L = L0 * (1 + T / ANT.axialStiffness);
    const h = Math.sqrt(L * L - 0.01);
    T = (W * L) / (2 * h);
  }
  const L = L0 * (1 + T / ANT.axialStiffness);
  return { T, h: Math.sqrt(L * L - 0.01) };
}

test('V bridge: with the cargo on the apex, each arm carries W/(2·sinθ)', () => {
  const { model, route, arms, apex } = vBridge();
  const c = makeCrossing(model, { route, cargoMass: 0.05, dryY: -1 });
  // The judged frame with the cargo standing on the apex.
  while (!(c.phase === 'walk' && c.leg === 0 && c.t === 1 && c.still)) advanceCrossing(c);

  const W = (0.05 + ANT.mass) * g;
  for (const m of arms) {
    const len = Math.hypot(m.b.x - m.a.x, m.b.y - m.a.y);
    const sinTheta = -apex.y / len; // the angle as it actually sags
    const want = W / (2 * sinTheta);
    assert.ok(relErr(m.force, want) < 2e-3, `arm ${m.force} vs ${want}`);
  }
  const { T } = vHandCalc(0.05);
  assert.ok(relErr(arms[0].force, T) < 2e-3, `hand calc ${T} vs ${arms[0].force}`);
});

test('V bridge: the ants let go exactly where the hand calc says', () => {
  // At the grip limit the arms stretch 2%; that sets the angle, and the
  // angle sets the biggest cargo: W = 2·Tmax·sinθ.
  const Tmax = ANT.tensionLimit;
  const L = Math.hypot(0.1, 0.1) * (1 + Tmax / ANT.axialStiffness);
  const sinTheta = Math.sqrt(L * L - 0.01) / L;
  const critical = (2 * Tmax * sinTheta) / g - ANT.mass;

  const run = (cargoMass) => {
    const v = vBridge();
    return { v, c: runCrossing(v.model, { route: v.route, cargoMass, dryY: -1 }) };
  };
  const under = run(critical * 0.98).c;
  const { v, c: over } = run(critical * 1.02);
  assert.equal(under.outcome, 'holds', `98% of ${critical} kg should hold`);
  assert.ok(under.peakUtilization > 0.95, `peak ${under.peakUtilization}`);
  assert.equal(over.outcome, 'snapped', `102% of ${critical} kg should snap`);
  assert.ok(v.arms.includes(over.snapped[0]), 'an arm is what let go');
});

test('a sag that reaches the water dunks the cargo, and one that stops short does not', () => {
  const { h } = vHandCalc(0.05); // the loaded apex sits h below the banks
  const run = (dryY) => {
    const { model, route } = vBridge();
    return runCrossing(model, { route, cargoMass: 0.05, dryY });
  };
  assert.equal(run(-h + 0.005).outcome, 'dunked', `apex sags to ${-h}`);
  assert.equal(run(-h - 0.005).outcome, 'holds');
});

test('the lever rule: between two joints the cargo splits its weight by distance', () => {
  const { model, route } = vBridge();
  const c = makeCrossing(model, { route, cargoMass: 0.05, dryY: -1 });
  let seen = 0;
  while (c.phase !== 'over') {
    advanceCrossing(c);
    if (c.phase !== 'walk' || c.t <= 0 || c.t >= 1) continue;
    const behind = route[c.leg].mass - c.baseMass[c.leg];
    const ahead = route[c.leg + 1].mass - c.baseMass[c.leg + 1];
    assert.ok(Math.abs(behind - (1 - c.t) * 0.05) < 1e-12);
    assert.ok(Math.abs(ahead - c.t * 0.05) < 1e-12);
    seen++;
  }
  assert.ok(seen > 0, 'the cargo walked between joints');
});

test('a structure that cannot hold itself lets go before the cargo steps on', () => {
  // Arms of 0.3 kg each: the apex weighs 2.94 N, so each arm pulls
  // 2.94 / (2·sin45°) ≈ 2.1 N against a 1.2 N grip, cargo or no cargo.
  const { model, route } = vBridge({ armMass: 0.3 });
  const c = runCrossing(model, { route, cargoMass: 0.05, dryY: -1 });
  assert.equal(c.outcome, 'snapped');
  assert.equal(c.onBridge, false, 'it broke while still on its scaffold');
});

// --- The archetype, through blueprints ---------------------------------

const L = SPAN_GAP;

function row(i0, i1, j) {
  const points = [];
  for (let i = i0; i <= i1; i++) points.push([i, j]);
  return points;
}

function chainBp(...paths) {
  const bp = makeBlueprint();
  for (const pts of paths) {
    for (let k = 0; k < pts.length - 1; k++) {
      const why = addLink(L, bp, pts[k], pts[k + 1]);
      assert.ok(why === null || why === 'already-placed', `${pts[k]}→${pts[k + 1]}: ${why}`);
    }
  }
  return bp;
}

const TAUT = () => chainBp(row(0, 10, 0));
const U1 = () => chainBp([[0, 0], ...row(1, 9, -1), [10, 0]]);
const U2 = () => chainBp([[0, 0], [1, -1], ...row(2, 8, -2), [9, -1], [10, 0]]);
const U3 = () => chainBp([[0, 0], [1, -1], [2, -2], ...row(3, 7, -3), [8, -2], [9, -1], [10, 0]]);
// A taut deck with stays fanned down from the tall supports.
const STAYED = () =>
  chainBp(
    row(0, 10, 0),
    [[0, 3], [1, 2], [2, 1], [3, 0]],
    [[0, 2], [1, 1], [2, 0]],
    [[0, 1], [1, 0]],
    [[10, 3], [9, 2], [8, 1], [7, 0]],
    [[10, 2], [9, 1], [8, 0]],
    [[10, 1], [9, 0]],
  );

function crossBp(bp, cargoMass) {
  const route = findRoute(L, bp);
  const { model, nodeOf } = buildModel(L, bp);
  return runCrossing(model, {
    route: route.map((p) => nodeOf.get(pointKey(p))),
    cargoMass,
    dryY: L.dryY,
  });
}

// The highest utilization with the cargo standing on each route joint.
function staticEnvelope(bp, cargoMass) {
  const route = findRoute(L, bp);
  const { model, nodeOf } = buildModel(L, bp);
  const { loadCases } = crossingCases(route.map((p) => nodeOf.get(pointKey(p))), cargoMass, {
    dryY: L.dryY,
  });
  let worst = 0;
  for (const apply of loadCases) {
    apply(model);
    settle(model, FINE);
    for (const m of activeMembers(model)) worst = Math.max(worst, utilization(m));
  }
  return worst;
}

test('the archetype teaches sag against tension: taut snaps, deep dunks, between holds', () => {
  const hopper = 0.05;
  assert.equal(crossBp(TAUT(), hopper).outcome, 'snapped');
  assert.equal(crossBp(U1(), hopper).outcome, 'holds');
  assert.equal(crossBp(U3(), hopper).outcome, 'dunked');
  // Same ten ants in every one: shape, not count, decides.
  for (const bp of [TAUT(), U1(), U3()]) assert.equal(bp.links.length, 10);
});

test('scaffold release lands where statics does (one equilibrium for a hanging net)', () => {
  const bp = U2();
  const route = findRoute(L, bp);
  const a = buildModel(L, bp);
  const c = makeCrossing(a.model, {
    route: route.map((p) => a.nodeOf.get(pointKey(p))),
    cargoMass: 0.05,
    dryY: L.dryY,
  });
  while (c.phase !== 'walk') advanceCrossing(c);

  const b = buildModel(L, bp);
  settle(b.model, FINE);
  for (const [k, n] of a.nodeOf) {
    const m = b.nodeOf.get(k);
    assert.ok(Math.hypot(n.x - m.x, n.y - m.y) < 1e-4, `joint ${k} off by ${Math.hypot(n.x - m.x, n.y - m.y)}`);
  }
});

test('judging at the joints is enough: between two joints is never worse than the worse joint', () => {
  for (const [bp, cargoMass] of [[U1(), 0.05], [STAYED(), 0.05]]) {
    const route = findRoute(L, bp);
    const { model, nodeOf } = buildModel(L, bp);
    const nodes = route.map((p) => nodeOf.get(pointKey(p)));
    const at = (leg, t) => {
      nodes.forEach((n) => {
        n.mass = 0;
      });
      nodes[leg].mass += (1 - t) * cargoMass;
      nodes[leg + 1].mass += t * cargoMass;
      settle(model, FINE);
      let u = 0;
      for (const m of activeMembers(model)) u = Math.max(u, utilization(m));
      return u;
    };
    for (let leg = 0; leg < nodes.length - 1; leg++) {
      const ends = Math.max(at(leg, 0), at(leg, 1));
      const mid = at(leg, 0.5);
      assert.ok(mid <= ends + 1e-6, `leg ${leg}: midway ${mid} vs joints ${ends}`);
    }
  }
});

test('the verdict is the statics: a crossing peaks at the static envelope', () => {
  const chonk = 0.1;
  const c = crossBp(U2(), chonk);
  const truth = staticEnvelope(U2(), chonk);
  assert.equal(c.outcome, 'holds');
  assert.ok(Math.abs(c.peakUtilization - truth) < 1e-3, `crossing ${c.peakUtilization} vs statics ${truth}`);

  const failed = crossBp(TAUT(), 0.05);
  assert.equal(failed.outcome, 'snapped');
  assert.ok(staticEnvelope(TAUT(), 0.05) > 1, 'statics agrees it cannot hold');
});

test('the shed over a crossing frees what the cargo can do without, and the lean bridge holds', () => {
  const hopper = 0.05;
  const bp = STAYED();
  const route = findRoute(L, bp);
  const { model, nodeOf, memberOf } = buildModel(L, bp);
  const walkway = new Set();
  for (let k = 0; k < route.length - 1; k++) {
    walkway.add(memberOf.get(linkKey(route[k], route[k + 1])));
  }
  const result = shed(model, {
    removable: (m) => !walkway.has(m), // the frog walks on these
    ...crossingCases(route.map((p) => nodeOf.get(pointKey(p))), hopper, { dryY: L.dryY }),
    settleOpts: { maxSteps: 30000 },
  });
  assert.ok(result.feasible);
  assert.ok(result.removed.length > 0, 'some stays were lazy');
  assert.ok(result.essential.length > 0, 'and some were not');
  for (const m of result.removed) assert.ok(!walkway.has(m));

  const keyOf = new Map([...memberOf].map(([k, m]) => [m, k]));
  const lean = makeBlueprint(bp.links);
  for (const m of result.removed) {
    const [p, q] = keyOf.get(m).split('|').map((s) => s.split(',').map(Number));
    removeLink(lean, p, q);
  }
  assert.deepEqual(findRoute(L, lean), route, 'the frog walks the same way');
  const again = crossBp(lean, hopper);
  assert.equal(again.outcome, 'holds');
  assert.ok(again.peakUtilization <= 1 - SHED_MARGIN.utilization + 1e-4);
});
