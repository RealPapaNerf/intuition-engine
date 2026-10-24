// Where a costume's models may come from (decisions 2026-10-22 §6): an
// allowlist of Creative Commons libraries, and nothing else. There is no
// URL field anywhere. A library is code here, with fixed hosts and
// fixed paths, and a model can only be used once its license — read from
// the library's own metadata, never typed in — is one engine/manifest.js
// LICENSES accepts. The educator importing is the curation gate; this is
// the fence around what they can pick from.
//
// Every network call goes through a fetcher the caller passes in, so
// the rules here are tested without a network.

import { LICENSES, creditText as modelCreditText } from '../engine/manifest.js';

export const LIBRARIES = Object.freeze({
  polypizza: Object.freeze({
    id: 'polypizza',
    name: 'Poly Pizza',
    home: 'https://poly.pizza',
    about: 'Thousands of free low-poly models, CC0 and CC BY.',
    // A free key per person, from their account; it stays on their device.
    key: Object.freeze({ label: 'Poly Pizza API key', help: 'https://poly.pizza/settings/api' }),
  }),
  khronos: Object.freeze({
    id: 'khronos',
    name: 'glTF Sample Assets (Khronos)',
    home: 'https://github.com/KhronosGroup/glTF-Sample-Assets',
    about: 'Sample models from the makers of glTF. No key needed.',
    key: null,
  }),
});

const KHRONOS = 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models';
// Poly Pizza's API doesn't promise to answer browsers, so the portal asks
// it through demo/serve.js — which keeps its own copy of this allowlist.
export const POLY_PIZZA_DOOR = '/library/polypizza';

// The only files each library may hand over.
const FILES = {
  khronos: (u) => u.hostname === 'raw.githubusercontent.com' && u.pathname.startsWith('/KhronosGroup/glTF-Sample-Assets/'),
  polypizza: (u) => u.hostname === 'static.poly.pizza',
};

export function allowedFile(library, url) {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && !u.username && !u.password && Boolean(FILES[library]?.(u));
  } catch {
    return false;
  }
}

// --- Licenses -----------------------------------------------------------------

// A library's way of writing a license, as one of ours: { id } when it is
// accepted, { refused: why } when it isn't.
export function readLicense(text) {
  const raw = String(text ?? '').trim();
  const t = raw.toUpperCase().replace(/[\s_]+/g, '-');
  const words = t.split(/[-/]+/);
  const has = (...xs) => xs.some((x) => words.includes(x));
  if (/^(CC0|CC-0|CC-ZERO)\b/.test(t)) return { id: 'CC0-1.0' };
  if (/^(CC-?BY|CREATIVE-COMMONS-ATTRIBUTION)/.test(t)) {
    if (has('NC', 'NONCOMMERCIAL')) return { refused: `${raw} forbids commercial use` };
    if (has('ND', 'NODERIVATIVES', 'NODERIVS')) return { refused: `${raw} forbids adaptations, and a costume picture is one` };
    if (has('SA', 'SHAREALIKE')) return { refused: `${raw} would bind the costume's own terms (share-alike)` };
    const version = /\b([34])\.0\b/.exec(t);
    return { id: version ? `CC-BY-${version[1]}.0` : 'CC-BY' };
  }
  // Khronos marks logos this way (SPDX LicenseRef-LegalMark-…): a
  // trademark, which no license here can hand on.
  if (/^LICENSEREF-LEGALMARK\b/.test(t)) return { refused: `it carries a trademarked mark (${raw}), which no Creative Commons license covers` };
  return { refused: raw ? `${raw} isn't a Creative Commons license the portal accepts` : 'no license given' };
}

// A model is usable when it has credits, every one of them carries an
// accepted license, and its file comes from where its library says
// files come from.
function judge(card) {
  if (card.credits.length === 0) return { ...card, usable: false, reason: 'the library gives no license for it' };
  const refused = card.credits.find((c) => !LICENSES[c.license]);
  if (refused) return { ...card, usable: false, reason: refused.refused ?? `${refused.license} isn't accepted` };
  if (!allowedFile(card.library, card.download)) {
    return { ...card, usable: false, reason: 'its file is somewhere this library may not send files from' };
  }
  return { ...card, usable: true, reason: null };
}

