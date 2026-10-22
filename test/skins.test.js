// Skins are manifests; they never touch the physics (decisions
// 2026-10-22 §4) — enforced here, not just stated.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SPAN_GAP, ANT, WOOD, SILK, validateSkin, costumeCredits, creditText } from '../engine/index.js';
import { SKINS } from '../skins/index.js';

const fresh = (skin) => structuredClone(skin); // validated skins are frozen

test('every starter skin is a valid manifest for span-the-gap, and they are distinct', () => {
  assert.equal(SKINS.length, 3);
  for (const skin of SKINS) validateSkin(fresh(skin), SPAN_GAP);
  assert.equal(new Set(SKINS.map((s) => s.id)).size, SKINS.length);
});

test('a manifest holds pictures and names, never physics: refused at any depth', () => {
  const plant = [
    ['top level', (s) => (s.tensionLimit = 9)],
    ['a budget', (s) => (s.jar = 99)],
    ['a material', (s) => (s.material = { ...ANT, tensionLimit: 9 })],
    ['on the link', (s) => (s.link.tensionLimit = 9)],
    ['a heavier link', (s) => (s.link.mass = 0.01)],
    ['a stiffer link', (s) => (s.link.axialStiffness = 600)],
    ['a lighter cargo', (s) => (s.cargo[1].mass = 0.001)],
    ['in the scene', (s) => (s.scene.gravity = 1)],
    ['a deeper river', (s) => (s.scene.water.level = -1)],
    ['a new word', (s) => (s.words.grip = 'super grip')],
  ];
  for (const [where, mutate] of plant) {
    const skin = fresh(SKINS[0]);
    mutate(skin);
    assert.throws(() => validateSkin(skin, SPAN_GAP), /is not part of a skin/, `${where} got through`);
  }
});

test('a skin dresses every cargo, lightest first, and weighs none', () => {
  const short = fresh(SKINS[1]);
  short.cargo.pop();
  assert.throws(() => validateSkin(short, SPAN_GAP), /cargo names 3 but the archetype has 4/);
});

test('presentation stays presentation: one kind of picture per link, bounded numbers', () => {
  const both = fresh(SKINS[0]);
  both.link.strip = ['#ffffff'];
  assert.throws(() => validateSkin(both, SPAN_GAP), /exactly one of glyph, strip or model/);
  const neither = fresh(SKINS[0]);
  delete neither.link.glyph;
  assert.throws(() => validateSkin(neither, SPAN_GAP), /exactly one of glyph, strip or model/);
  const crowded = fresh(SKINS[0]);
  crowded.link.perLink = 9;
  assert.throws(() => validateSkin(crowded, SPAN_GAP), /link\.perLink/);
  const noDanger = fresh(SKINS[2]);
  noDanger.words.danger = 'the dog barks';
  assert.throws(() => validateSkin(noDanger, SPAN_GAP), /should say \{cargo\}/);
});

test('the honest numbers are frozen: no skin, and nothing else, makes the ants stronger', () => {
  // ES modules are strict: a write to a frozen object throws.
  assert.throws(() => {
    ANT.tensionLimit = 99;
  }, TypeError);
  assert.throws(() => {
    SPAN_GAP.material.axialStiffness = 1;
  }, TypeError);
  assert.throws(() => {
    SPAN_GAP.jar = 99;
  }, TypeError);
  assert.throws(() => {
    SPAN_GAP.cargo[0] = 0.001;
  }, TypeError);
  assert.throws(() => {
    SPAN_GAP.anchors[0][1] = 9;
  }, TypeError);
  for (const m of [ANT, WOOD, SILK]) assert.ok(Object.isFrozen(m));

  // Dressing the level in every skin leaves every number where it was.
  const before = JSON.stringify(SPAN_GAP);
  for (const skin of SKINS) validateSkin(fresh(skin), SPAN_GAP);
  assert.equal(JSON.stringify(SPAN_GAP), before);
});

test('a validated skin is frozen too', () => {
  const skin = validateSkin(fresh(SKINS[2]), SPAN_GAP);
  assert.throws(() => {
    skin.cargo[0].name = 'Tiger';
  }, TypeError);
});

// --- Imported models (the portal's output) ------------------------------------

const DOT = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const fox = () => ({
  sprite: DOT,
  title: 'Fox',
  library: 'khronos',
  via: 'glTF Sample Assets (Khronos)',
  source: 'https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/Fox',
  credits: [
    { who: 'PixelMannen', what: 'Model', license: 'CC0-1.0' },
    { who: 'tomkranis', what: 'Rigging & Animation', license: 'CC-BY-4.0' },
  ],
});

