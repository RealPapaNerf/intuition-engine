// The blueprint: the kid's design as data — placement rules, the jar,
// the model it builds, and the route the cargo walks.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SPAN_GAP,
  ANT,
  makeBlueprint,
  checkLink,
  addLink,
  removeLink,
  antsLeft,
  linkKey,
  pointKey,
  looseLinks,
  pruneLoose,
  buildModel,
  findRoute,
} from '../engine/index.js';

const L = SPAN_GAP;

function lay(bp, points, level = L) {
  for (let k = 0; k < points.length - 1; k++) {
    const why = addLink(level, bp, points[k], points[k + 1]);
    assert.equal(why, null, `${points[k]} → ${points[k + 1]}`);
  }
  return bp;
}

function row(i0, i1, j) {
  const points = [];
  for (let i = i0; i <= i1; i++) points.push([i, j]);
  return points;
}

test('placement: an ant reaches one point over and holds onto something', () => {
  const bp = makeBlueprint();
  assert.equal(checkLink(L, bp, [0, 0], [1, 0]), null, 'from the bank, across');
  assert.equal(checkLink(L, bp, [0, 0], [1, -1]), null, 'diagonal');
  assert.equal(checkLink(L, bp, [0, 0], [2, 0]), 'too-far');
  assert.equal(checkLink(L, bp, [0, 0], [0, 1]), 'both-anchored', 'bank to tree: nothing to hold up');
  assert.equal(checkLink(L, bp, [4, 0], [5, 0]), 'nothing-to-hold', 'mid-air');
  assert.equal(checkLink(L, bp, [10, 0], [11, 0]), 'out-of-bounds');
  assert.equal(checkLink(L, bp, [1, 4], [1, 3]), 'out-of-bounds');
  assert.equal(checkLink(L, bp, [3, 3], [3, 3]), 'same-point');

  addLink(L, bp, [0, 0], [1, 0]);
  assert.equal(checkLink(L, bp, [1, 0], [2, 0]), null, 'from a joint already built');
  assert.equal(checkLink(L, bp, [1, 0], [0, 0]), 'already-placed', 'same link, other end');
});

test('the jar is the budget', () => {
  const bp = makeBlueprint();
  assert.equal(antsLeft(L, bp), L.jar);
  // Zigzag back and forth along the near bank until the jar runs dry.
  let placed = 0;
  for (let j = 3; j > -3 && placed < L.jar; j--) {
    for (const [p, q] of [[[0, j], [1, j]], [[1, j], [1, j - 1]], [[0, j], [1, j - 1]], [[1, j], [0, j - 1]]]) {
      if (placed < L.jar && addLink(L, bp, p, q) === null) placed++;
    }
  }
  for (let i = 1; placed < L.jar; i++) {
    assert.equal(addLink(L, bp, [i, 0], [i + 1, 0]), null);
    placed++;
  }
  assert.equal(antsLeft(L, bp), 0);
  assert.equal(checkLink(L, bp, [10, 0], [9, -1]), 'jar-empty');
  const [p, q] = bp.links[0];
  removeLink(bp, p, q);
  assert.equal(antsLeft(L, bp), 1, 'a removed ant goes back in the jar');
});

test('a link is the same link from either end', () => {
  assert.equal(linkKey([1, 0], [2, -1]), linkKey([2, -1], [1, 0]));
  assert.notEqual(linkKey([1, 0], [2, -1]), linkKey([1, -1], [2, 0]));
  const bp = lay(makeBlueprint(), [[0, 0], [1, 0]]);
  assert.equal(removeLink(bp, [1, 0], [0, 0]), true);
  assert.equal(bp.links.length, 0);
});

test('removing a link sends stranded ants back to the jar', () => {
  const bp = lay(makeBlueprint(), row(0, 4, 0));
  lay(bp, [[2, 0], [2, -1], [3, -2]]); // a tail hanging from (2,0)
  removeLink(bp, [1, 0], [2, 0]); // cuts (2,0)…(4,0) and the tail loose
  assert.equal(looseLinks(L, bp).length, 4);
  const back = pruneLoose(L, bp);
  assert.equal(back.length, 4);
  assert.equal(bp.links.length, 1, 'only the ant still holding the bank stays');
  assert.equal(looseLinks(L, bp).length, 0);
});

test('the model as built: anchors fixed, each ant one unstressed member of one ant’s mass', () => {
  const bp = lay(makeBlueprint(), [[0, 0], [1, -1], [2, -1], [3, 0]]);
  lay(bp, [[0, 1], [1, 0], [1, -1]]); // tied up to the tall support
  const { model, nodeOf, memberOf } = buildModel(L, bp);

  assert.equal(model.members.length, bp.links.length);
  assert.equal(nodeOf.get('0,0').fixed, true);
  assert.equal(nodeOf.get('0,1').fixed, true);
  assert.equal(nodeOf.get('1,-1').fixed, false);
  for (const n of model.nodes) assert.equal(n.mass, 0, 'the ants are the weight');
  for (const m of model.members) {
    assert.equal(m.material, ANT);
    assert.equal(m.mass, ANT.mass);
    const len = Math.hypot(m.b.x - m.a.x, m.b.y - m.a.y);
    assert.ok(Math.abs(len - m.restLength) < 1e-12, 'born unstressed');
  }
  const diag = memberOf.get(linkKey([0, 0], [1, -1]));
  assert.ok(Math.abs(diag.restLength - Math.SQRT2 * L.step) < 1e-12);
});

test('the route: the shortest walk bank to bank, and of equal walks the highest', () => {
  assert.equal(findRoute(L, lay(makeBlueprint(), row(0, 5, 0))), null, 'half a bridge');

  // A deck and a loop below it: the deck is shorter, so the frog stays up.
  const bp = lay(makeBlueprint(), row(0, 10, 0));
  lay(bp, [[3, 0], [4, -1], [5, -1], [6, 0]]);
  assert.deepEqual(findRoute(L, bp), row(0, 10, 0));

  // Two walks of exactly equal length (a diamond): the frog takes the top.
  const diamond = lay(makeBlueprint(), [[0, 0], [1, 0], [2, 1], [3, 0], ...row(4, 10, 0)]);
  lay(diamond, [[1, 0], [2, -1], [3, 0]]);
  assert.deepEqual(findRoute(L, diamond).slice(0, 4), [[0, 0], [1, 0], [2, 1], [3, 0]]);
});

test('removing links off the route never changes the route (what the shed relies on)', () => {
  const roomy = { ...L, jar: 100 }; // a dense net, past this level's budget
  const bp = lay(makeBlueprint(), [[0, 0], ...row(1, 9, -1), [10, 0]], roomy);
  lay(bp, [[0, 1], ...row(1, 9, 1), [10, 1]], roomy);
  for (let i = 1; i <= 9; i++) lay(bp, [[i, 1], [i, 0], [i, -1]], roomy);
  lay(bp, [[1, 0], [2, -1]], roomy);
  const route = findRoute(L, bp);
  const onRoute = new Set();
  for (let k = 0; k < route.length - 1; k++) onRoute.add(linkKey(route[k], route[k + 1]));

  const off = bp.links.filter(([p, q]) => !onRoute.has(linkKey(p, q)));
  assert.ok(off.length > 10);
  for (const [p, q] of off) {
    removeLink(bp, p, q);
    assert.deepEqual(findRoute(L, bp), route, `after removing ${pointKey(p)}–${pointKey(q)}`);
  }
});
