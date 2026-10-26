// The layers, enforced by reading the import lines. The engine reaches
// only itself, so nothing outside it can get at the physics; a skin is
// data and imports no code at all, so it can't so much as reach the
// engine to tamper; the portal builds on the engine, never on the game.
// And nothing anywhere loads a package: zero runtime dependencies.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

const root = new URL('..', import.meta.url);

// Every module specifier in a folder's files: static imports and
// re-exports, and any dynamic import at all.
function specifiers(dir) {
  const out = [];
  for (const file of readdirSync(new URL(`${dir}/`, root)).filter((f) => f.endsWith('.js'))) {
    const src = readFileSync(new URL(`${dir}/${file}`, root), 'utf8');
    for (const m of src.matchAll(/(?:^|\n)\s*(?:import|export)\s*(?:[\w$*{}\s,]+?\s*from\s*)?['"]([^'"]+)['"]/g)) {
      out.push([`${dir}/${file}`, m[1]]);
    }
    for (const m of src.matchAll(/\bimport\(/g)) out.push([`${dir}/${file}`, `dynamic import at ${m.index}`]);
  }
  return out;
}

const breaks = (dir, allowed) => specifiers(dir).filter(([, s]) => !allowed(s));

test('the engine imports only the engine', () => {
  assert.ok(specifiers('engine').length > 10, 'the reader found the engine’s imports');
  assert.deepEqual(breaks('engine', (s) => /^\.\/[\w-]+\.js$/.test(s)), []);
});

test('a skin imports no code: the starters are only data, gathered by their index', () => {
  const found = specifiers('skins');
  assert.deepEqual(found.map(([file]) => file).sort(), ['skins/index.js', 'skins/index.js', 'skins/index.js']);
  assert.deepEqual(breaks('skins', (s) => /^\.\/[\w-]+\.js$/.test(s)), []);
});

test('the portal builds on the engine and itself, never on the game', () => {
  assert.deepEqual(breaks('portal', (s) => /^\.\/[\w-]+\.js$/.test(s) || /^\.\.\/engine\/[\w-]+\.js$/.test(s)), []);
});

test('no package anywhere: the game reaches the engine, skins and portal; only the server uses Node', () => {
  const relative = (s) => /^\.\.?\/[\w./-]+\.js$/.test(s) && !/^\.\.\/(demo|test)\//.test(s);
  assert.deepEqual(breaks('demo', (s) => relative(s) || /^node:/.test(s)).length, 0);
  const node = specifiers('demo').filter(([, s]) => /^node:/.test(s)).map(([file]) => file);
  assert.deepEqual([...new Set(node)], ['demo/serve.js']);
});

test('the systems pack reaches only itself and the engine’s freeze; a system is data and imports nothing', () => {
  assert.ok(specifiers('systems').length >= 6, 'the reader found the pack’s imports');
  assert.deepEqual(breaks('systems', (s) => /^\.\/([\w-]+\/)?[\w-]+\.js$/.test(s) || s === '../engine/freeze.js'), []);
  const found = specifiers('systems/library');
  assert.ok(found.every(([file]) => file === 'systems/library/index.js'), 'only the index imports: the systems themselves are data');
  assert.deepEqual(breaks('systems/library', (s) => /^\.\/[\w-]+\.js$/.test(s)), []);
});
