// Grants: the quartermaster's rulebook (decisions 2026-10-25 §2). A
// grant stocks the world, never the bridge; carries no physics of its
// own; and every grant is a new, frozen level variant. The granted-stock
// placement path is pinned to the V bridge's hand calculation with the
// catalog's silk, the same way the ant was pinned.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SPAN_GAP,
  ANT,
  SILK,
  GRANT_BOUNDS,
  validateGrant,
  applyGrant,
  replayGrants,
  makeBlueprint,
  addLink,
  checkLink,
  antsLeft,
  stockLeft,
  buildModel,
  findRoute,
  pointKey,
  runCrossing,
  breakingLoad,
  deepFreeze,
} from '../engine/index.js';

const g = 9.81;

// --- The rulebook --------------------------------------------------------

test('a grant the world cannot hold is refused, with the reason', () => {
  const L = SPAN_GAP;
  assert.equal(validateGrant(L, null), 'not-a-grant');
  assert.equal(validateGrant(L, { kind: 'wish', count: 1 }), 'unknown-kind');

  // cargo: a name a kid said, a mass on the level's own scale
  assert.equal(validateGrant(L, { kind: 'cargo', name: 'Slug', mass: 0.08 }), null);
  assert.equal(validateGrant(L, { kind: 'cargo', name: '', mass: 0.08 }), 'bad-name');
  assert.equal(validateGrant(L, { kind: 'cargo', name: 'x'.repeat(30), mass: 0.08 }), 'bad-name');
  assert.equal(validateGrant(L, { kind: 'cargo', name: 'Slug', mass: 0 }), 'off-the-scale');
  assert.equal(validateGrant(L, { kind: 'cargo', name: 'Slug', mass: -0.1 }), 'off-the-scale');
  assert.equal(
    validateGrant(L, { kind: 'cargo', name: 'Moose', mass: L.measure.max + 0.1 }),
    'off-the-scale',
  );

  // links: the jar grows, to a cap
  assert.equal(validateGrant(L, { kind: 'links', count: GRANT_BOUNDS.jarMax - L.jar }), null);
  assert.equal(validateGrant(L, { kind: 'links', count: GRANT_BOUNDS.jarMax - L.jar + 1 }), 'jar-full');
  assert.equal(validateGrant(L, { kind: 'links', count: 0 }), 'bad-count');
  assert.equal(validateGrant(L, { kind: 'links', count: 1.5 }), 'bad-count');

  // stock: catalog materials only, never the level's own
  assert.equal(validateGrant(L, { kind: 'stock', material: 'wood', count: 5 }), null);
  assert.equal(validateGrant(L, { kind: 'stock', material: 'ant', count: 5 }), 'unknown-material');
  assert.equal(validateGrant(L, { kind: 'stock', material: 'granite', count: 5 }), 'unknown-material');
  assert.equal(
    validateGrant(L, { kind: 'stock', material: 'silk', count: GRANT_BOUNDS.stockMax + 1 }),
    'stock-full',
  );

  // anchor: real ground, inside the world, not ground twice
  assert.equal(validateGrant(L, { kind: 'anchor', points: [[5, -3]] }), null);
  assert.equal(validateGrant(L, { kind: 'anchor', points: [] }), 'bad-points');
  assert.equal(validateGrant(L, { kind: 'anchor', points: [[5, 9]] }), 'bad-points');
  assert.equal(validateGrant(L, { kind: 'anchor', points: [[0, 0]] }), 'already-ground');
  assert.equal(
    validateGrant(L, { kind: 'anchor', points: [[5, -3], [5, -3]] }),
    'already-ground',
  );
});

test('a grant makes a new frozen level: new id, same base, recorded in order', () => {
  const slug = { kind: 'cargo', name: 'Slug', mass: 0.08 };
  const v1 = applyGrant(SPAN_GAP, slug);
  assert.equal(v1.base, 'span-gap');
  assert.notEqual(v1.id, SPAN_GAP.id);
  assert.deepEqual(v1.grants, [slug]);
  assert.deepEqual(v1.cargo, [...SPAN_GAP.cargo, 0.08].sort((a, b) => a - b));
  assert.deepEqual(v1.grantedCargo, [{ name: 'Slug', mass: 0.08 }]);
  assert.throws(() => {
    v1.jar = 999;
  }, TypeError);
  assert.deepEqual(SPAN_GAP.cargo, [0.02, 0.05, 0.1, 0.2], 'the base archetype never moves');

  const v2 = applyGrant(v1, { kind: 'links', count: 10 });
  assert.equal(v2.jar, SPAN_GAP.jar + 10);
  assert.notEqual(v2.id, v1.id);
  assert.equal(v2.base, 'span-gap');

  const v3 = applyGrant(v2, { kind: 'stock', material: 'silk', count: 4 });
  assert.deepEqual(v3.stock, { silk: 4 });
  const v4 = applyGrant(v3, { kind: 'anchor', points: [[5, -3]] });
  assert.equal(v4.anchors.length, SPAN_GAP.anchors.length + 1);

  assert.throws(() => applyGrant(SPAN_GAP, { kind: 'cargo', name: 'Moose', mass: 9 }), /refused/);
});

