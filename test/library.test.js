// The allowlist: which licenses a costume's models may carry, which
// places their files may come from, and what the portal makes of each
// library's records. Fetchers are passed in; no network is touched.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  readLicense,
  allowedFile,
  khronosCard,
  polyPizzaCard,
  search,
  download,
  creditText,
  POLY_PIZZA_DOOR,
} from '../portal/library.js';

// From KhronosGroup/glTF-Sample-Assets, Models/*/metadata.json (trimmed).
const FOX_META = {
  legal: [
    { license: 'CC0-1.0', spdx: 'CC0-1.0', artist: 'PixelMannen', what: 'Model' },
    { license: 'CC-BY-4.0', spdx: 'CC-BY-4.0', artist: 'tomkranis', what: 'Rigging & Animation' },
    { license: 'CC-BY-4.0', spdx: 'CC-BY-4.0', artist: '@AsoboStudio and @scurest', what: 'Conversion to glTF' },
  ],
};
const DUCK_META = { legal: [{ license: 'SCEA', artist: 'Sony', what: 'Everything' }] };
const FOX = { name: 'Fox', label: 'Fox', screenshot: 'screenshot/screenshot.jpg', tags: ['core'], variants: { 'glTF-Binary': 'Fox.glb' } };
const DUCK = { name: 'Duck', label: 'Duck', screenshot: 'screenshot/screenshot.png', tags: ['core'], variants: { 'glTF-Binary': 'Duck.glb' } };

// A Poly Pizza record, by the field names its own client reads
// (github.com/Chikanz/pizzabox, Scripts/PolyPizza/Model.cs).
const frogRecord = (over = {}) => ({
  ID: 'abc123',
  Title: 'Frog',
  Attribution: 'Frog by Someone [CC-BY] via Poly Pizza',
  Thumbnail: 'https://static.poly.pizza/abc123.webp',
  Download: 'https://static.poly.pizza/abc123.glb',
  Creator: { Username: 'Someone' },
  Licence: 'CC-BY 4.0',
  ...over,
});

