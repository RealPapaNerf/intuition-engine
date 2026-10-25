// The Consultant: honest truth first, curated wrongness second
// (decisions 2026-10-19 §2, 2026-10-25 §4). Deterministic per seed so
// there is no reroll-fishing; wrong about 1 in 5; every wrong claim is a
// taxonomy transform that is never the true value and is catchable by
// reasoning against reality.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ANT,
  consult,
  WRONG_RATE,
  deepFreeze,
  makeBlueprint,
  addLink,
  findRoute,
  buildModel,
  pointKey,
  runCrossing,
  breakingLoad,
} from '../engine/index.js';

// The V rig as a level the Consultant can be asked about: fast, honest,
// with a known breaking load (see test/measure.test.js).
const MINI = deepFreeze({
  id: 'mini-gap',
  material: ANT,
  jar: 10,
  step: 0.1,
  bounds: { iMin: 0, iMax: 2, jMin: -1, jMax: 1 },
  anchors: [[0, 0], [2, 0]],
  start: [0, 0],
  end: [2, 0],
  waterY: -9,
  dryY: -9,
  cargo: [0.01, 0.05, 0.5], // the middle one crosses; the big one snaps it
  measure: { quantity: 'breaking-load', max: 0.3, resolution: 0.005 },
});

function vDesign() {
  const bp = makeBlueprint();
  addLink(MINI, bp, [0, 0], [1, -1]);
  addLink(MINI, bp, [1, -1], [2, 0]);
  return bp;
}

function honestGrams(level, bp) {
  const { mass } = breakingLoad((cargoMass) => {
    const route = findRoute(level, bp);
    const { model, nodeOf } = buildModel(level, bp);
    return (
      runCrossing(model, {
        route: route.map((p) => nodeOf.get(pointKey(p))),
        cargoMass,
        dryY: level.dryY,
      }).outcome === 'holds'
    );
  }, level.measure);
  return Math.round(mass * 1000);
}

// Seeds that land on each side of the draw, found once and pinned by
// determinism: if these ever flip, the stream changed and every kid's
// advice history changed with it.
function seedWhere(wrong, { mode = 'measure', cargoIndex = 1 } = {}) {
  const bp = vDesign();
  for (let n = 0; n < 200; n++) {
    const seed = `probe:${n}`;
    const c = consult({ level: MINI, design: bp, mode, cargoIndex, seed });
    if (c.wrong === wrong) return seed;
  }
  assert.fail(`no seed found with wrong=${wrong}`);
}

test('the same seed always gets the same advice', () => {
  const bp = vDesign();
  const seed = 'kid:mini-gap:abc123:3';
  const a = consult({ level: MINI, design: bp, mode: 'measure', seed });
  const b = consult({ level: MINI, design: bp, mode: 'measure', seed });
  assert.deepEqual(a, b);
  const c = consult({ level: MINI, design: bp, mode: 'feel', cargoIndex: 1, seed });
  const d = consult({ level: MINI, design: bp, mode: 'feel', cargoIndex: 1, seed });
  assert.deepEqual(c, d);
});

test('a right measure claim is the honest reading itself', () => {
  const bp = vDesign();
  const seed = seedWhere(false);
  const c = consult({ level: MINI, design: bp, mode: 'measure', seed });
  assert.equal(c.wrong, false);
  assert.equal(c.errorType, null);
  assert.equal(c.claim, c.truth);
  assert.equal(c.truth, honestGrams(MINI, bp), 'the truth is the ladder’s own reading');
});

test('a wrong measure claim is a taxonomy transform, never the truth', () => {
  const bp = vDesign();
  let seen = 0;
  for (let n = 0; n < 200 && seen < 8; n++) {
    const c = consult({ level: MINI, design: bp, mode: 'measure', seed: `w:${n}` });
    if (!c.wrong) continue;
    seen++;
    assert.notEqual(c.claim, c.truth);
    assert.ok(c.claim > 0);
    if (c.errorType === 'magnitude') assert.equal(c.claim, c.truth * 10);
    else if (c.errorType === 'unit-slip') {
      assert.equal(c.claim, Math.round(c.truth / 10 / 5) * 5, 'slipped and on the 5 g grid');
    } else assert.fail(`unexpected transform ${c.errorType} for a carrying bridge`);
  }
  assert.ok(seen >= 3, `only ${seen} wrong draws in 200 — the rate is off`);
});

test('a bridge that carries nothing gets the limiting-case error', () => {
  const empty = makeBlueprint(); // no route at all
  const right = consult({ level: MINI, design: empty, mode: 'measure', seed: seedWhere(false) });
  assert.equal(right.truth, 0);
  assert.equal(right.claim, 0, 'the honest Consultant says what the scale says');
  for (let n = 0; n < 200; n++) {
    const c = consult({ level: MINI, design: empty, mode: 'measure', seed: `z:${n}` });
    if (!c.wrong) continue;
    assert.equal(c.errorType, 'limiting-case');
    assert.ok(c.claim > 0, 'zero structure confidently credited with a load');
    return;
  }
  assert.fail('no wrong draw in 200 seeds');
});

test('a wrong verdict argues the opposite — for the wrong cargo when one differs', () => {
  const bp = vDesign();
  for (let n = 0; n < 300; n++) {
    const c = consult({ level: MINI, design: bp, mode: 'feel', cargoIndex: 1, seed: `f:${n}` });
    assert.equal(c.truth, 'holds', 'the 50 g cargo crosses the V');
    if (!c.wrong) {
      assert.equal(c.claim, 'holds');
      continue;
    }
    assert.equal(c.claim, 'breaks');
    // The 500 g cargo really does snap it, so the curated error is the
    // answered-a-different-question kind, naming that cargo.
    assert.equal(c.errorType, 'answered-different-question');
    assert.equal(c.aboutCargoIndex, 2);
    return;
  }
  assert.fail('no wrong draw in 300 seeds');
});

test('the Consultant is wrong about 1 time in 5', () => {
  const bp = vDesign();
  let wrong = 0;
  const N = 120;
  for (let n = 0; n < N; n++) {
    if (consult({ level: MINI, design: bp, mode: 'feel', cargoIndex: 1, seed: `r:${n}` }).wrong) {
      wrong++;
    }
  }
  assert.ok(
    wrong / N > WRONG_RATE - 0.12 && wrong / N < WRONG_RATE + 0.15,
    `${wrong}/${N} wrong — far from ${WRONG_RATE}`,
  );
});
