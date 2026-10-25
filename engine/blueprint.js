// The blueprint: what the kid built, as plain data — which links sit
// between which grid points. It is kept apart from the simulated model,
// so every test starts from the as-built, unstressed bridge and the kid
// can keep editing the design between tests. It serializes as JSON.
//
// One link is one creature (one ant) between neighboring grid points:
// across, up, or diagonal. That keeps every joint a grid point the solver
// resolves, so the cargo's weight always lands where the physics can
// carry it — a single "ant" spanning the whole gap would be an exploit,
// not a bridge. Counting ants is counting links, and the jar is the
// budget.
//
// Points are [i, j] grid pairs (see archetypes.js); a blueprint is
// { links: [[p, q], ...] }. A link may carry a third element — a
// material name from the catalog — when the level granted stock of it
// (decisions 2026-10-25 §2): untagged links are the level's base
// material, budgeted by the jar; tagged links spend the stock. One link
// per point pair, whatever it is made of.

import { makeModel, addNode, addMember } from './model.js';
import { MATERIALS } from './materials.js';

export function pointKey(p) {
  return `${p[0]},${p[1]}`;
}

function before(p, q) {
  return p[0] < q[0] || (p[0] === q[0] && p[1] < q[1]);
}

// Canonical: the same link has one key whichever end it was drawn from.
export function linkKey(p, q) {
  return before(p, q)
    ? `${pointKey(p)}|${pointKey(q)}`
    : `${pointKey(q)}|${pointKey(p)}`;
}

export function makeBlueprint(links = []) {
  return {
    links: links.map(([p, q, mat]) => (mat ? [[...p], [...q], mat] : [[...p], [...q]])),
  };
}

export function isAnchor(level, p) {
  return level.anchors.some((a) => a[0] === p[0] && a[1] === p[1]);
}

export function inBounds(level, p) {
  const { iMin, iMax, jMin, jMax } = level.bounds;
  return (
    Number.isInteger(p[0]) &&
    Number.isInteger(p[1]) &&
    p[0] >= iMin &&
    p[0] <= iMax &&
    p[1] >= jMin &&
    p[1] <= jMax
  );
}

export function antsLeft(level, bp) {
  return level.jar - bp.links.filter(([, , mat]) => !mat).length;
}

// Stock left of a granted material (decisions 2026-10-25 §2). A level
// with no stock of that name has none to spend.
export function stockLeft(level, bp, name) {
  const granted = level.stock?.[name] ?? 0;
  return granted - bp.links.filter(([, , mat]) => mat === name).length;
}

export function hasLink(bp, p, q) {
  const k = linkKey(p, q);
  return bp.links.some(([a, b]) => linkKey(a, b) === k);
}

// A joint exists where a placed link ends.
export function isJoint(bp, p) {
  return bp.links.some(
    ([a, b]) =>
      (a[0] === p[0] && a[1] === p[1]) || (b[0] === p[0] && b[1] === p[1]),
  );
}

// Something to hold onto: an anchor, or a joint already in the bridge.
export function isHeld(level, bp, p) {
  return isAnchor(level, p) || isJoint(bp, p);
}

// Why this link can't be placed, or null if it can. The reasons are the
// whole placement rulebook. `mat` names granted stock; omitted means the
// level's base material, paid from the jar.
export function checkLink(level, bp, p, q, mat = null) {
  if (!inBounds(level, p) || !inBounds(level, q)) return 'out-of-bounds';
  const di = Math.abs(p[0] - q[0]);
  const dj = Math.abs(p[1] - q[1]);
  if (di === 0 && dj === 0) return 'same-point';
  if (di > 1 || dj > 1) return 'too-far'; // an ant reaches one point over
  if (isAnchor(level, p) && isAnchor(level, q)) return 'both-anchored';
  if (hasLink(bp, p, q)) return 'already-placed';
  if (!isHeld(level, bp, p) && !isHeld(level, bp, q)) return 'nothing-to-hold';
  if (mat !== null) {
    if (!(mat in MATERIALS) || !(level.stock?.[mat] > 0)) return 'unknown-material';
    if (stockLeft(level, bp, mat) <= 0) return 'no-stock';
  } else if (antsLeft(level, bp) <= 0) {
    return 'jar-empty';
  }
  return null;
}

export function addLink(level, bp, p, q, mat = null) {
  const reason = checkLink(level, bp, p, q, mat);
  if (reason === null) bp.links.push(mat ? [[...p], [...q], mat] : [[...p], [...q]]);
  return reason;
}

