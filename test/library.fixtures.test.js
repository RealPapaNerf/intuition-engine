// The coaches' library (decisions 2026-10-25, the fixture library §2):
// built once, normalized, deduped by shape, searched by a kid's words,
// placed at an offset, and never trusted off disk.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { gitPublisher, makeFixtureLibrary, checkEntry, normalize } from '../coach/library.js';
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

test('the pending shelf: held builds wait for the adult, off the shelf and off git', () => {
  const { dir, lib } = tempLib();
  try {
    const held = lib.pend({ ...TREE, author: 'Pia' });
    assert.equal(lib.list().length, 0, 'a held build is never on the shelf');
    assert.equal(lib.search('tree').length, 0, 'and never offered to a coach');
    assert.deepEqual(
      lib.pending().map((e) => [e.name, e.author]),
      [['Bent tree', 'Pia']],
    );
    assert.deepEqual(readdirSync(join(dir, 'pending')), [`${held.id}.json`]);

    // Pending twice is held once; a shape already published is not held.
    lib.pend({ ...TREE, name: 'Bent tree' });
    assert.equal(lib.pending().length, 1);

    // Approve publishes it, credited as it was; reject would delete it.
    const saved = lib.approve(held.id);
    assert.equal(saved.name, 'Bent tree');
    assert.equal(saved.author, 'Pia');
    assert.equal(lib.pending().length, 0);
    assert.equal(lib.search('tree').length, 1, 'approved means on the shelf');
    assert.equal(readdirSync(join(dir, 'pending')).length, 0);
    assert.equal(lib.approve('nope'), null);

    const other = lib.pend({ ...TREE, name: 'Odd totem', members: [{ a: [5, 0], b: [5, 1], mat: 'wood' }], roots: [] });
    assert.equal(lib.reject(other.id), true);
    assert.equal(lib.pending().length, 0);
    assert.equal(lib.reject(other.id), false);

    // A restart finds the held builds where they were left.
    const again = makeFixtureLibrary({ dir });
    lib.pend({ ...TREE, name: 'Totem two', members: [{ a: [5, 0], b: [6, 0], mat: 'wood' }], roots: [] });
    const third = makeFixtureLibrary({ dir });
    assert.equal(third.pending().length, 1);
    assert.equal(again.list().length, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a save calls the publish hook with the one file; a pend never does', () => {
  const { dir, lib: plain } = tempLib();
  const published = [];
  const lib = makeFixtureLibrary({ dir, publish: (file, entry) => published.push([file, entry.name]) });
  try {
    const saved = lib.save({ ...TREE, author: 'Pia' });
    assert.deepEqual(published, [[join(dir, `${saved.id}.json`), 'Bent tree']]);
    lib.save({ ...TREE, name: 'Same tree' }); // deduped: nothing new to publish
    assert.equal(published.length, 1);
    lib.pend({ ...TREE, name: 'Odd totem', members: [{ a: [5, 0], b: [5, 1], mat: 'wood' }], roots: [] });
    assert.equal(published.length, 1, 'a held build is never pushed');

    // A hook that throws never fails the save.
    const angry = makeFixtureLibrary({
      dir,
      publish: () => {
        throw new Error('no remote');
      },
    });
    const ok = angry.save({ ...TREE, name: 'Totem two', members: [{ a: [5, 0], b: [6, 0], mat: 'wood' }], roots: [] });
    assert.ok(ok.id);
  } finally {
    void plain;
    rmSync(dir, { recursive: true, force: true });
  }
});

test('gitPublisher commits and pushes the one file — never a dirty tree', async () => {
  const remote = mkdtempSync(join(tmpdir(), 'lib-remote-'));
  const repo = mkdtempSync(join(tmpdir(), 'lib-repo-'));
  const git = (...args) => execFileSync('git', ['-C', repo, ...args], { stdio: 'pipe' });
  try {
    execFileSync('git', ['init', '-q', '--bare', remote], { stdio: 'pipe' });
    execFileSync('git', ['clone', '-q', remote, repo], { stdio: 'pipe' });
    git('config', 'user.email', 'test@test');
    git('config', 'user.name', 'test');
    writeFileSync(join(repo, 'README'), 'hello\n');
    git('add', 'README');
    git('commit', '-q', '-m', 'first');
    git('push', '-q', '-u', 'origin', 'HEAD');

    // Another session's dirty file, which must never be swept up.
    writeFileSync(join(repo, 'someone-elses.txt'), 'untouchable\n');

    // No hook on the library here: save() fires it without waiting, so
    // the test drives the publisher itself, once, and awaits it.
    const lib = makeFixtureLibrary({ dir: join(repo, 'fixtures') });
    const saved = lib.save({ ...TREE, author: 'Pia' });
    await gitPublisher(repo)(join(repo, 'fixtures', `${saved.id}.json`), saved);

    const subject = git('log', '-1', '--pretty=%s').toString().trim();
    assert.equal(subject, 'fixture library: Bent tree (built with Pia)');
    const touched = git('show', '--name-only', '--pretty=format:', 'HEAD').toString().trim();
    assert.equal(touched, `fixtures/${saved.id}.json`, 'one file, nothing else');
    const status = git('status', '--porcelain').toString();
    assert.ok(status.includes('someone-elses.txt'), 'the dirty file is left alone');
    assert.ok(!status.includes('fixtures/'), 'the fixture is committed, not loose');
    const pushed = execFileSync('git', ['-C', remote, 'log', '-1', '--pretty=%s'], { stdio: 'pipe' })
      .toString()
      .trim();
    assert.equal(pushed, 'fixture library: Bent tree (built with Pia)', 'and it reached the remote');
  } finally {
    rmSync(remote, { recursive: true, force: true });
    rmSync(repo, { recursive: true, force: true });
  }
});