test('licenses: CC0 and CC BY are taken; NC, ND, SA and anything else are refused, with the reason', () => {
  for (const t of ['CC0', 'CC0 1.0', 'cc0-1.0']) assert.deepEqual(readLicense(t), { id: 'CC0-1.0' }, t);
  assert.deepEqual(readLicense('CC-BY 4.0'), { id: 'CC-BY-4.0' });
  assert.deepEqual(readLicense('CC BY 3.0'), { id: 'CC-BY-3.0' });
  assert.deepEqual(readLicense('CC-BY-4.0 International'), { id: 'CC-BY-4.0' });
  assert.deepEqual(readLicense('Creative Commons Attribution'), { id: 'CC-BY' }, 'no version: the family, said plainly');
  assert.match(readLicense('CC BY-NC 4.0').refused, /commercial/);
  assert.match(readLicense('CC-BY-ND-4.0').refused, /adaptations/);
  assert.match(readLicense('CC BY-SA 4.0').refused, /share-alike/);
  assert.match(readLicense('SCEA').refused, /isn't a Creative Commons license/);
  assert.match(readLicense('LicenseRef-LegalMark-Cesium').refused, /trademarked mark/, 'a logo is a trademark, not a license');
  assert.match(readLicense('').refused, /no license/);
});

test('files only from each library’s own place: no other host, no plain http, no tricks', () => {
  assert.ok(allowedFile('khronos', 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/Fox/glTF-Binary/Fox.glb'));
  assert.ok(allowedFile('polypizza', 'https://static.poly.pizza/abc.glb'));
  const refused = [
    ['khronos', 'https://raw.githubusercontent.com/someone-else/repo/main/x.glb'],
    ['khronos', 'http://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/x.glb'],
    ['khronos', 'https://raw.githubusercontent.com@evil.example/KhronosGroup/glTF-Sample-Assets/x.glb'],
    ['polypizza', 'https://static.poly.pizza.evil.example/abc.glb'],
    ['polypizza', 'https://evil.example/abc.glb'],
    ['polypizza', 'not a url'],
    ['nowhere', 'https://static.poly.pizza/abc.glb'],
  ];
  for (const [library, url] of refused) assert.equal(allowedFile(library, url), false, url);
});

test('Khronos records: every contributor credited; a non-CC license or none at all makes it unusable', () => {
  const fox = khronosCard(FOX, FOX_META);
  assert.equal(fox.usable, true);
  assert.equal(fox.credits.length, 3);
  assert.deepEqual(fox.credits.map((c) => c.license), ['CC0-1.0', 'CC-BY-4.0', 'CC-BY-4.0']);
  assert.match(fox.download, /Fox\/glTF-Binary\/Fox\.glb$/);
  assert.equal(creditText(fox), '“Fox” by PixelMannen, CC0; tomkranis (Rigging & Animation), CC BY 4.0; @AsoboStudio and @scurest (Conversion to glTF), CC BY 4.0 — via glTF Sample Assets (Khronos)');

  for (const trick of ['constructor', 'toString', '__proto__']) {
    const card = khronosCard(FOX, { legal: [{ license: trick, artist: 'A', what: 'Model' }] });
    assert.equal(card.usable, false, `a license called ${trick}`);
  }

  const duck = khronosCard(DUCK, DUCK_META);
  assert.equal(duck.usable, false);
  assert.match(duck.reason, /SCEA isn't a Creative Commons license/);
  assert.equal(khronosCard(FOX, null).usable, false, 'metadata missing: no license, no use');
});

test('Poly Pizza records: their own attribution kept; a foreign file or a refused license, unusable', () => {
  const frog = polyPizzaCard(frogRecord());
  assert.equal(frog.usable, true);
  assert.equal(frog.source, 'https://poly.pizza/m/abc123');
  assert.equal(frog.attribution, 'Frog by Someone [CC-BY] via Poly Pizza');
  assert.deepEqual(frog.credits[0], { who: 'Someone', what: 'Model', license: 'CC-BY-4.0', refused: undefined });
  assert.equal(polyPizzaCard(frogRecord({ Licence: 'CC0 1.0' })).usable, true);
  assert.match(polyPizzaCard(frogRecord({ Licence: 'CC BY-NC 4.0' })).reason, /commercial/);
  assert.match(polyPizzaCard(frogRecord({ Download: 'https://evil.example/f.glb' })).reason, /may not send files from/);
});

test('search: Khronos matched on every word, plain .glb models only; the index fetched once', async () => {
  const index = [FOX, DUCK, { name: 'FoxDraco', label: 'Fox (Draco)', variants: { 'glTF-Draco': 'x.glb' } }];
  const fetched = [];
  const fetchJson = async (url) => {
    fetched.push(url);
    if (url.endsWith('model-index.json')) return index;
    if (url.includes('/Fox/')) return FOX_META;
    if (url.includes('/Duck/')) return DUCK_META;
    throw new Error('unexpected');
  };
  const foxes = await search('khronos', 'fox', { fetchJson });
  assert.deepEqual(foxes.map((c) => c.id), ['Fox']);
  const cores = await search('khronos', 'core', { fetchJson });
  assert.deepEqual(cores.map((c) => [c.id, c.usable]), [['Fox', true], ['Duck', false]]);
  assert.equal(fetched.filter((u) => u.endsWith('model-index.json')).length, 1);
  await assert.rejects(search('khronos', 'https://evil.example/x.glb', { fetchJson }), /a word or two/);
  await assert.rejects(search('sketchy', 'fox', { fetchJson }), /isn't on the allowlist/);
});

test('search: Poly Pizza goes through the door, with the educator’s key', async () => {
  await assert.rejects(search('polypizza', 'frog', { fetchJson: async () => ({}) }), /API key/);
  const calls = [];
  const fetchJson = async (url, init) => {
    calls.push([url, init]);
    return { results: [frogRecord()], total: 1 };
  };
  const cards = await search('polypizza', 'tree frog', { fetchJson, key: 'k3y' });
  assert.equal(calls[0][0], `${POLY_PIZZA_DOOR}/search/tree%20frog?limit=24`);
  assert.deepEqual(calls[0][1], { headers: { 'X-Auth-Token': 'k3y' } });
  assert.equal(cards[0].title, 'Frog');
});

test('download: only usable models, from the allowed place, never past the limit', async () => {
  const seen = [];
  const fetchBytes = async (url, { limit }) => {
    seen.push(url);
    return new Uint8Array(limit + (url.includes('big') ? 1 : 0));
  };
  const fox = khronosCard(FOX, FOX_META);
  assert.equal((await download(fox, { fetchBytes, limit: 8 })).byteLength, 8);
  assert.equal(seen[0], fox.download, 'Khronos: straight from GitHub, which answers browsers');
  const frog = polyPizzaCard(frogRecord());
  await download(frog, { fetchBytes, limit: 8 });
  assert.equal(seen[1], `${POLY_PIZZA_DOOR}/file?url=${encodeURIComponent(frog.download)}`);
  await assert.rejects(download(khronosCard(DUCK, DUCK_META), { fetchBytes, limit: 8 }), /SCEA/);
  const big = polyPizzaCard(frogRecord({ Download: 'https://static.poly.pizza/big.glb' }));
  await assert.rejects(download(big, { fetchBytes, limit: 8 }), /too big/);
});