export function removeLink(bp, p, q) {
  const k = linkKey(p, q);
  const i = bp.links.findIndex(([a, b]) => linkKey(a, b) === k);
  if (i < 0) return false;
  bp.links.splice(i, 1);
  return true;
}

// Links with no path to any anchor. Placing never makes one (checkLink
// wants a held end), but removing a link can strand a piece.
export function looseLinks(level, bp) {
  const held = new Set(level.anchors.map(pointKey));
  let grew = true;
  while (grew) {
    grew = false;
    for (const [a, b] of bp.links) {
      const ka = pointKey(a);
      const kb = pointKey(b);
      if (held.has(ka) !== held.has(kb)) {
        held.add(ka);
        held.add(kb);
        grew = true;
      }
    }
  }
  return bp.links.filter(([a]) => !held.has(pointKey(a)));
}

// Ants with nothing to hold walk back to the jar: removes the stranded
// links and returns them. Call after any removal, so a blueprint never
// holds a piece that would only fall.
export function pruneLoose(level, bp) {
  const loose = looseLinks(level, bp);
  for (const [p, q] of loose) removeLink(bp, p, q);
  return loose;
}

// The simulated model, as built: every link an unstressed member of its
// material — the level's, or the named stock, resolved only through the
// catalog — carrying one creature's mass, anchors fixed, joints with no
// point mass of their own (the ants are the weight).
export function buildModel(level, bp) {
  const model = makeModel();
  const nodeOf = new Map();
  const memberOf = new Map();
  const node = (p) => {
    const k = pointKey(p);
    if (!nodeOf.has(k)) {
      nodeOf.set(
        k,
        addNode(model, {
          x: p[0] * level.step,
          y: p[1] * level.step,
          mass: 0,
          fixed: isAnchor(level, p),
        }),
      );
    }
    return nodeOf.get(k);
  };
  for (const [p, q, mat] of bp.links) {
    const material = mat ? MATERIALS[mat] : level.material;
    const m = addMember(model, node(p), node(q), material);
    m.mass = material.mass ?? 0;
    memberOf.set(linkKey(p, q), m);
  }
  return { model, nodeOf, memberOf };
}

// The cargo's route from level.start to level.end over placed links: the
// shortest walk, and of equally short walks the one that stays highest
// (a frog would rather stay dry), then furthest along. Lengths are kept
// as exact integers (1000 per straight step, 1414 per diagonal), so two
// walks tie exactly when they really are the same length.
//
// Removing links that are not on the route never changes the route: the
// route stays a shortest walk, and the choices at each step only shrink.
// That is what lets the shed hand back a lean bridge the cargo walks the
// same way.
export function findRoute(level, bp) {
  const adj = new Map();
  const link = (a, b) => {
    const k = pointKey(a);
    if (!adj.has(k)) adj.set(k, []);
    const cost = a[0] !== b[0] && a[1] !== b[1] ? 1414 : 1000;
    adj.get(k).push({ to: b, cost });
  };
  for (const [p, q] of bp.links) {
    link(p, q);
    link(q, p);
  }

  // Distance to the end, by Dijkstra (the graphs are tiny: a plain scan
  // for the nearest unsettled point is fine).
  const endKey = pointKey(level.end);
  const dist = new Map([[endKey, 0]]);
  const done = new Set();
  for (;;) {
    let best = null;
    for (const [k, d] of dist) {
      if (!done.has(k) && (best === null || d < dist.get(best))) best = k;
    }
    if (best === null) break;
    done.add(best);
    for (const { to, cost } of adj.get(best) ?? []) {
      const k = pointKey(to);
      const d = dist.get(best) + cost;
      if (!dist.has(k) || d < dist.get(k)) dist.set(k, d);
    }
  }

  const startKey = pointKey(level.start);
  if (!dist.has(startKey)) return null;

  // Walk forward, always to a neighbor on a shortest walk; highest first.
  const route = [level.start];
  let here = startKey;
  while (here !== endKey) {
    let next = null;
    for (const { to, cost } of adj.get(here)) {
      const k = pointKey(to);
      if (!dist.has(k) || dist.get(here) !== cost + dist.get(k)) continue;
      if (
        next === null ||
        to[1] > next[1] ||
        (to[1] === next[1] && to[0] > next[0])
      ) {
        next = to;
      }
    }
    route.push(next);
    here = pointKey(next);
  }
  return route;
}