test('anchor grants share one cap across the whole grant list', () => {
  let level = SPAN_GAP;
  for (let k = 0; k < GRANT_BOUNDS.anchorsMax; k++) {
    level = applyGrant(level, { kind: 'anchor', points: [[k + 1, -3]] });
  }
  assert.equal(validateGrant(level, { kind: 'anchor', points: [[9, -2]] }), 'anchors-full');
});

test('replay rebuilds the same variant from the list alone, and trusts nothing else', () => {
  const grants = [
    { kind: 'cargo', name: 'Slug', mass: 0.08 },
    { kind: 'stock', material: 'wood', count: 5 },
  ];
  const a = replayGrants('span-gap', grants);
  const b = replayGrants('span-gap', grants);
  assert.equal(a.id, b.id, 'the same grants always make the same level');
  assert.deepEqual(a.stock, { wood: 5 });
  assert.throws(() => replayGrants('made-up-level', grants), /unknown base/);
  assert.throws(
    () => replayGrants('span-gap', [{ kind: 'links', count: 99 }]),
    /refused: jar-full/,
  );
});

// --- Granted stock on the blueprint --------------------------------------

test('stock links spend the stock, ant links spend the jar, one link per pair', () => {
  const L = applyGrant(SPAN_GAP, { kind: 'stock', material: 'wood', count: 2 });
  const bp = makeBlueprint();

  assert.equal(addLink(L, bp, [0, 0], [1, 0], 'wood'), null);
  assert.equal(stockLeft(L, bp, 'wood'), 1);
  assert.equal(antsLeft(L, bp), L.jar, 'wood never drains the jar');

  assert.equal(addLink(L, bp, [1, 0], [2, 0]), null);
  assert.equal(antsLeft(L, bp), L.jar - 1);
  assert.equal(stockLeft(L, bp, 'wood'), 1, 'an ant never drains the stock');

  assert.equal(checkLink(L, bp, [1, 0], [2, 0], 'wood'), 'already-placed');
  assert.equal(addLink(L, bp, [2, 0], [3, 0], 'wood'), null);
  assert.equal(checkLink(L, bp, [3, 0], [4, 0], 'wood'), 'no-stock');
  assert.equal(checkLink(L, bp, [3, 0], [4, 0], 'silk'), 'unknown-material', 'no silk was granted');
  assert.equal(checkLink(SPAN_GAP, makeBlueprint(), [0, 0], [1, 0], 'wood'), 'unknown-material');

  // The copy keeps the material; the model resolves it from the catalog.
  const copy = makeBlueprint(bp.links);
  assert.deepEqual(copy.links, bp.links);
  const { memberOf } = buildModel(L, copy);
  const wood = memberOf.get('0,0|1,0');
  const ant = memberOf.get('1,0|2,0');
  assert.equal(wood.material.name, 'wood');
  assert.equal(wood.mass, 0, 'the catalog gives wood no creature mass yet');
  assert.equal(ant.material, L.material);
  assert.equal(ant.mass, ANT.mass);
});

// --- The hand calculation, through granted silk ---------------------------
//
// The same V rig as test/measure.test.js, built through the blueprint
// out of granted silk: two links meeting one step down, banks two steps
// apart. At the grip limit the arms stretch, that sets the angle, and
// the angle sets the critical cargo: W = 2·Tmax·sinθ. Silk is massless
// in the catalog, so the hand number carries no creature-weight term.

test('a granted silk V bridge breaks where the silk hand calculation says', () => {
  const mini = deepFreeze({
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
    cargo: [0.05],
    measure: { quantity: 'breaking-load', max: 0.6, resolution: 0.005 },
  });
  const L = applyGrant(mini, { kind: 'stock', material: 'silk', count: 2 });
  const bp = makeBlueprint();
  assert.equal(addLink(L, bp, [0, 0], [1, -1], 'silk'), null);
  assert.equal(addLink(L, bp, [1, -1], [2, 0], 'silk'), null);

  const Tmax = SILK.tensionLimit;
  const span = Math.hypot(0.1, 0.1) * (1 + Tmax / SILK.axialStiffness);
  const sinTheta = Math.sqrt(span * span - 0.01) / span;
  const critical = (2 * Tmax * sinTheta) / g;

  const { mass, maxed } = breakingLoad((cargoMass) => {
    const route = findRoute(L, bp);
    const { model, nodeOf } = buildModel(L, bp);
    return (
      runCrossing(model, {
        route: route.map((p) => nodeOf.get(pointKey(p))),
        cargoMass,
        dryY: L.dryY,
      }).outcome === 'holds'
    );
  }, L.measure);

  assert.equal(maxed, false);
  assert.ok(
    Math.abs(mass - critical) <= L.measure.resolution,
    `measured ${mass} kg vs analytic ${critical} kg`,
  );
});