function imported() {
  const skin = fresh(SKINS[0]);
  skin.id = 'my-foxes';
  delete skin.link.glyph;
  skin.link.model = fox();
  for (const c of skin.cargo) {
    delete c.glyph;
    c.model = fox();
  }
  skin.joint = { model: fox() };
  return skin;
}

test('an imported model is a picture and its credits, and goes wherever a glyph can', () => {
  const skin = validateSkin(imported(), SPAN_GAP);
  assert.equal(skin.link.model.credits[1].license, 'CC-BY-4.0');
  const both = imported();
  both.cargo[2].glyph = '🦊';
  assert.throws(() => validateSkin(both, SPAN_GAP), /cargo\[2\] needs exactly one of glyph or model/);
});

test('a model needs an accepted license, a real page, and a picture made here — not a link out', () => {
  const cases = [
    ['a NonCommercial license', (s) => (s.link.model.credits[0].license = 'CC-BY-NC-4.0'), /credits\[0\]\.license/],
    ['no credits', (s) => (s.cargo[0].model.credits = []), /credits should be a list/],
    ['a plain-http page', (s) => (s.link.model.source = 'http://example.org/fox'), /source/],
    ['a picture fetched from elsewhere', (s) => (s.link.model.sprite = 'https://example.org/fox.png'), /sprite/],
    ['a picture that is a program', (s) => (s.link.model.sprite = 'data:image/svg+xml;base64,PHN2Zz4='), /sprite/],
  ];
  for (const [what, mutate, why] of cases) {
    const skin = imported();
    mutate(skin);
    assert.throws(() => validateSkin(skin, SPAN_GAP), why, what);
  }
});

test('physics can’t ride in on a model either', () => {
  for (const mutate of [
    (s) => (s.link.model.mass = 2),
    (s) => (s.cargo[3].model.tensionLimit = 9),
    (s) => (s.link.model.credits[0].stiffness = 1),
  ]) {
    const skin = imported();
    mutate(skin);
    assert.throws(() => validateSkin(skin, SPAN_GAP), /is not part of a skin/);
  }
});

test('a model’s picture must really be a small PNG: its header is read, not trusted', () => {
  const png = (w, h) => {
    const b = Buffer.alloc(33);
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0);
    b.writeUInt32BE(13, 8);
    b.write('IHDR', 12, 'latin1');
    b.writeUInt32BE(w, 16);
    b.writeUInt32BE(h, 20);
    return `data:image/png;base64,${b.toString('base64')}`;
  };
  const wearing = (sprite) => {
    const skin = imported();
    skin.link.model.sprite = sprite;
    return skin;
  };
  validateSkin(wearing(png(160, 160)), SPAN_GAP);
  for (const [what, sprite] of [
    ['a picture claiming to be huge', png(40000, 40000)],
    ['a picture with no width', png(0, 12)],
    ['not a PNG at all', `data:image/png;base64,${Buffer.from('GIF89a and then some more bytes').toString('base64')}`],
    ['too short to be anything', 'data:image/png;base64,iVBORw0K'],
  ]) {
    assert.throws(() => validateSkin(wearing(sprite), SPAN_GAP), /sprite/, what);
  }
});

test('the level screen credits each model once, every contributor, every license linked', () => {
  const skin = imported(); // the fox is worn in six places
  skin.cargo[3].model = {
    ...fox(),
    title: 'Frog',
    library: 'polypizza',
    via: 'Poly Pizza',
    source: 'https://poly.pizza/m/abc123',
    credits: [{ who: 'Someone', what: 'Model', license: 'CC-BY' }],
    attribution: 'Frog by Someone [CC-BY] via Poly Pizza',
  };
  const credits = costumeCredits(validateSkin(skin, SPAN_GAP));
  assert.deepEqual(credits.map((c) => c.title), ['Fox', 'Frog']);
  const [foxes, frog] = credits;
  assert.deepEqual(
    foxes.people.map((p) => [p.who, p.role, p.license.name]),
    [['PixelMannen', null, 'CC0'], ['tomkranis', 'Rigging & Animation', 'CC BY 4.0']],
  );
  assert.equal(foxes.people[1].license.url, 'https://creativecommons.org/licenses/by/4.0/');
  assert.equal(foxes.source, 'https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/Fox');
  assert.equal(frog.attribution, 'Frog by Someone [CC-BY] via Poly Pizza');
  assert.equal(creditText(skin.cargo[3].model), '“Frog” by Someone, CC BY — via Poly Pizza');
  for (const starter of SKINS) assert.deepEqual(costumeCredits(starter), [], 'an original costume credits no one else');
});
