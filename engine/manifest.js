// Skin manifests (decisions 2026-10-22 §4). A skin binds an archetype's
// primitives — the tension link, the cargo, the banks and their tall
// supports, the water below — to pictures and names, plus scale and
// attribution. Nothing else.
//
// This is where "skins never touch physics" stops being a README claim.
// A manifest may hold only what the schema below names, and the schema
// names no physics: a grip limit, a stiffness, a mass, a budget, a goal
// has nowhere to go, at any depth. The physics never reads a manifest
// anyway — buildModel and the crossing take the archetype — and the
// archetype and its materials are frozen. A chain of teddies and a chain
// of ants solve to the same numbers; "stronger ants" is a different
// level, not a different skin.
//
// Words are names too: what the kid calls a link, the cargo, the jar.
// `danger` is the one phrase, with {cargo} in it, for what waits below.

import { deepFreeze } from './freeze.js';

// The licenses an imported model may carry (decisions 2026-10-22 §6):
// free to use, to adapt — a rendered picture of a model is an
// adaptation — and to use commercially, asking attribution at most.
// NC, ND and SA terms are refused: ND forbids the adaptation, SA would
// bind the costume's own terms, NC the product's. CC0 asks no credit;
// it gets credit anyway. No prototype: a library's license text can
// only ever look up one of these, never "constructor" or "toString".
export const LICENSES = deepFreeze(
  Object.assign(Object.create(null), {
    'CC0-1.0': { name: 'CC0', url: 'https://creativecommons.org/publicdomain/zero/1.0/' },
    'CC-BY-3.0': { name: 'CC BY 3.0', url: 'https://creativecommons.org/licenses/by/3.0/' },
    'CC-BY-4.0': { name: 'CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/' },
    // A library that says "CC BY" without a version: every version allows
    // what a costume does, with credit; the credit says only what's known.
    'CC-BY': { name: 'CC BY', url: 'https://creativecommons.org/share-your-work/cclicenses/' },
  }),
);

const text = (v) => typeof v === 'string' && v.trim().length > 0 && v.length <= 120;
const glyph = (v) => typeof v === 'string' && v.length > 0 && v.length <= 16;
const color = (v) => typeof v === 'string' && /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\))$/i.test(v);
const id = (v) => typeof v === 'string' && /^[a-z][a-z0-9-]{0,31}$/.test(v);
const between = (lo, hi, integer = false) => (v) =>
  typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi && (!integer || Number.isInteger(v));
const oneOf = (...options) => (v) => options.includes(v);
const longText = (v) => typeof v === 'string' && v.trim().length > 0 && v.length <= 400;
const https = (v) => {
  try {
    const u = new URL(v);
    return u.protocol === 'https:' && !u.username && !u.password && v.length <= 400;
  } catch {
    return false;
  }
};
// A picture the portal drew (portal/sprite.js): a PNG carried inside the
// manifest, so a costume plays offline and fetches nothing at play time.
// The model fills all of it but this margin, all round; cargo stand on
// the bottom margin's edge. Its header must be a PNG's and name a small
// picture: a tiny file can still claim a huge one.
export const SPRITE_MARGIN = 0.06;
const SPRITE_PX = 1024;
function sprite(v) {
  const m = typeof v === 'string' && v.length <= 700000 && /^data:image\/png;base64,([A-Za-z0-9+/]+=*)$/.exec(v);
  if (!m) return false;
  let head;
  try {
    head = atob(m[1].slice(0, 32)); // the signature and the IHDR chunk's start
  } catch {
    return false;
  }
  const byte = (i) => head.charCodeAt(i);
  const u32 = (i) => ((byte(i) << 24) | (byte(i + 1) << 16) | (byte(i + 2) << 8) | byte(i + 3)) >>> 0;
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((b, i) => byte(i) === b);
  const size = (n) => n >= 1 && n <= SPRITE_PX;
  return head.length === 24 && png && head.slice(12, 16) === 'IHDR' && size(u32(16)) && size(u32(20));
}
const license = (v) => Object.hasOwn(LICENSES, v);

// An imported model, drawn once into a picture, with everything its
// license asks a costume to say about it.
const MODEL = {
  sprite,
  title: text,
  library: id, // which allowlisted library it came from (portal/library.js)
  via: text, // that library's name, for the credit line
  source: https, // the model's own page there
  credits: [{ who: text, what: text, license }],
  'attribution?': longText, // the library's own credit, as it gave it
};

