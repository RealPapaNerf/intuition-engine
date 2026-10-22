// Tiny static server so the demo's ES-module imports work (browsers block
// module imports over file://), and the costume portal's one door to a
// library that doesn't promise to answer browsers directly: Poly Pizza.
// The door keeps its own copy of the allowlist (portal/library.js):
// fixed upstream paths, files only from the library's own host — after
// any redirect, too — and a size cap. No dependencies: `npm run demo`.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const types = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.md': 'text/plain',
  '.json': 'application/json',
};

const POLY = {
  api: 'https://api.poly.pizza/v1.1',
  files: new Set(['static.poly.pizza']),
  params: new Set(['limit', 'page', 'category']),
};
export const FILE_LIMIT = 48 * 1024 * 1024;
const WORD = /^[\p{L}\p{N} '_-]{1,40}$/u;
const ID = /^[A-Za-z0-9_-]{1,64}$/;

function send(res, status, body, type = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'content-type': type });
  res.end(body);
}

const fromApi = (href) => href.startsWith(`${POLY.api}/`);
function fromFiles(href) {
  try {
    const u = new URL(href);
    return u.protocol === 'https:' && POLY.files.has(u.hostname) && !u.username && !u.password;
  } catch {
    return false;
  }
}

async function readCapped(response, limit) {
  if (Number(response.headers.get('content-length') ?? 0) > limit) return null;
  const chunks = [];
  let total = 0;
  for await (const chunk of response.body ?? []) {
    total += chunk.byteLength;
    if (total > limit) return null;
    chunks.push(chunk);
  }
  return Buffer.concat(chunks.map((c) => Buffer.from(c)));
}

async function polyPizza(req, res, url, fetchFn) {
  const rest = url.pathname.slice('/library/polypizza/'.length);
  if (rest === 'file') {
    const target = url.searchParams.get('url') ?? '';
    if (!fromFiles(target)) return send(res, 403, 'that file is not on the allowlist');
    const r = await fetchFn(target);
    if (!fromFiles(r.url || target)) return send(res, 403, 'the library sent that file from somewhere else');
    if (!r.ok) return send(res, 502, `the library answered ${r.status}`);
    const body = await readCapped(r, FILE_LIMIT);
    if (!body) return send(res, 413, 'that file is too big to import');
    return send(res, 200, body, r.headers.get('content-type') ?? 'application/octet-stream');
  }

  const [kind, ...parts] = rest.split('/');
  const arg = decodeURIComponent(parts.join('/'));
  let upstream;
  if (kind === 'search' && WORD.test(arg)) upstream = `${POLY.api}/search/${encodeURIComponent(arg)}`;
  else if (kind === 'model' && ID.test(arg)) upstream = `${POLY.api}/model/${arg}`;
  else return send(res, 404, 'not a library route');
  const query = new URLSearchParams();
  for (const [k, v] of url.searchParams) {
    if (POLY.params.has(k) && /^[\w-]{1,32}$/.test(v)) query.set(k, v);
  }
  const key = req.headers['x-auth-token'];
  if (!key) return send(res, 401, 'a Poly Pizza key is needed');
  const target = `${upstream}${[...query].length ? `?${query}` : ''}`;
  const r = await fetchFn(target, { headers: { 'X-Auth-Token': String(key) } });
  if (!fromApi(r.url || target)) return send(res, 403, 'the library answered from somewhere else');
  const body = await readCapped(r, 4 * 1024 * 1024);
  if (!body) return send(res, 502, 'the library sent too much');
  return send(res, r.status, body, r.headers.get('content-type') ?? 'application/json');
}

export function makeHandler({ root, fetch: fetchFn = globalThis.fetch } = {}) {
  return async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname.startsWith('/library/')) {
      if (req.method !== 'GET') return send(res, 405, 'GET only');
      if (!url.pathname.startsWith('/library/polypizza/')) return send(res, 404, 'not a library route');
      try {
        return await polyPizza(req, res, url, fetchFn);
      } catch {
        return send(res, 502, 'couldn’t reach Poly Pizza');
      }
    }
    try {
      const path = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
      const file = join(root, path === '/' ? '/demo/index.html' : path);
      if (!file.startsWith(root)) throw new Error('outside');
      const body = await readFile(file);
      res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' });
      res.end(body);
    } catch {
      send(res, 404, 'not found');
    }
  };
}

const root = fileURLToPath(new URL('..', import.meta.url));
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  createServer(makeHandler({ root })).listen(8123, () => {
    console.log('Frog bridge demo: http://localhost:8123/demo/index.html');
    console.log('Costume portal:   http://localhost:8123/demo/portal.html');
  });
}
