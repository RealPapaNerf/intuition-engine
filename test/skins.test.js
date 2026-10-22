// Skins are manifests; they never touch the physics (decisions
// 2026-10-22 §4) — enforced here, not just stated.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SPAN_GAP, ANT, WOOD, SILK, validateSkin } from '../engine/index.js';
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
  assert.throws(() => validateSkin(both, SPAN_GAP), /exactly one of glyph or strip/);
  const neither = fresh(SKINS[0]);
  delete neither.link.glyph;
  assert.throws(() => validateSkin(neither, SPAN_GAP), /exactly one of glyph or strip/);
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