// Keys ending in '?' are optional; [schema] is a list of 1–12 of it.
const SCHEMA = {
  id,
  name: text,
  icon: glyph,
  attribution: text,
  words: {
    link: text,
    links: text,
    cargo: text,
    jar: text,
    bank: text,
    support: text,
    letGo: text,
    danger: text,
  },
  link: {
    'glyph?': glyph, // a picture per link — one creature, one size —
    'axis?': oneOf('along', 'across'), // whose art runs head-to-tail across or up;
    'model?': MODEL, // or an imported model, drawn lying along the chain;
    'strip?': [color], // or a strip of cloth cut to each link, in these colors
    fill: between(0.3, 1), // a picture: share of the shortest link; cloth: of its own
    perLink: between(1, 4, true), // pictures per link
    'scale?': between(0.5, 2),
  },
  'joint?': { 'glyph?': glyph, 'model?': MODEL, 'scale?': between(0.3, 2) },
  cargo: [{ name: text, 'glyph?': glyph, 'model?': MODEL, 'scale?': between(0.5, 2) }],
  scene: {
    sky: color,
    ink: color, // marks and words drawn on the sky
    'skyDecor?': [glyph],
    bank: { body: color, top: color },
    support: oneOf('tree', 'post', 'chimney'),
    water: { body: color, reach: color, lurkers: [glyph], splash: glyph },
  },
};

function check(value, schema, path, problems) {
  if (typeof schema === 'function') {
    if (!schema(value)) problems.push(`${path} is not a valid value (${JSON.stringify(value)})`);
    return;
  }
  if (Array.isArray(schema)) {
    if (!Array.isArray(value) || value.length < 1 || value.length > 12) {
      problems.push(`${path} should be a list of 1–12`);
      return;
    }
    value.forEach((item, i) => check(item, schema[0], `${path}[${i}]`, problems));
    return;
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    problems.push(`${path} should be an object`);
    return;
  }
  const known = new Map(Object.entries(schema).map(([k, s]) => [k.replace(/\?$/, ''), { s, optional: k.endsWith('?') }]));
  for (const key of Object.keys(value)) {
    if (!known.has(key)) {
      problems.push(`${path ? `${path}.` : ''}${key} is not part of a skin (skins carry pictures and names, never physics)`);
    }
  }
  for (const [key, { s, optional }] of known) {
    const where = path ? `${path}.${key}` : key;
    if (value[key] === undefined) {
      if (!optional) problems.push(`${where} is missing`);
    } else {
      check(value[key], s, where, problems);
    }
  }
}

// Check a skin against the schema and the archetype it will dress.
// Returns the skin, frozen; throws listing every problem otherwise.
export function validateSkin(skin, archetype) {
  const problems = [];
  check(skin, SCHEMA, '', problems);
  // Each thing is drawn exactly one way.
  const ways = (b, keys) => keys.filter((k) => b?.[k] !== undefined).length;
  if (skin?.link && ways(skin.link, ['glyph', 'strip', 'model']) !== 1) {
    problems.push('link needs exactly one of glyph, strip or model');
  }
  if (skin?.joint && ways(skin.joint, ['glyph', 'model']) !== 1) {
    problems.push('joint needs exactly one of glyph or model');
  }
  if (Array.isArray(skin?.cargo)) {
    skin.cargo.forEach((c, i) => {
      if (ways(c, ['glyph', 'model']) !== 1) problems.push(`cargo[${i}] needs exactly one of glyph or model`);
    });
  }
  if (skin && Array.isArray(skin.cargo) && skin.cargo.length !== archetype.cargo.length) {
    problems.push(
      `cargo names ${skin.cargo.length} but the archetype has ${archetype.cargo.length}: ` +
        'a skin dresses every cargo, lightest first, and weighs none',
    );
  }
  if (skin && skin.words && text(skin.words.danger) && !skin.words.danger.includes('{cargo}')) {
    problems.push('words.danger should say {cargo}');
  }
  if (problems.length > 0) {
    throw new Error(`skin ${JSON.stringify(skin?.id)} is not a valid manifest:\n- ${problems.join('\n- ')}`);
  }
  return deepFreeze(skin);
}

// --- Credit -------------------------------------------------------------------

// One model's credit, TASL-style — title, author, source, license — the
// form CC BY asks for and CC0 deserves, in parts a page can link up.
export function creditParts(model) {
  return {
    title: model.title,
    source: model.source ?? null,
    via: model.via,
    attribution: model.attribution ?? null,
    people: model.credits.map((c) => ({
      who: c.who,
      role: c.what && c.what !== 'Model' && c.what !== 'Everything' ? c.what : null,
      license: LICENSES[c.license] ?? { name: c.license, url: null },
    })),
  };
}

export function creditText(model) {
  const p = creditParts(model);
  const people = p.people.map((x) => `${x.who}${x.role ? ` (${x.role})` : ''}, ${x.license.name}`).join('; ');
  return `“${p.title}” by ${people} — via ${p.via}`;
}

// Everything a costume must credit on the level screen (decisions
// 2026-10-22 §6): each imported model once, however many things wear it.
export function costumeCredits(skin) {
  const models = [skin.link?.model, skin.joint?.model, ...(skin.cargo ?? []).map((c) => c.model)];
  const once = new Map();
  for (const m of models) {
    if (m && !once.has(`${m.source} ${m.title}`)) once.set(`${m.source} ${m.title}`, creditParts(m));
  }
  return [...once.values()];
}
