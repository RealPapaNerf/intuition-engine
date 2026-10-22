// Hand-calculation validation: the honest-physics contract. Each test
// states the textbook formula and checks the engine lands on it.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  makeModel,
  addNode,
  addMember,
  settle,
  step,
  checkBreaks,
  shed,
  makeGoal,
  utilization,
  ANT,
  WOOD,
  SILK,
} from '../engine/index.js';

function relErr(got, want) {
  return Math.abs(got - want) / Math.abs(want);
}

test('hanging mass: extension = W·L0/EA', () => {
  const model = makeModel();
  const top = addNode(model, { x: 0, y: 1, fixed: true });
  const bob = addNode(model, { x: 0, y: 0.94, mass: 0.05 });
  const m = addMember(model, top, bob, ANT); // L0 = 0.06 m

  const { settled } = settle(model);
  assert.ok(settled, 'should reach equilibrium');

  const W = 0.05 * model.gravity;
  const wantExt = (W * 0.06) / ANT.axialStiffness;
  const gotExt = 1 - bob.y - 0.06;
  assert.ok(relErr(gotExt, wantExt) < 0.02, `ext ${gotExt} vs ${wantExt}`);
  assert.ok(relErr(m.force, W) < 0.02, `tension ${m.force} vs ${W}`);
});

test('two-bar truss: member tension = W/(2·sinθ)', () => {
  const model = makeModel();
  const left = addNode(model, { x: -0.5, y: 1, fixed: true });
  const right = addNode(model, { x: 0.5, y: 1, fixed: true });
  const joint = addNode(model, { x: 0, y: 0.6, mass: 0.2 });
  const m1 = addMember(model, left, joint, WOOD);
  const m2 = addMember(model, right, joint, WOOD);

  const { settled } = settle(model);
  assert.ok(settled, 'should reach equilibrium');

  const W = 0.2 * model.gravity;
  const sinTheta = 0.4 / Math.hypot(0.5, 0.4);
  const wantT = W / (2 * sinTheta);
  assert.ok(relErr(m1.force, wantT) < 0.02, `T1 ${m1.force} vs ${wantT}`);
  assert.ok(relErr(m2.force, wantT) < 0.02, `T2 ${m2.force} vs ${wantT}`);
});

test('tension-only: an ant cannot push, so a node above it falls', () => {
  const model = makeModel();
  const anchor = addNode(model, { x: 0, y: 0, fixed: true });
  const above = addNode(model, { x: 0, y: 0.1, mass: 0.01 });
  const m = addMember(model, anchor, above, ANT);

  for (let i = 0; i < 100; i++) step(model, 0.0008);
  assert.equal(m.force, 0, 'compressed ant carries nothing');
  assert.ok(above.y < 0.1, 'unsupported node is falling');

  // The chain goes taut once the node swings below: it ends up hanging.
  settle(model);
  assert.ok(above.y < -0.09, `node should hang below anchor, y=${above.y}`);
  assert.ok(m.force > 0, 'ant carries the node in tension');
});

test('breakage: load past tensionLimit snaps the member', () => {
  const model = makeModel();
  const top = addNode(model, { x: 0, y: 1, fixed: true });
  const bob = addNode(model, { x: 0, y: 0.94, mass: 0.2 }); // W ≈ 1.96 N > 1.2 N
  const m = addMember(model, top, bob, ANT);

  let broke = [];
  for (let i = 0; i < 50000 && broke.length === 0; i++) {
    step(model, 0.0008);
    if (i % 10 === 0) broke = checkBreaks(model);
  }
  assert.ok(m.broken, 'overloaded ant should break');
});

test('silk absorbs: same drop, lower peak force than a stiff member', () => {
  const peak = (material) => {
    const model = makeModel();
    const top = addNode(model, { x: 0, y: 1, fixed: true });
    const bob = addNode(model, { x: 0, y: 0.8, mass: 0.02 });
    const m = addMember(model, top, bob, material, 0.2);
    // Drop: give it downward speed, record the worst tension.
    bob.vy = -1.0;
    let worst = 0;
    for (let i = 0; i < 20000; i++) {
      step(model, 0.0004);
      worst = Math.max(worst, m.force);
    }
    return worst;
  };
  const silkPeak = peak(SILK);
  const antPeak = peak(ANT);
  assert.ok(
    silkPeak < antPeak * 0.6,
    `silk peak ${silkPeak} should undercut stiff peak ${antPeak}`,
  );
});