function credit(who, what, licenseText) {
  const l = readLicense(licenseText);
  return { who: String(who || 'unknown'), what, license: l.id ?? String(licenseText ?? ''), refused: l.refused };
}

// --- The libraries ------------------------------------------------------------

// Khronos keeps an index of models and, beside each, metadata that names
// every contributor and their license.
export function khronosCard(entry, metadata) {
  const file = entry.variants?.['glTF-Binary'];
  return judge({
    library: 'khronos',
    id: entry.name,
    title: entry.label ?? entry.name,
    thumbnail: entry.screenshot ? `${KHRONOS}/${entry.name}/${entry.screenshot}` : null,
    download: file ? `${KHRONOS}/${entry.name}/glTF-Binary/${file}` : '',
    source: `${LIBRARIES.khronos.home}/tree/main/Models/${entry.name}`,
    credits: (metadata?.legal ?? []).map((l) => credit(l.artist ?? l.owner, l.what ?? 'Model', l.spdx ?? l.license)),
    attribution: null,
  });
}

// Poly Pizza's model records, as its own client reads them
// (github.com/Chikanz/pizzabox: ID, Title, Attribution, Thumbnail,
// Download, Creator.Username, Licence).
export function polyPizzaCard(m) {
  return judge({
    library: 'polypizza',
    id: String(m.ID ?? ''),
    title: String(m.Title ?? 'Untitled'),
    thumbnail: m.Thumbnail ?? null,
    download: m.Download ?? '',
    source: `https://poly.pizza/m/${encodeURIComponent(m.ID ?? '')}`,
    credits: [credit(m.Creator?.Username, 'Model', m.Licence)],
    attribution: m.Attribution ? String(m.Attribution) : null, // their words, kept as given
  });
}

const QUERY = /^[\p{L}\p{N} '_-]{1,40}$/u;

// The Khronos index is one file; fetched once per fetcher.
const indexes = new WeakMap();

export async function search(libraryId, query, { fetchJson, key } = {}) {
  const q = String(query ?? '').trim();
  if (!QUERY.test(q)) throw new Error('search with a word or two (letters and numbers)');
  if (libraryId === 'khronos') {
    if (!indexes.has(fetchJson)) indexes.set(fetchJson, await fetchJson(`${KHRONOS}/model-index.json`));
    const words = q.toLowerCase().split(/\s+/);
    const hits = indexes
      .get(fetchJson)
      .filter((e) => e.variants?.['glTF-Binary'])
      .filter((e) => {
        const text = [e.name, e.label, ...(e.tags ?? [])].join(' ').toLowerCase();
        return words.every((w) => text.includes(w));
      })
      .slice(0, 24);
    return Promise.all(
      hits.map(async (e) => khronosCard(e, await fetchJson(`${KHRONOS}/${e.name}/metadata.json`).catch(() => null))),
    );
  }
  if (libraryId === 'polypizza') {
    if (!key) throw new Error('Poly Pizza needs your free API key first');
    const res = await fetchJson(`${POLY_PIZZA_DOOR}/search/${encodeURIComponent(q)}?limit=24`, {
      headers: { 'X-Auth-Token': key },
    });
    return (res?.results ?? []).map(polyPizzaCard);
  }
  throw new Error(`${libraryId} isn't on the allowlist`);
}

// The bytes of a usable model's file, fetched only from where its
// library may send files, and never more than `limit`.
export async function download(card, { fetchBytes, limit }) {
  if (!card.usable) throw new Error(`can't use this model: ${card.reason}`);
  if (!allowedFile(card.library, card.download)) throw new Error('that file is not on the allowlist');
  const url =
    card.library === 'polypizza'
      ? `${POLY_PIZZA_DOOR}/file?url=${encodeURIComponent(card.download)}`
      : card.download;
  const bytes = await fetchBytes(url, { limit });
  if (bytes.byteLength > limit) throw new Error('the model file is too big to import');
  return bytes;
}

// --- Credit -------------------------------------------------------------------

// A library card's credit line, in the same words the game will use for
// the model once it is in a costume (engine/manifest.js creditText).
export function creditText(card) {
  return modelCreditText({ ...card, via: LIBRARIES[card.library]?.name ?? card.library });
}
