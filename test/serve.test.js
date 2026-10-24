// The demo server's door to Poly Pizza: its own copy of the allowlist,
// tested through a real local server with a stand-in upstream.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { makeHandler, FILE_LIMIT } from '../demo/serve.js';

const root = fileURLToPath(new URL('..', import.meta.url));
let server;
let base;
let upstream = () => ({ status: 404 });
const calls = [];

async function fakeFetch(url, init = {}) {
  calls.push({ url, headers: init.headers ?? {} });
  const r = upstream(url);
  const res = new Response(r.body ?? '', { status: r.status ?? 200, headers: r.headers ?? {} });
  Object.defineProperty(res, 'url', { value: r.finalUrl ?? url });
  return res;
}

before(async () => {
  server = createServer(makeHandler({ root, fetch: fakeFetch }));
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

const get = (path, headers = {}) => fetch(`${base}${path}`, { headers });

test('search goes to Poly Pizza’s v1.1 API with the key, and only known parameters', async () => {
  calls.length = 0;
  upstream = () => ({ body: JSON.stringify({ results: [], total: 0 }), headers: { 'content-type': 'application/json' } });
  const r = await get('/library/polypizza/search/tree%20frog?limit=5&admin=1', { 'x-auth-token': 'k3y' });
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { results: [], total: 0 });
  assert.equal(calls[0].url, 'https://api.poly.pizza/v1.1/search/tree%20frog?limit=5');
  assert.deepEqual(calls[0].headers, { 'X-Auth-Token': 'k3y' });
  assert.equal((await get('/library/polypizza/search/frog')).status, 401, 'no key, no search');
  assert.equal((await get('/library/polypizza/search/%2E%2E%2Fadmin', { 'x-auth-token': 'k' })).status, 404);
});

test('files come only from static.poly.pizza — even after a redirect — and never too big', async () => {
  upstream = () => ({ body: 'glTF…', headers: { 'content-type': 'model/gltf-binary' } });
  const ok = await get(`/library/polypizza/file?url=${encodeURIComponent('https://static.poly.pizza/a.glb')}`);
  assert.equal(ok.status, 200);
  assert.equal(await ok.text(), 'glTF…');
  for (const bad of [
    'https://evil.example/a.glb',
    'http://static.poly.pizza/a.glb',
    'https://static.poly.pizza.evil.example/a.glb',
    'https://user@static.poly.pizza/a.glb',
  ]) {
    assert.equal((await get(`/library/polypizza/file?url=${encodeURIComponent(bad)}`)).status, 403, bad);
  }
  upstream = () => ({ body: 'x', finalUrl: 'https://evil.example/a.glb' });
  assert.equal((await get(`/library/polypizza/file?url=${encodeURIComponent('https://static.poly.pizza/a.glb')}`)).status, 403);
  upstream = () => ({ body: 'x', headers: { 'content-length': String(FILE_LIMIT + 1) } });
  assert.equal((await get(`/library/polypizza/file?url=${encodeURIComponent('https://static.poly.pizza/a.glb')}`)).status, 413);
});

test('nothing else gets through the door; the static files still serve, and only from inside', async () => {
  assert.equal((await get('/library/sketchy/search/frog')).status, 404);
  assert.equal((await fetch(`${base}/library/polypizza/search/frog`, { method: 'POST' })).status, 405);
  const page = await get('/demo/index.html');
  assert.equal(page.status, 200);
  assert.match(page.headers.get('content-type'), /text\/html/);
  assert.equal((await get('/..%2f..%2fetc/passwd')).status, 404);
});
