// Tiny static server so the demo's ES-module imports work (browsers block
// module imports over file://), and the costume portal's one door to a
// library that doesn't promise to answer browsers directly: Poly Pizza.
// The door keeps its own copy of the allowlist (portal/library.js):
// fixed upstream paths, files only from the library's own host — after
// any redirect, too — and a size cap. No dependencies: `npm run demo`.
//
// Since 2026-10-25 it is also the coach's door to Claude (coach/service.js
// — the key stays in ANTHROPIC_API_KEY here, capped per kid per day) and
// the educator's window (coach/educator.js — the demo posts journal
// entries, the educator's page reads attempts and adult-only flags).
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeCoach } from '../coach/service.js';
import { makeEducatorLog } from '../coach/educator.js';
import { gitPublisher, makeFixtureLibrary } from '../coach/library.js';
import { BASES, GRANT_BOUNDS } from '../engine/grants.js';
import { MATERIALS } from '../engine/materials.js';

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

const BODY_LIMIT = 64 * 1024;

async function readJson(req) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.byteLength;
    if (total > BODY_LIMIT) return null;
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    return null;
  }
}

const sendJson = (res, status, value) =>
  send(res, status, JSON.stringify(value), 'application/json');

// POST /coach/ask · GET /coach/fixtures[?q=] · POST /educator/log ·
// GET /educator/kids · GET /educator/flags[/<kid>] ·
// GET /educator/attempts/<kid> · GET /educator/pending ·
// POST /educator/approve · POST /educator/reject
async function adults(req, res, url, { coach, educator, library }) {
  // The pending shelf: builds the coach doubted, waiting for an adult
  // (grant freely §2). Approve publishes, reject deletes.
  if (url.pathname === '/educator/approve' || url.pathname === '/educator/reject') {
    if (req.method !== 'POST') return send(res, 405, 'POST only');
    const body = await readJson(req);
    if (!body || typeof body.id !== 'string') return send(res, 400, 'needs { id }');
    if (url.pathname === '/educator/approve') {
      const saved = library.approve(body.id);
      return saved ? sendJson(res, 200, saved) : send(res, 404, 'not pending');
    }
    return library.reject(body.id) ? sendJson(res, 200, { gone: true }) : send(res, 404, 'not pending');
  }
  if (url.pathname === '/coach/ask') {
    if (req.method !== 'POST') return send(res, 405, 'POST only');
    const body = await readJson(req);
    if (!body) return send(res, 400, 'a small JSON body is needed');
    return sendJson(res, 200, await coach.ask(body));
  }
  if (url.pathname === '/coach/fixtures') {
    if (req.method !== 'GET') return send(res, 405, 'GET only');
    const q = url.searchParams.get('q');
    return sendJson(res, 200, q ? library.search(q, 20) : library.list());
  }
  // "What exists in the forest?" — the grant vocabulary and the catalog.
  // Free, like the library list: world knowledge never costs an ask
  // (free items §5).
  if (url.pathname === '/coach/forest') {
    if (req.method !== 'GET') return send(res, 405, 'GET only');
    return sendJson(res, 200, {
      grants: ['cargo', 'links', 'stock', 'anchor', 'fixture'],
      materials: Object.keys(MATERIALS),
      bases: Object.keys(BASES),
      bounds: GRANT_BOUNDS,
    });
  }
  if (url.pathname === '/educator/log') {
    if (req.method !== 'POST') return send(res, 405, 'POST only');
    const body = await readJson(req);
    if (!body || typeof body.kid !== 'string') return send(res, 400, 'needs { kid, entries }');
    try {
      return sendJson(res, 200, educator.log(body.kid, body.entries));
    } catch (e) {
      return send(res, 400, e.message);
    }
  }
  if (req.method !== 'GET') return send(res, 405, 'GET only');
  if (url.pathname === '/educator/pending') return sendJson(res, 200, library.pending());
  if (url.pathname === '/educator/kids') return sendJson(res, 200, educator.kids());
  if (url.pathname === '/educator/flags') return sendJson(res, 200, educator.allFlags());
  const flagsOf = url.pathname.match(/^\/educator\/flags\/([^/]+)$/);
  if (flagsOf) return sendJson(res, 200, educator.flags(decodeURIComponent(flagsOf[1])));
  const attemptsOf = url.pathname.match(/^\/educator\/attempts\/([^/]+)$/);
  if (attemptsOf) return sendJson(res, 200, educator.attempts(decodeURIComponent(attemptsOf[1])));
  return send(res, 404, 'not a route');
}

export function makeHandler({
  root,
  fetch: fetchFn = globalThis.fetch,
  // Saved fixtures auto-publish: one file committed and pushed, nothing
  // else (grant freely §1). Held builds stay local on fixtures/pending/.
  library = makeFixtureLibrary({ dir: join(root, 'fixtures'), publish: gitPublisher(root) }),
  educator = makeEducatorLog({ dir: join(root, 'demo/.educator-log') }),
  coach = makeCoach({ fetch: fetchFn, library, educator }),
} = {}) {
  return async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname.startsWith('/coach/') || url.pathname.startsWith('/educator/')) {
      try {
        return await adults(req, res, url, { coach, educator, library });
      } catch {
        return send(res, 500, 'that went wrong on the server');
      }
    }
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
    console.log('Frog bridge demo:  http://localhost:8123/demo/index.html');
    console.log('Costume portal:    http://localhost:8123/demo/portal.html');
    console.log('Educator’s window: http://localhost:8123/demo/educator.html');
    console.log(
      process.env.ANTHROPIC_API_KEY
        ? 'The coach is in (ANTHROPIC_API_KEY is set), capped per kid per day.'
        : 'The coach is out: set ANTHROPIC_API_KEY to let it in. The game plays fine without it.',
    );
  });
}
