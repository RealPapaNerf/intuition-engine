// The coaches' library (decisions 2026-10-25, the fixture library §2):
// built once, normalized, deduped by shape, searched by a kid's words,
// placed at an offset, and never trusted off disk.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { makeFixtureLibrary, checkEntry, normalize } from '../coach/library.js';
import { SPAN_GAP, validateGrant } from '../engine/index.js';

const TREE = {
  name: 'Bent tree',
  tags: ['tree', 'branch', 'wood'],
  members: [
    { a: [3, -3], b: [3, -2], mat: 'wood' }, // trunk from the bed
    { a: [3, -2], b: [4, -1], mat: 'wood' }, // a branch leaning out
  ],
  roots: [[3, -3]],
};

function tempLib() {
  const dir = mkdtempSync(join(tmpdir(), 'fixtures-'));
  return { dir, lib: makeFixtureLibrary({ dir }) };
}

test('saving normalizes to the fixture’s own frame and dedupes by shape', () => {
  const { dir, lib } = tempLib();
  try {
    const e = lib.save({ ...TREE, author: 'Pia' });
    assert.match(e.id, /^bent-tree-[0-9a-f]{6}$/);
    assert.deepEqual(e.members[0], { a: [0, 0], b: [0, 1], mat: 'wood' }, 'origin at min i, min j');
    assert.deepEqual(e.roots, [[0, 0]]);
    assert.equal(e.author, 'Pia');

    // The same shape shifted and renamed is the same work, not a new file.
    const again = lib.save({
      ...TREE,
      name: 'Crooked tree',
      members: TREE.members.map((m) => ({ a: [m.a[0] + 2, m.a[1] + 1], b: [m.b[0] + 2, m.b[1] + 1], mat: m.mat })),
      roots: [[5, -2]],
    });
    assert.equal(again.id, e.id);
    assert.equal(readdirSync(dir).length, 1);

    assert.throws(() => lib.save({ ...TREE, members: [] }), /refused/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('search speaks the kid’s words; place makes a concrete grant the level accepts', () => {
  const { dir, lib } = tempLib();
  try {
    lib.save(TREE);
    lib.save({
      name: 'River piling',
      tags: ['post', 'pile', 'wood'],
      members: [{ a: [0, 0], b: [0, 1], mat: 'wood' }],
      roots: [[0, 0]],
    });
    assert.equal(lib.search('is there a tree with branches?')[0].name, 'Bent tree');
    assert.equal(lib.search('a post to stand on')[0].name, 'River piling');
    assert.deepEqual(lib.search('a pelican'), [], 'nothing matching, nothing offered');

    const id = lib.search('tree')[0].id;
    const grant = lib.place(id, [3, -3]); // roots back onto the bed
    assert.equal(grant.kind, 'fixture');
    assert.deepEqual(grant.roots, [[3, -3]]);
    assert.equal(validateGrant(SPAN_GAP, grant), null, 'the placed copy passes the real gate');
    assert.equal(
      validateGrant(SPAN_GAP, lib.place(id, [3, -1])),
      'not-ground',
      'a bad offset fails the same gate',
    );
    assert.equal(lib.place('no-such-thing', [0, 0]), null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the library survives a restart and never trusts a file', () => {
  const { dir, lib } = tempLib();
  try {
    const e = lib.save(TREE);
    writeFileSync(join(dir, 'junk.json'), '{not json');
    writeFileSync(
      join(dir, 'evil.json'),
      JSON.stringify({
        id: 'evil-000000',
        name: 'Gift',
        tags: [],
        // a two-step member the solver would never resolve a joint for
        members: [{ a: [0, 0], b: [0, 2], mat: 'wood' }],
        roots: [[0, 0]],
      }),
    );
    const again = makeFixtureLibrary({ dir });
    assert.deepEqual(
      again.list().map((x) => x.id),
      [e.id],
      'the good entry loads; the corrupt and the cheat are skipped',
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('checkEntry and normalize hold the door on shapes alone', () => {
  assert.equal(checkEntry(normalize(TREE)), null);
  assert.equal(checkEntry({ ...TREE, members: [{ a: [0, 0], b: [2, 0], mat: 'wood' }] }), 'not-one-step');
  assert.equal(checkEntry({ ...TREE, roots: [[9, 9]] }), 'bad-roots');
  assert.equal(
    checkEntry({ ...TREE, members: [{ a: [0, 0], b: [0, 1], mat: 'lava' }] }),
    'bad-members',
  );
});
