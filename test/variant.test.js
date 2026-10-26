// The demo's side of a variant (demo/variant.js): the cargo ladder's
// costume map and who moves aside for an incoming fixture. The map's
// one hard requirement is that it reproduces applyGrant's own ordering
// — a costume that lines up one rung off would dress the wrong
// creature, which is exactly the kind of thing a kid notices.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SPAN_GAP,
  applyGrant,
  makeBlueprint,
  addLink,
  buildModel,
  findRoute,
  linkKey,
  pointKey,
  crossingCases,
  shedSteps,
} from '../engine/index.js';
import {
  cargoDress,
  cargoIndexOf,
  collidingLinks,
  shedRemovable,
  worldMembers,
} from '../demo/variant.js';

test('the base level dresses every cargo from the skin, in order', () => {
  const dress = cargoDress(SPAN_GAP, SPAN_GAP);
  assert.deepEqual(
    dress,
    SPAN_GAP.cargo.map((mass, costume) => ({ mass, costume, name: null })),
  );
});

test('a granted creature lands where the engine put it, and wears no costume', () => {
  // 0.02, 0.05, 0.1, 0.2 kg: a 120 g slug sorts between 0.1 and 0.2.
  const L = applyGrant(SPAN_GAP, { kind: 'cargo', name: 'Slug', mass: 0.12 });
  const dress = cargoDress(L, SPAN_GAP);
  assert.deepEqual(
    dress.map((d) => d.mass),
    [...L.cargo],
    'the dress lists exactly the level’s own cargo, in the level’s own order',
  );
  const slug = dress.find((d) => d.name === 'Slug');
  assert.equal(slug.mass, 0.12);
  assert.equal(slug.costume, null, 'granted cargo renders generically');
  // The base rungs keep their own pictures, shifted or not.
  for (const d of dress.filter((x) => x.name === null)) {
    assert.equal(SPAN_GAP.cargo[d.costume], d.mass);
  }
});

test('a granted creature of a base cargo’s exact weight sorts after it', () => {
  const L = applyGrant(SPAN_GAP, { kind: 'cargo', name: 'Twin', mass: 0.05 });
  const dress = cargoDress(L, SPAN_GAP);
  assert.deepEqual(
    dress.map((d) => d.mass),
    [...L.cargo],
  );
  const at = dress.findIndex((d) => d.name === 'Twin');
  assert.equal(dress[at - 1].mass, 0.05);
  assert.equal(dress[at - 1].costume, 1, 'the base 50 g frog keeps its picture');
});

test('several granted creatures all land on the engine’s ladder', () => {
  let L = SPAN_GAP;
  for (const [name, mass] of [['Slug', 0.12], ['Monkey', 0.4], ['Beetle', 0.03]]) {
    L = applyGrant(L, { kind: 'cargo', name, mass });
  }
  const dress = cargoDress(L, SPAN_GAP);
  assert.deepEqual(
    dress.map((d) => d.mass),
    [...L.cargo],
  );
  assert.deepEqual(
    dress.filter((d) => d.name).map((d) => d.name),
    ['Beetle', 'Slug', 'Monkey'],
    'granted creatures sit at their own weights, not in the order they were asked for',
  );
});

test('the kid keeps looking at the creature they were looking at', () => {
  const was = SPAN_GAP.cargo[2]; // 0.1 kg
  const L = applyGrant(SPAN_GAP, { kind: 'cargo', name: 'Beetle', mass: 0.03 });
  assert.equal(cargoIndexOf(L, was), 3, 'the 100 g rung moved up one when a lighter one joined');
  assert.equal(L.cargo[cargoIndexOf(L, was)], was);
  assert.equal(cargoIndexOf(SPAN_GAP, 999), SPAN_GAP.cargo.length - 1, 'off the top: the top rung');
});

test('an incoming fixture names the links that have to move aside', () => {
  const bp = makeBlueprint();
  addLink(SPAN_GAP, bp, [0, 0], [1, 0]);
  addLink(SPAN_GAP, bp, [1, 0], [2, 0]);
  addLink(SPAN_GAP, bp, [2, 0], [3, 0]);
  const members = [
    { a: [2, 0], b: [1, 0], mat: 'wood' }, // the same link, drawn the other way
    { a: [5, 0], b: [6, 0], mat: 'wood' }, // nobody there
  ];
  const hit = collidingLinks(bp, members);
  assert.equal(hit.length, 1);
  assert.deepEqual(hit[0].slice(0, 2), [[1, 0], [2, 0]]);
  assert.deepEqual(collidingLinks(bp, []), [], 'a grant with no members moves nobody');
});

// --- The world is not the kid's to shed (fixture library §4.8) -------------

test('the lazy colony never sends the world home', () => {
  // A plank lying between two bank points, and a kid's line of ants
  // across the gap with a few that carry nothing.
  const L = applyGrant(SPAN_GAP, {
    kind: 'fixture',
    name: 'Plank',
    tags: [],
    roots: [],
    members: [
      { a: [0, 1], b: [1, 1], mat: 'wood' },
      { a: [1, 1], b: [0, 0], mat: 'wood' },
    ],
  });
  const bp = makeBlueprint();
  for (let i = 0; i < 10; i++) addLink(L, bp, [i, 0], [i + 1, 0]);
  addLink(L, bp, [2, 0], [3, 1]); // a lazy pair, holding nothing
  addLink(L, bp, [3, 1], [4, 0]);

  const built = buildModel(L, bp);
  const world = worldMembers(built);
  assert.equal(world.size, 2, 'both plank members are the world’s');

  const route = findRoute(L, bp);
  const walkway = new Set();
  for (let k = 0; k < route.length - 1; k++) {
    walkway.add(built.memberOf.get(linkKey(route[k], route[k + 1])));
  }
  const removable = shedRemovable(built, walkway);
  for (const m of world) assert.equal(removable(m), false, 'the world is never removable');
  for (const m of walkway) assert.equal(removable(m), false, 'the walkway is never removable');
  const lazy = built.memberOf.get(linkKey([2, 0], [3, 1]));
  assert.equal(removable(lazy), true, 'a link holding nothing still is');
});

test('a shed run on a granted world frees only the kid’s own idle links', () => {
  const L = applyGrant(SPAN_GAP, {
    kind: 'fixture',
    name: 'Plank',
    tags: [],
    roots: [],
    members: [{ a: [0, 1], b: [1, 1], mat: 'wood' }],
  });
  const bp = makeBlueprint();
  for (let i = 0; i < 10; i++) addLink(L, bp, [i, 0], [i + 1, 0]);
  addLink(L, bp, [1, 1], [2, 0]); // hangs off the world, carries nothing

  const built = buildModel(L, bp);
  const route = findRoute(L, bp);
  const walkway = new Set();
  for (let k = 0; k < route.length - 1; k++) {
    walkway.add(built.memberOf.get(linkKey(route[k], route[k + 1])));
  }
  const world = worldMembers(built);
  const cases = crossingCases(
    route.map((p) => built.nodeOf.get(pointKey(p))),
    L.cargo[0],
    { dryY: L.dryY },
  );
  const freed = [];
  const steps = shedSteps(built.model, {
    removable: shedRemovable(built, walkway),
    ...cases,
    settleOpts: { maxSteps: 30000 },
  });
  for (;;) {
    const { done, value } = steps.next();
    if (done) break;
    if (value.removed) freed.push(value.removed);
  }
  for (const m of freed) assert.equal(world.has(m), false, 'no world member was ever freed');
  assert.equal(built.model.members.filter((m) => world.has(m) && m.broken).length, 0);
});