// A redundant ant bridge: a deck chain that suffices, plus a lower chain,
// verticals and diagonals that mostly carry their own weight. Shedding
// should free the redundancy and keep the deck standing.
function buildBridge({ frogMass = 0.03 } = {}) {
  const model = makeModel();
  const left = addNode(model, { x: 0, y: 0, fixed: true });
  const right = addNode(model, { x: 1, y: 0, fixed: true });

  const xs = [0.2, 0.4, 0.6, 0.8];
  const deck = xs.map((x) => addNode(model, { x, y: -0.08, mass: 0.005 }));
  const lower = xs.map((x) => addNode(model, { x, y: -0.2, mass: 0.005 }));

  const chain = (nodes) => {
    addMember(model, left, nodes[0], ANT);
    for (let i = 0; i < nodes.length - 1; i++) {
      addMember(model, nodes[i], nodes[i + 1], ANT);
    }
    addMember(model, nodes[nodes.length - 1], right, ANT);
  };
  chain(deck);
  chain(lower);
  for (let i = 0; i < xs.length; i++) addMember(model, deck[i], lower[i], ANT);
  for (let i = 0; i < xs.length - 1; i++) {
    addMember(model, deck[i], lower[i + 1], ANT);
  }

  // The frog stands on the middle of the deck.
  deck[1].mass += frogMass / 2;
  deck[2].mass += frogMass / 2;

  return { model, deck };
}

test('the lazy colony: shedding frees ants and the bridge still holds', () => {
  const { model, deck } = buildBridge();
  const goal = makeGoal({ watchNodes: deck, minY: -0.35 });
  const settleOpts = { maxSteps: 30000 };

  const before = model.members.length;
  const result = shed(model, { goal, settleOpts });

  assert.ok(result.feasible, 'the full bridge should hold the frog');
  assert.ok(
    result.removed.length >= 5,
    `should free several ants, freed ${result.removed.length} of ${before}`,
  );
  settle(model, settleOpts);
  assert.ok(goal(model), 'the shed bridge still meets the goal');
  for (const m of model.members) {
    if (!m.broken) {
      assert.ok(utilization(m) <= 1, 'no survivor is overloaded');
    }
  }
});

// Member self-weight (lumped mass): a member's mass hangs half on each
// end. Hanging n massive ants in a vertical chain, link k from the top
// carries everything below its upper end: (n − k + ½)·m·g. Ants weigh
// ~0.015 N, so these settle to a tighter tolerance than the default (an
// absolute kinetic-energy threshold, sized for frog-scale loads).
const FINE = { tol: 1e-15, maxSteps: 400000 };

test('self-weight: a hanging chain of ants, link k carries (n − k + ½)·m·g', () => {
  const n = 5;
  const model = makeModel();
  let above = addNode(model, { x: 0, y: 0, fixed: true });
  const links = [];
  for (let k = 1; k <= n; k++) {
    const below = addNode(model, { x: 0, y: -0.1 * k, mass: 0 });
    const m = addMember(model, above, below, ANT);
    m.mass = ANT.mass;
    links.push(m);
    above = below;
  }

  const { settled } = settle(model, FINE);
  assert.ok(settled, 'should reach equilibrium');

  const w = ANT.mass * model.gravity;
  links.forEach((m, i) => {
    const k = i + 1;
    const want = (n - k + 0.5) * w;
    assert.ok(relErr(m.force, want) < 1e-3, `link ${k}: ${m.force} vs ${want}`);
    // and each stretches by its own T·L0/EA
    const len = Math.hypot(m.b.x - m.a.x, m.b.y - m.a.y);
    const wantLen = 0.1 * (1 + want / ANT.axialStiffness);
    assert.ok(relErr(len, wantLen) < 1e-3, `link ${k} length ${len} vs ${wantLen}`);
  });
});

test('self-weight: a member that lets go stops weighing on the structure', () => {
  const model = makeModel();
  const top = addNode(model, { x: 0, y: 0, fixed: true });
  const mid = addNode(model, { x: 0, y: -0.1, mass: 0 });
  const bottom = addNode(model, { x: 0, y: -0.2, mass: 0 });
  const upper = addMember(model, top, mid, ANT);
  const lower = addMember(model, mid, bottom, ANT);
  upper.mass = ANT.mass;
  lower.mass = ANT.mass;
  const w = ANT.mass * model.gravity;

  settle(model, FINE);
  assert.ok(relErr(upper.force, 1.5 * w) < 1e-3, `both hanging: ${upper.force}`);

  lower.broken = true; // it let go: its whole weight leaves with it
  settle(model, FINE);
  assert.ok(relErr(upper.force, 0.5 * w) < 1e-3, `one left: ${upper.force}`);
});
