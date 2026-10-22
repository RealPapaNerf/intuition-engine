// The strain performance: what it may show, and that it stays honest —
// slack links hang on the curve a chain of their length really hangs
// in, meshes never stretch, recoil comes from stored strain energy, and
// no motion strays far from the engine's geometry.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  makeModel,
  addNode,
  addMember,
  ANT,
  SILK,
  STRAIN,
  strainState,
  parabolaLength,
  droopSag,
  linkPath,
  pathLength,
  chainPoses,
  recoilSpeed,
} from '../engine/index.js';

// A link pulled to a chosen utilization: set its force as the solver
// would have.
function link({ material = ANT, length = 0.1, restLength = length, u = 0, mass = ANT.mass } = {}) {
  const model = makeModel();
  const a = addNode(model, { x: 0, y: 0, fixed: true });
  const b = addNode(model, { x: length, y: 0 });
  const m = addMember(model, a, b, material, restLength);
  m.mass = mass;
  m.force = u * material.tensionLimit;
  return m;
}

test('states follow utilization: grip, tremble at ¾, slip near the limit; slack when idle', () => {
  assert.equal(strainState(link({ u: 0 })), 'slack');
  assert.equal(strainState(link({ u: 0.3 })), 'grip');
  assert.equal(strainState(link({ u: STRAIN.tremble })), 'tremble');
  assert.equal(strainState(link({ u: STRAIN.slip })), 'slip');
  const gone = link({ u: 0.5 });
  gone.broken = true;
  assert.equal(strainState(gone), 'broken');
});

test('the parabola length formula: chord when flat, 2·sag when folded, and an honest integral between', () => {
  assert.equal(parabolaLength(0.1, 0), 0.1);
  // Shallow: the series d + 8h²/(3d) − 32h⁴/(5d³) + …
  const d = 0.1;
  const h = 0.002;
  const series = d + (8 * h ** 2) / (3 * d) - (32 * h ** 4) / (5 * d ** 3);
  assert.ok(Math.abs(parabolaLength(d, h) - series) < 1e-9);
  // Steep: approaches 2h.
  assert.ok(Math.abs(parabolaLength(0.001, 1) / 2 - 1) < 1e-3);
  // Against brute force: the same parabola cut into 20 000 straight bits.
  for (const sag of [0.01, 0.04, 0.12]) {
    let len = 0;
    let px = 0;
    let py = 0;
    for (let k = 1; k <= 20000; k++) {
      const x = (d * k) / 20000;
      const y = (4 * sag * x * (d - x)) / (d * d);
      len += Math.hypot(x - px, y - py);
      px = x;
      py = y;
    }
    assert.ok(Math.abs(parabolaLength(d, sag) - len) / len < 1e-6, `sag ${sag}: ${parabolaLength(d, sag)} vs ${len}`);
  }
});

test('a slack link hangs on a curve exactly as long as the chain', () => {
  for (const chord of [0.095, 0.07, 0.03]) {
    const m = link({ length: chord, restLength: 0.1 }); // force 0: slack
    const sag = droopSag(chord, 0.1);
    assert.ok(Math.abs(parabolaLength(chord, sag) - 0.1) < 1e-9);
    const fine = linkPath(m, 2000);
    assert.ok(Math.abs(pathLength(fine) - 0.1) < 1e-5, `chord ${chord}: drawn ${pathLength(fine)}`);
    assert.ok(Math.abs(pathLength(linkPath(m)) - 0.1) / 0.1 < 0.01, 'the default drawing is within 1%');
    // It hangs down, and its ends are the nodes, exactly.
    const mid = fine[1000];
    assert.ok(mid.y < -0.9 * sag, `midpoint ${mid.y} should hang ~${-sag}`);
    assert.deepEqual(fine[0], { x: m.a.x, y: m.a.y });
    assert.deepEqual(fine[2000], { x: m.b.x, y: m.b.y });
  }
  // Pulling, it doesn't droop: a straight line between the nodes.
  assert.equal(linkPath(link({ u: 0.5 })).length, 2);
});

test('meshes never stretch: a link that really stretches opens real gaps', () => {
  // Silk at its limit is 31% longer than it rests; three instances keep
  // their size, so the gaps between them grow by the stretch.
  const L0 = 0.1;
  const stretched = L0 * (1 + SILK.tensionLimit / SILK.axialStiffness);
  const m = link({ material: SILK, length: stretched, restLength: L0, u: 1, mass: 0 });
  const { instances } = chainPoses(m, { perLink: 3, size: (0.9 * L0) / 3 });
  for (const it of instances) {
    assert.ok(Math.abs(it.to - it.from - (0.9 * L0) / 3) < 1e-12, 'each instance keeps its size');
  }
  const covered = instances.reduce((s, it) => s + (it.to - it.from), 0);
  assert.ok(Math.abs(stretched - covered - (stretched - 0.9 * L0)) < 1e-12);
  assert.ok(stretched - covered > 0.3 * L0, 'the stretch shows as gaps');
});

test('below the tremble threshold every instance sits on the chain; above it, a bounded quiver', () => {
  const calm = link({ u: 0.7 });
  for (let t = 0; t < 1; t += 0.013) {
    for (const it of chainPoses(calm, { perLink: 3, t }).instances) {
      assert.ok(Math.hypot(it.dx, it.dy) === 0, 'no shake');
      assert.ok(Math.abs(it.y) < 1e-15, 'on the line');
    }
  }
  const hard = link({ u: 1 });
  let moved = 0;
  for (let t = 0; t < 1; t += 0.013) {
    for (const it of chainPoses(hard, { perLink: 3, t }).instances) {
      const shake = Math.hypot(it.dx, it.dy);
      assert.ok(shake <= STRAIN.quiver * 1.5 + 1e-12, 'never strays past the quiver');
      if (shake > STRAIN.quiver / 4) moved++;
    }
  }
  assert.ok(moved > 0, 'it does quiver');
});

test('near the limit, instances lose their hold one by one', () => {
  const slipped = (u) =>
    chainPoses(link({ u }), { perLink: 3, seed: 1 }).instances.filter((it) => it.slip > 0).length;
  assert.equal(slipped(0.89), 0);
  assert.equal(slipped(0.92), 1);
  assert.equal(slipped(0.96), 2);
  assert.equal(slipped(1), 3);
  const full = chainPoses(link({ u: 1 }), { perLink: 3 }).instances;
  assert.ok(full.every((it) => it.slip === 1));
});

test('recoil: a link that lets go flies back at v = F/√(k·m), its strain energy as motion', () => {
  const m = link({ length: 0.1, u: 1 });
  const k = ANT.axialStiffness / 0.1;
  const v = recoilSpeed(m);
  assert.ok(Math.abs(v - ANT.tensionLimit / Math.sqrt(k * ANT.mass)) < 1e-12);
  const stored = (ANT.tensionLimit * ANT.tensionLimit) / (2 * k);
  assert.ok(Math.abs(0.5 * ANT.mass * v * v - stored) < 1e-12, 'energy in = energy out');
  assert.equal(recoilSpeed(link({ mass: 0 })), 0, 'nothing to throw');
});

test('the same link at the same instant always performs the same way', () => {
  const m = link({ u: 0.97 });
  const one = chainPoses(m, { perLink: 2, t: 0.37, seed: 5 });
  const two = chainPoses(m, { perLink: 2, t: 0.37, seed: 5 });
  assert.deepEqual(one, two);
});
