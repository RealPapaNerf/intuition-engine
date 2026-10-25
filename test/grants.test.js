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
  WOOD,
  SILK,
  GRANT_BOUNDS,
  validateGrant,
  applyGrant,
  replayGrants,
  makeBlueprint,
  addLink,
  checkLink,
  isHeld,
  antsLeft,
  stockLeft,
  looseLinks,
  fixtureLinks,
  buildModel,
  findRoute,
  pointKey,
  runCrossing,
  breakingLoad,
  deepFreeze,
  step,
  settle,
  checkBreaks,
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
  assert.equal(wood.mass, WOOD.mass, 'placed wood weighs its catalog mass — free bodies must fall');
  assert.equal(ant.material, L.material);
  assert.equal(ant.mass, ANT.mass);
});

// --- Fixtures: built things in the world -----------------------------------

const PILING = {
  kind: 'fixture',
  name: 'River piling',
  members: [
    { a: [5, -3], b: [5, -2], mat: 'wood' },
    { a: [5, -2], b: [5, -1], mat: 'wood' },
    { a: [5, -1], b: [5, 0], mat: 'wood' },
  ],
  roots: [[5, -3]],
};

test('a fixture the world cannot hold is refused, with the reason', () => {
  const L = SPAN_GAP;
  assert.equal(validateGrant(L, PILING), null);
  const fx = (over) => validateGrant(L, { ...PILING, ...over });

  assert.equal(fx({ name: '' }), 'bad-name');
  assert.equal(fx({ tags: ['ok', ''] }), 'bad-tags');
  assert.equal(fx({ members: [] }), 'bad-members');
  assert.equal(
    fx({ members: [{ a: [5, -3], b: [5, -1], mat: 'wood' }], roots: [[5, -3]] }),
    'not-one-step',
  );
  assert.equal(
    fx({ members: [{ a: [5, -3], b: [5, -2], mat: 'granite' }], roots: [[5, -3]] }),
    'unknown-material',
  );
  assert.equal(
    fx({ members: [{ a: [5, 9], b: [5, 8], mat: 'wood' }], roots: [] }),
    'out-of-bounds',
  );
  // Planting is an ask, and roots go into real ground: neither the bed
  // row nor an anchor refuses.
  assert.equal(
    fx({ members: [{ a: [5, -1], b: [5, 0], mat: 'wood' }], roots: [[5, -1]] }),
    'not-ground',
  );
  // A root must be a point of the fixture itself.
  assert.equal(
    fx({ members: [{ a: [5, -3], b: [5, -2], mat: 'wood' }], roots: [[6, -3]] }),
    'bad-roots',
  );
  // An object needn't touch the ground (free items §1): whether an
  // untied branch stays up is the solver's verdict, not this gate's.
  assert.equal(
    fx({ members: [{ a: [5, 1], b: [6, 1], mat: 'wood' }], roots: [] }),
    null,
    'a loose branch in the air is a valid grant',
  );
  // But one grant is one object: scattered pieces are separate asks.
  assert.equal(
    fx({
      members: [
        { a: [5, -3], b: [5, -2], mat: 'wood' },
        { a: [7, 0], b: [8, 0], mat: 'wood' },
      ],
      roots: [[5, -3]],
    }),
    'in-pieces',
  );
});

test('fixtures join the world: anchored roots, held joints, walked routes, world members', () => {
  const L = applyGrant(SPAN_GAP, PILING);
  assert.equal(L.fixtures.length, 1);
  assert.ok(L.anchors.some(([i, j]) => i === 5 && j === -3), 'the root became ground');
  assert.throws(() => {
    L.fixtures[0].members[0].mat = 'silk';
  }, TypeError);

  // The same pair can't be built twice, by a second fixture or the kid.
  assert.equal(validateGrant(L, PILING), 'already-built');
  const bp = makeBlueprint();
  assert.equal(checkLink(L, bp, [5, -1], [5, 0]), 'already-placed');

  // Ants can grab the granted piling and hang from it honestly.
  assert.equal(isHeld(L, bp, [5, 0]), true, 'a fixture joint is something to hold');
  assert.equal(addLink(L, bp, [5, 0], [6, 0]), null);
  assert.equal(antsLeft(L, bp), L.jar - 1, 'holding the world still spends the jar');
  assert.deepEqual(looseLinks(L, bp), [], 'held through the fixture, not loose');

  // A granted footbridge is walked like anything else: route with no
  // kid links at all, and its members simulate as real catalog wood.
  const deck = {
    kind: 'fixture',
    name: 'Old footbridge',
    members: Array.from({ length: 10 }, (_, i) => ({ a: [i, 0], b: [i + 1, 0], mat: 'wood' })),
    roots: [],
  };
  const walked = applyGrant(SPAN_GAP, deck);
  const route = findRoute(walked, makeBlueprint());
  assert.ok(route, 'the cargo can cross on the world alone');
  assert.equal(route.length, 11);
  const { memberOf, worldKeys } = buildModel(walked, makeBlueprint());
  assert.equal(worldKeys.size, 10, 'world members are marked for the shed to spare');
  assert.equal(memberOf.get('0,0|1,0').material, WOOD);

  assert.equal(fixtureLinks(SPAN_GAP).length, 0, 'the base archetype has no fixtures');
});

test('fixtures stop at the cap — which is solver sanity, not behavior', () => {
  let L = SPAN_GAP;
  for (let k = 0; k < GRANT_BOUNDS.fixturesMax; k++) {
    // Distinct one-member objects, no roots: floating is allowed, and
    // crowding the scene is protected play (questions §3).
    const i = 1 + (k % 9);
    const jb = -3 + Math.floor(k / 9);
    L = applyGrant(L, {
      kind: 'fixture',
      name: `Piling ${k + 1}`,
      members: [{ a: [i, jb], b: [i, jb + 1], mat: 'wood' }],
      roots: [],
    });
  }
  assert.equal(
    validateGrant(L, {
      kind: 'fixture',
      name: 'One too many',
      members: [{ a: [10, -3], b: [10, -2], mat: 'wood' }],
      roots: [],
    }),
    'fixtures-full',
  );
});

