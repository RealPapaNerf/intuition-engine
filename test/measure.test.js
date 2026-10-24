// The scale: the ladder's bisection against known thresholds, and the
// measured breaking load against the V bridge's hand calculation
// (decisions 2026-10-24).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  makeLadder,
  breakingLoad,
  makeModel,
  addNode,
  addMember,
  runCrossing,
  ANT,
  SPAN_GAP,
  makeBlueprint,
  addLink,
  buildModel,
  findRoute,
  pointKey,
} from '../engine/index.js';

const g = 9.81;

// --- The ladder, against a fake monotone threshold ----------------------

function fakeScale(threshold, scale) {
  return breakingLoad((m) => m <= threshold + 1e-12, scale);
}

test('the ladder reads the heaviest grid mass under the threshold', () => {
  const scale = { max: 0.5, resolution: 0.005 };
  for (const t of [0.0049, 0.005, 0.1234, 0.25, 0.4951, 0.499]) {
    const { mass, maxed, heldAny } = fakeScale(t, scale);
    assert.equal(mass, Math.floor(t / scale.resolution + 1e-9) * scale.resolution, `threshold ${t}`);
    assert.equal(maxed, false);
    assert.equal(heldAny, mass > 0);
  }
});

test('a threshold past the top pins the scale at its stop', () => {
  const { mass, maxed, heldAny, probes } = fakeScale(9, { max: 0.5, resolution: 0.005 });
  assert.equal(mass, 0.5);
  assert.equal(maxed, true);
  assert.equal(heldAny, true);
  assert.equal(probes.length, 1, 'the top held: one probe answers');
});

test('a bridge that carries nothing reads zero with heldAny false', () => {
  const { mass, maxed, heldAny } = fakeScale(-1, { max: 0.5, resolution: 0.005 });
  assert.equal(mass, 0);
  assert.equal(maxed, false);
  assert.equal(heldAny, false);
});

test('the ladder stays within its probe budget and its grid', () => {
  const scale = { max: 0.5, resolution: 0.005 };
  const N = Math.round(scale.max / scale.resolution);
  const budget = 1 + Math.ceil(Math.log2(N + 1));
  for (let k = -1; k <= N; k++) {
    const { probes } = fakeScale(k * scale.resolution + scale.resolution / 2, scale);
    assert.ok(probes.length <= budget, `threshold step ${k}: ${probes.length} probes`);
    for (const p of probes) {
      assert.ok(Math.abs(p.mass / scale.resolution - Math.round(p.mass / scale.resolution)) < 1e-9);
      assert.ok(p.mass >= 0 && p.mass <= scale.max);
    }
  }
});

test('the ladder refuses misuse: double next, unasked report, early result', () => {
  const ladder = makeLadder({ max: 0.1, resolution: 0.01 });
  assert.throws(() => ladder.report(true), /nothing was asked/);
  assert.throws(() => ladder.result(), /still running/);
  ladder.next();
  assert.throws(() => ladder.next(), /report the last probe/);
  assert.throws(() => makeLadder({ max: 0, resolution: 0.01 }), /scale/);
  assert.throws(() => makeLadder({ max: 0.01, resolution: 0.1 }), /scale/);
});

// --- The reading, against the V bridge's hand calculation ---------------

// Two ants from banks 0.2 m apart meet at an apex 0.1 m down (the same
// rig as test/crossing.test.js). At the grip limit the arms stretch,
// that sets the angle, and the angle sets the critical cargo:
// W = 2·Tmax·sinθ.
function vBridge() {
  const model = makeModel();
  const left = addNode(model, { x: -0.1, y: 0, fixed: true });
  const right = addNode(model, { x: 0.1, y: 0, fixed: true });
  const apex = addNode(model, { x: 0, y: -0.1, mass: 0 });
  const arms = [addMember(model, left, apex, ANT), addMember(model, apex, right, ANT)];
  for (const m of arms) m.mass = ANT.mass;
  return { model, route: [left, apex, right] };
}

test('the measured breaking load lands on the hand calculation, within one resolution', () => {
  const Tmax = ANT.tensionLimit;
  const L = Math.hypot(0.1, 0.1) * (1 + Tmax / ANT.axialStiffness);
  const sinTheta = Math.sqrt(L * L - 0.01) / L;
  const critical = (2 * Tmax * sinTheta) / g - ANT.mass;

  const scale = { max: 0.2, resolution: 0.002 };
  const { mass, maxed } = breakingLoad((cargoMass) => {
    const { model, route } = vBridge();
    return runCrossing(model, { route, cargoMass, dryY: -1 }).outcome === 'holds';
  }, scale);

  assert.equal(maxed, false);
  assert.ok(
    Math.abs(mass - critical) <= scale.resolution,
    `measured ${mass} kg vs analytic ${critical} kg`,
  );
});

// --- The archetype's scale, on a kid's bridge ---------------------------

test("the archetype's scale is consistent: the reading holds, one step more does not", () => {
  const L = SPAN_GAP;
  const bp = makeBlueprint();
  const hang = [[0, 0], ...Array.from({ length: 9 }, (_, i) => [i + 1, -1]), [10, 0]];
  for (let k = 0; k < hang.length - 1; k++) {
    assert.equal(addLink(L, bp, hang[k], hang[k + 1]), null);
  }

  const holdsAt = (cargoMass) => {
    const route = findRoute(L, bp);
    const { model, nodeOf } = buildModel(L, bp);
    return (
      runCrossing(model, {
        route: route.map((p) => nodeOf.get(pointKey(p))),
        cargoMass,
        dryY: L.dryY,
      }).outcome === 'holds'
    );
  };

  const { mass, maxed, heldAny } = breakingLoad(holdsAt, L.measure);
  assert.ok(heldAny, 'the U bridge carries something');
  assert.ok(mass >= 0.05, 'it carried the 50 g hopper in the crossing tests');
  if (!maxed) {
    assert.ok(holdsAt(mass), 'the reading itself holds');
    assert.ok(!holdsAt(mass + L.measure.resolution), 'one step past the reading does not');
  }
});
