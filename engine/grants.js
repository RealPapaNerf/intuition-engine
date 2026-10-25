// Grants: the coach's quartermaster verb (decisions 2026-10-25 §2).
//
// A grant stocks the world at the kid's request — a new creature to
// carry, more links for the jar, a stash of catalog material, ground to
// anchor to. It never touches the bridge and never carries physics: the
// only honest number a grant may hold is a cargo mass, clamped to the
// level's own scale, and materials resolve only through the catalog.
//
// Every grant makes a new level — a variant: the base archetype plus an
// ordered grant list, deep-frozen, with its own id. Journal entries
// carry the variant id, so calibration, seen setups, and the Museum
// never mix levels that differ (2026-10-22 §4: more ants is a different
// level, not a different skin).
//
// The same validation runs in the browser and on the demo server; the
// server replays the grant list from scratch (replayGrants) rather than
// trusting any level object a client sends.

import { deepFreeze } from './freeze.js';
import { MATERIALS } from './materials.js';
import { SPAN_GAP } from './archetypes.js';
import { inBounds, isAnchor } from './blueprint.js';

// The levels a grant chain may start from, by id.
export const BASES = Object.freeze({ [SPAN_GAP.id]: SPAN_GAP });

// Bounds, REVISIT with Stage 0 data: generous enough for play, tight
// enough that a variant is still the same game.
export const GRANT_BOUNDS = Object.freeze({
  jarMax: 60, // links, granted jar growth included
  stockMax: 20, // per granted material
  anchorsMax: 8, // grid points added across all anchor grants
  cargoMax: 12, // granted creatures
  nameLength: 24,
  fixturesMax: 6, // composed world objects per level
  fixtureMembersMax: 40, // members per fixture
  tagsMax: 8, // library tags per fixture
});

const NAME = /^[\p{L}\p{N}][\p{L}\p{N} '-]*$/u;

const goodName = (name) =>
  typeof name === 'string' && name.length <= GRANT_BOUNDS.nameLength && NAME.test(name);

const key = (p) => `${p[0]},${p[1]}`;

const gridPair = (p) =>
  Array.isArray(p) && p.length === 2 && Number.isInteger(p[0]) && Number.isInteger(p[1]);

// A fixture (decisions 2026-10-25, the fixture library §1 as amended by
// free items §1): a named, composed OBJECT — one connected shape of
// grid-adjacent members in catalog materials. It does not have to reach
// the ground: support is physics' job (rest it on a bank, tie it with
// ants, or it falls). Roots exist only when the kid asked for something
// planted, and a root must be driven into real ground. Why it can't be
// granted, or null if it can.
export function validateFixture(level, fx) {
  if (!fx || typeof fx !== 'object') return 'not-a-fixture';
  if (!goodName(fx.name)) return 'bad-name';
  if ((level.fixtures?.length ?? 0) >= GRANT_BOUNDS.fixturesMax) return 'fixtures-full';
  const tags = fx.tags ?? [];
  if (!Array.isArray(tags) || tags.length > GRANT_BOUNDS.tagsMax || !tags.every(goodName)) {
    return 'bad-tags';
  }
  const { members, roots } = fx;
  if (!Array.isArray(members) || members.length < 1 || members.length > GRANT_BOUNDS.fixtureMembersMax) {
    return 'bad-members';
  }
  const taken = new Set(
    (level.fixtures ?? []).flatMap((f) => f.members.map((m) => pairKey(m.a, m.b))),
  );
  const endpoints = new Set();
  for (const m of members) {
    if (!m || !gridPair(m.a) || !gridPair(m.b)) return 'bad-members';
    if (!inBounds(level, m.a) || !inBounds(level, m.b)) return 'out-of-bounds';
    const di = Math.abs(m.a[0] - m.b[0]);
    const dj = Math.abs(m.a[1] - m.b[1]);
    if ((di === 0 && dj === 0) || di > 1 || dj > 1) return 'not-one-step';
    if (!(m.mat in MATERIALS)) return 'unknown-material';
    const k = pairKey(m.a, m.b);
    if (taken.has(k)) return 'already-built';
    taken.add(k);
    endpoints.add(key(m.a)).add(key(m.b));
  }
  // Roots are planting, and planting is an ask: optional, each a point
  // of the fixture itself, driven into real ground (the bed row or an
  // existing anchor). Whether an UNrooted fixture stays up is never
  // checked here — the solver answers that when the scaffold comes away.
  if (!Array.isArray(roots)) return 'bad-roots';
  for (const p of roots) {
    if (!gridPair(p) || !endpoints.has(key(p))) return 'bad-roots';
    if (p[1] !== level.bounds.jMin && !isAnchor(level, p)) return 'not-ground';
  }
  // One object, one connected shape: scattered pieces are separate asks.
  const joined = new Set([key(members[0].a)]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const m of members) {
      const ka = key(m.a);
      const kb = key(m.b);
      if (joined.has(ka) !== joined.has(kb)) {
        joined.add(ka);
        joined.add(kb);
        grew = true;
      }
    }
  }
  if (![...endpoints].every((p) => joined.has(p))) return 'in-pieces';
  return null;
}