test('the problem introduces itself in canned words that ride every variant', () => {
  assert.equal(typeof SPAN_GAP.intro, 'string');
  assert.ok(SPAN_GAP.intro.length > 0, 'the base carries its own introduction');
  const variant = applyGrant(SPAN_GAP, { kind: 'links', count: 5 });
  assert.equal(variant.intro, SPAN_GAP.intro, 'the intro rides every variant');
});

// --- The hand calculation, through granted silk ---------------------------
//
// The same V rig as test/measure.test.js, built through the blueprint
// out of granted silk: two links meeting one step down, banks two steps
// apart. At the grip limit the arms stretch, that sets the angle, and
// the angle sets the critical cargo: W = 2·Tmax·sinθ. Silk is massless
// in the catalog, so the hand number carries no creature-weight term.

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
  cargo: [0.05],
  measure: { quantity: 'breaking-load', max: 0.6, resolution: 0.005 },
});

// W = 2·Tmax·sinθ for the silk V, less the apex's own lumped weight
// (half of each silk arm — the same creature-mass term the ant V test
// carries).
const SILK_V_CRITICAL = (() => {
  const Tmax = SILK.tensionLimit;
  const span = Math.hypot(0.1, 0.1) * (1 + Tmax / SILK.axialStiffness);
  const sinTheta = Math.sqrt(span * span - 0.01) / span;
  return (2 * Tmax * sinTheta) / g - SILK.mass;
})();

function measuredOn(level, bp) {
  return breakingLoad((cargoMass) => {
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
}

test('a granted silk V bridge breaks where the silk hand calculation says', () => {
  const L = applyGrant(MINI, { kind: 'stock', material: 'silk', count: 2 });
  const bp = makeBlueprint();
  assert.equal(addLink(L, bp, [0, 0], [1, -1], 'silk'), null);
  assert.equal(addLink(L, bp, [1, -1], [2, 0], 'silk'), null);

  const { mass, maxed } = measuredOn(L, bp);
  assert.equal(maxed, false);
  assert.ok(
    Math.abs(mass - SILK_V_CRITICAL) <= L.measure.resolution,
    `measured ${mass} kg vs analytic ${SILK_V_CRITICAL} kg`,
  );
});

// --- The items are free, the physics is not (free items §1) ---------------

test('an untied branch falls when gravity arrives', () => {
  const L = applyGrant(MINI, {
    kind: 'fixture',
    name: 'Loose branch',
    members: [
      { a: [0, 1], b: [1, 1], mat: 'wood' },
      { a: [1, 1], b: [2, 1], mat: 'wood' },
    ],
    roots: [],
  });
  const { model, nodeOf } = buildModel(L, makeBlueprint());
  const mid = nodeOf.get('1,1');
  const y0 = mid.y;
  for (let k = 0; k < 5000; k++) step(model, 0.0008); // four seconds
  assert.ok(mid.y < y0 - 0.5, `only fell ${(y0 - mid.y).toFixed(3)} m`);
});

test('the same branch resting its ends on the banks carries the frog', () => {
  const L = applyGrant(MINI, {
    kind: 'fixture',
    name: 'Arch branch',
    members: [
      { a: [0, 0], b: [1, 1], mat: 'wood' },
      { a: [1, 1], b: [2, 0], mat: 'wood' },
    ],
    roots: [],
  });
  const route = findRoute(L, makeBlueprint());
  const { model, nodeOf } = buildModel(L, makeBlueprint());
  const c = runCrossing(model, {
    route: route.map((p) => nodeOf.get(pointKey(p))),
    cargoMass: 0.05,
    dryY: L.dryY,
  });
  assert.equal(c.outcome, 'holds', 'wood takes the squish');
});

test('a floating post held up by ants is a solution: the ants carry it', () => {
  const L = applyGrant(MINI, {
    kind: 'fixture',
    name: 'Loose post',
    members: [{ a: [1, 0], b: [1, -1], mat: 'wood' }],
    roots: [],
  });
  const bp = makeBlueprint();
  assert.equal(addLink(L, bp, [0, 0], [1, 0]), null, 'an ant from the bank to the post top');
  assert.equal(addLink(L, bp, [2, 0], [1, 0]), null, 'and one from the other bank');
  const { model, nodeOf } = buildModel(L, bp);
  const bottom = nodeOf.get('1,-1');
  const y0 = bottom.y;
  const r = settle(model, { maxSteps: 60000, dt: 0.0008 });
  assert.ok(r.settled, 'the held post comes to rest');
  assert.ok(Math.abs(bottom.y - y0) < 0.05, `the post sagged ${(y0 - bottom.y).toFixed(3)} m`);
  assert.deepEqual(checkBreaks(model), [], 'nothing snapped holding it');
});

test('the same silk V as a granted fixture measures onto the same hand number', () => {
  const L = applyGrant(MINI, {
    kind: 'fixture',
    name: 'Silk sling',
    members: [
      { a: [0, 0], b: [1, -1], mat: 'silk' },
      { a: [1, -1], b: [2, 0], mat: 'silk' },
    ],
    roots: [],
  });
  const { mass, maxed } = measuredOn(L, makeBlueprint());
  assert.equal(maxed, false);
  assert.ok(
    Math.abs(mass - SILK_V_CRITICAL) <= L.measure.resolution,
    `measured ${mass} kg vs analytic ${SILK_V_CRITICAL} kg`,
  );
});
