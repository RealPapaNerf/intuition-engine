// The coaches' library (decisions 2026-10-25, the fixture library §2):
// composed world objects, built once by any coach, searchable and
// grabbable by every coach after — so a tree, a dam, an arch is never
// rebuilt token by token. Plain JSON files, one fixture per file, under
// fixtures/ in the repo; committing them is a human act.
//
// Entries are position-independent: coordinates normalized to the
// fixture's own frame (min i, min j at 0,0); a grant places a copy at an
// offset, and engine/grants.js re-validates the placed result against
// the live level — bounds, ground, floating and all. Stored files are
// never trusted: each is shape-checked on read, and a corrupt or edited
// one is skipped, never fatal (the saved-costume rule).

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { MATERIALS } from '../engine/materials.js';
import { GRANT_BOUNDS } from '../engine/grants.js';

const NAME = /^[\p{L}\p{N}][\p{L}\p{N} '-]{0,23}$/u;
const ID = /^[a-z0-9-]{1,64}$/;

function fnv(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

const gridPair = (p) =>
  Array.isArray(p) && p.length === 2 && Number.isInteger(p[0]) && Number.isInteger(p[1]);
const key = (p) => `${p[0]},${p[1]}`;
const pairKey = (a, b) =>
  a[0] < b[0] || (a[0] === b[0] && a[1] < b[1]) ? `${key(a)}|${key(b)}` : `${key(b)}|${key(a)}`;

// The level-free checks: shape, adjacency, catalog, no duplicates, roots
// among the endpoints. Ground and bounds are the level's business and
// are re-checked at grant time by engine/grants.js.
export function checkEntry(e) {
  if (!e || typeof e !== 'object') return 'not-an-entry';
  if (typeof e.name !== 'string' || !NAME.test(e.name)) return 'bad-name';
  const tags = e.tags ?? [];
  if (!Array.isArray(tags) || tags.length > GRANT_BOUNDS.tagsMax || !tags.every((t) => typeof t === 'string' && NAME.test(t))) {
    return 'bad-tags';
  }
  const { members, roots } = e;
  if (!Array.isArray(members) || members.length < 1 || members.length > GRANT_BOUNDS.fixtureMembersMax) {
    return 'bad-members';
  }
  const taken = new Set();
  const endpoints = new Set();
  for (const m of members) {
    if (!m || !gridPair(m.a) || !gridPair(m.b) || !(m.mat in MATERIALS)) return 'bad-members';
    const di = Math.abs(m.a[0] - m.b[0]);
    const dj = Math.abs(m.a[1] - m.b[1]);
    if ((di === 0 && dj === 0) || di > 1 || dj > 1) return 'not-one-step';
    const k = pairKey(m.a, m.b);
    if (taken.has(k)) return 'bad-members';
    taken.add(k);
    endpoints.add(key(m.a)).add(key(m.b));
  }
  if (!Array.isArray(roots) || !roots.every((p) => gridPair(p) && endpoints.has(key(p)))) {
    return 'bad-roots';
  }
  return null;
}

// Into the fixture's own frame: min i, min j at the origin.
export function normalize({ name, tags = [], members, roots }) {
  const points = members.flatMap((m) => [m.a, m.b]);
  const i0 = Math.min(...points.map((p) => p[0]));
  const j0 = Math.min(...points.map((p) => p[1]));
  const shift = (p) => [p[0] - i0, p[1] - j0];
  return {
    name,
    tags,
    members: members.map((m) => ({ a: shift(m.a), b: shift(m.b), mat: m.mat })),
    roots: roots.map(shift),
  };
}

export function makeFixtureLibrary({ dir }) {
  const entries = new Map(); // id → entry

  function load() {
    entries.clear();
    let files = [];
    try {
      files = readdirSync(dir).filter((f) => f.endsWith('.json'));
    } catch {
      return; // no library yet
    }
    for (const f of files) {
      try {
        const e = JSON.parse(readFileSync(join(dir, f), 'utf8'));
        if (ID.test(e.id ?? '') && checkEntry(e) === null && !entries.has(e.id)) {
          entries.set(e.id, e);
        }
      } catch {
        /* a bad file is skipped, never fatal */
      }
    }
  }
  load();

  // Save a built fixture, normalized, with the asking kid credited. The
  // same shape under a different name is still the same work: dedupe by
  // the members' own geometry.
  function save({ name, tags = [], members, roots, author = null }) {
    const entry = normalize({ name, tags, members, roots });
    const why = checkEntry(entry);
    if (why) throw new Error(`library refused: ${why}`);
    const body = fnv(JSON.stringify({ members: entry.members, roots: entry.roots }));
    const existing = [...entries.values()].find((e) => e.body === body);
    if (existing) return existing;
    const id = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${body.slice(0, 6)}`;
    const full = { id, body, ...entry, author, at: new Date().toISOString().slice(0, 10) };
    entries.set(id, full);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, `${id}.json`), `${JSON.stringify(full, null, 2)}\n`);
    return full;
  }

  // Search by the kid's own words: token overlap on name and tags,
  // newest first on ties.
  function search(q, limit = 5) {
    const tokens = String(q ?? '')
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((t) => t.length > 1);
    const scored = [...entries.values()].map((e) => {
      const words = [e.name, ...(e.tags ?? [])].join(' ').toLowerCase();
      const score = tokens.filter((t) => words.includes(t)).length;
      return { e, score };
    });
    return scored
      .filter((s) => s.score > 0)
      .sort((x, y) => y.score - x.score || String(y.e.at).localeCompare(String(x.e.at)))
      .slice(0, limit)
      .map((s) => s.e);
  }

  // A concrete fixture at an offset — what actually enters the grant
  // list, so replay never reads the library.
  function place(id, at = [0, 0]) {
    const e = entries.get(id);
    if (!e || !gridPair(at)) return null;
    const shift = (p) => [p[0] + at[0], p[1] + at[1]];
    return {
      kind: 'fixture',
      name: e.name,
      members: e.members.map((m) => ({ a: shift(m.a), b: shift(m.b), mat: m.mat })),
      roots: e.roots.map(shift),
    };
  }

  function list() {
    return [...entries.values()].map(({ id, name, tags, author, at }) => ({ id, name, tags, author, at }));
  }

  return { save, search, place, list, load };
}
