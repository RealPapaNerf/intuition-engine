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
//
// Publishing (decisions 2026-10-25, grant freely): a save calls the
// publish hook — gitPublisher commits and pushes that one file, so every
// machine's coaches share one shelf. Builds the coach doubted land on
// fixtures/pending/ instead: never searched, never offered, never
// pushed, waiting for an adult to approve or reject.

import { mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { execFile } from 'node:child_process';
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
  // One object, one connected shape — same rule as the grant gate.
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

// The auto-publisher: commit and push one saved fixture file, nothing
// else — never the rest of a tree another session may have dirtied.
// Best-effort all the way down: a failed push stays a local commit and
// rides the next one; nothing here may block or fail a save.
export function gitPublisher(repoRoot) {
  const git = (args) =>
    new Promise((resolve) => {
      execFile('git', args, { cwd: repoRoot }, (err) => resolve(!err));
    });
  return async (file, entry) => {
    if (!(await git(['add', file]))) return;
    const who = entry.author ? ` (built with ${entry.author})` : '';
    if (!(await git(['commit', '-m', `fixture library: ${entry.name}${who}`, '--', file]))) return;
    await git(['push']);
  };
}

export function makeFixtureLibrary({ dir, publish = null }) {
  const entries = new Map(); // id → entry (the published shelf)
  const held = new Map(); // id → entry (fixtures/pending/, adult business)
  const pendingDir = () => join(dir, 'pending');

  function readInto(map, from) {
    let files = [];
    try {
      files = readdirSync(from).filter((f) => f.endsWith('.json'));
    } catch {
      return; // no shelf yet
    }
    for (const f of files) {
      try {
        const e = JSON.parse(readFileSync(join(from, f), 'utf8'));
        if (ID.test(e.id ?? '') && checkEntry(e) === null && !map.has(e.id)) {
          map.set(e.id, e);
        }
      } catch {
        /* a bad file is skipped, never fatal */
      }
    }
  }

  function load() {
    entries.clear();
    held.clear();
    readInto(entries, dir);
    readInto(held, pendingDir());
  }
  load();

  function asEntry({ name, tags = [], members, roots, author = null }) {
    const entry = normalize({ name, tags, members, roots });
    const why = checkEntry(entry);
    if (why) throw new Error(`library refused: ${why}`);
    const body = fnv(JSON.stringify({ members: entry.members, roots: entry.roots }));
    const id = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${body.slice(0, 6)}`;
    return { id, body, ...entry, author, at: new Date().toISOString().slice(0, 10) };
  }

  // Save a built fixture, normalized, with the asking kid credited. The
  // same shape under a different name is still the same work: dedupe by
  // the members' own geometry. A save publishes (the hook commits and
  // pushes the one file) — publication never blocks or fails the save.
  function save(raw) {
    const full = asEntry(raw);
    const existing = [...entries.values()].find((e) => e.body === full.body);
    if (existing) return existing;
    entries.set(full.id, full);
    mkdirSync(dir, { recursive: true });
    const file = join(dir, `${full.id}.json`);
    writeFileSync(file, `${JSON.stringify(full, null, 2)}\n`);
    if (publish) {
      try {
        Promise.resolve(publish(file, full)).catch(() => {});
      } catch {
        /* publishing never fails a save */
      }
    }
    return full;
  }

  // A build the coach doubted: held for an adult, never searched, never
  // offered, never pushed (grant freely §2). A shape already on either
  // shelf is not held twice.
  function pend(raw) {
    const full = asEntry(raw);
    const published = [...entries.values()].find((e) => e.body === full.body);
    if (published) return published;
    const waiting = [...held.values()].find((e) => e.body === full.body);
    if (waiting) return waiting;
    held.set(full.id, full);
    mkdirSync(pendingDir(), { recursive: true });
    writeFileSync(join(pendingDir(), `${full.id}.json`), `${JSON.stringify(full, null, 2)}\n`);
    return full;
  }

  function pending() {
    return [...held.values()].map(({ id, name, tags, author, at }) => ({ id, name, tags, author, at }));
  }

  // The adult's two verbs. Approve moves a held build onto the shelf
  // (which publishes it, credited to the kid); reject deletes it.
  function approve(id) {
    const e = held.get(id);
    if (!e) return null;
    const saved = save(e);
    held.delete(id);
    try {
      unlinkSync(join(pendingDir(), `${id}.json`));
    } catch {
      /* already gone is gone */
    }
    return saved;
  }

  function reject(id) {
    if (!held.delete(id)) return false;
    try {
      unlinkSync(join(pendingDir(), `${id}.json`));
    } catch {
      /* already gone is gone */
    }
    return true;
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

  return { save, pend, pending, approve, reject, search, place, list, load };
}