function pairKey(a, b) {
  return a[0] < b[0] || (a[0] === b[0] && a[1] < b[1])
    ? `${key(a)}|${key(b)}`
    : `${key(b)}|${key(a)}`;
}

function grantedAnchors(level) {
  return (level.grants ?? []).reduce(
    (n, g) => n + (g.kind === 'anchor' ? g.points.length : 0),
    0,
  );
}

function snapToGrid(mass, { resolution }) {
  return Math.round(mass / resolution) * resolution;
}

// Why this grant can't be given, or null if it can. The reasons are the
// whole quartermaster rulebook.
export function validateGrant(level, grant) {
  if (!grant || typeof grant !== 'object') return 'not-a-grant';
  switch (grant.kind) {
    case 'cargo': {
      const { name, mass } = grant;
      if (typeof name !== 'string' || name.length > GRANT_BOUNDS.nameLength || !NAME.test(name)) {
        return 'bad-name';
      }
      if ((level.grantedCargo?.length ?? 0) >= GRANT_BOUNDS.cargoMax) return 'cargo-full';
      const snapped = Number.isFinite(mass) ? snapToGrid(mass, level.measure) : 0;
      if (!(snapped > 0) || snapped > level.measure.max) return 'off-the-scale';
      return null;
    }
    case 'links': {
      const { count } = grant;
      if (!Number.isInteger(count) || count < 1) return 'bad-count';
      if (level.jar + count > GRANT_BOUNDS.jarMax) return 'jar-full';
      return null;
    }
    case 'stock': {
      const { material, count } = grant;
      if (!(material in MATERIALS) || material === level.material.name) return 'unknown-material';
      if (!Number.isInteger(count) || count < 1) return 'bad-count';
      if ((level.stock?.[material] ?? 0) + count > GRANT_BOUNDS.stockMax) return 'stock-full';
      return null;
    }
    case 'fixture':
      return validateFixture(level, grant);
    case 'anchor': {
      const { points } = grant;
      if (!Array.isArray(points) || points.length < 1) return 'bad-points';
      if (grantedAnchors(level) + points.length > GRANT_BOUNDS.anchorsMax) return 'anchors-full';
      const seen = new Set();
      for (const p of points) {
        if (!Array.isArray(p) || p.length !== 2 || !inBounds(level, p)) return 'bad-points';
        const key = `${p[0]},${p[1]}`;
        if (seen.has(key) || isAnchor(level, p)) return 'already-ground';
        seen.add(key);
      }
      return null;
    }
    default:
      return 'unknown-kind';
  }
}

function fnv(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

// The grant, applied: a new frozen level. Throws on an invalid grant —
// validate first; the demo asks, the server insists.
export function applyGrant(level, grant) {
  const why = validateGrant(level, grant);
  if (why) throw new Error(`grant refused: ${why}`);
  const grants = [...(level.grants ?? []), grant];
  const base = level.base ?? level.id;
  const variant = {
    ...level,
    base,
    id: `${base}~${fnv(JSON.stringify(grants))}`,
    grants,
  };
  if (grant.kind === 'cargo') {
    const mass = snapToGrid(grant.mass, level.measure);
    variant.cargo = [...level.cargo, mass].sort((a, b) => a - b);
    variant.grantedCargo = [...(level.grantedCargo ?? []), { name: grant.name, mass }];
  } else if (grant.kind === 'links') {
    variant.jar = level.jar + grant.count;
  } else if (grant.kind === 'stock') {
    variant.stock = {
      ...(level.stock ?? {}),
      [grant.material]: (level.stock?.[grant.material] ?? 0) + grant.count,
    };
  } else if (grant.kind === 'anchor') {
    variant.anchors = [...level.anchors, ...grant.points.map((p) => [...p])];
  } else if (grant.kind === 'fixture') {
    variant.fixtures = [
      ...(level.fixtures ?? []),
      {
        name: grant.name,
        members: grant.members.map((m) => ({ a: [...m.a], b: [...m.b], mat: m.mat })),
        roots: grant.roots.map((p) => [...p]),
      },
    ];
    const fresh = grant.roots.filter((p) => !isAnchor(level, p));
    if (fresh.length > 0) {
      variant.anchors = [...level.anchors, ...fresh.map((p) => [...p])];
    }
  }
  return deepFreeze(variant);
}

// Replay a grant list onto its base — the server's only way to a level
// (decisions 2026-10-25 §3: a client's level object is never taken on
// faith). Throws when the base is unknown or any grant fails.
export function replayGrants(baseId, grants = []) {
  let level = BASES[baseId];
  if (!level) throw new Error(`unknown base level: ${baseId}`);
  for (const grant of grants) level = applyGrant(level, grant);
  return level;
}
