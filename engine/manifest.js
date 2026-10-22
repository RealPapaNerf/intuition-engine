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

const text = (v) => typeof v === 'string' && v.trim().length > 0 && v.length <= 120;
const glyph = (v) => typeof v === 'string' && v.length > 0 && v.length <= 16;
const color = (v) => typeof v === 'string' && /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\))$/i.test(v);
const id = (v) => typeof v === 'string' && /^[a-z][a-z0-9-]{0,31}$/.test(v);
const between = (lo, hi, integer = false) => (v) =>
  typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi && (!integer || Number.isInteger(v));
const oneOf = (...options) => (v) => options.includes(v);

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
    'strip?': [color], // or a strip of cloth cut to each link, in these colors
    fill: between(0.3, 1), // a picture: share of the shortest link; cloth: of its own
    perLink: between(1, 4, true), // pictures per link
    'scale?': between(0.5, 2),
  },
  'joint?': { glyph, 'scale?': between(0.3, 2) },
  cargo: [{ name: text, glyph, 'scale?': between(0.5, 2) }],
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
  if (skin && skin.link && (skin.link.glyph === undefined) === (skin.link.strip === undefined)) {
    problems.push('link needs exactly one of glyph or strip');
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
