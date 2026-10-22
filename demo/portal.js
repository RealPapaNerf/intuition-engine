// The costume portal (decisions 2026-10-22 §6): a manifest editor
// pointed at an allowlist of Creative Commons model libraries. Start
// from a costume, pick a model for any of its pictures — the links,
// where they join, each cargo — see it framed and lit on a bridge, name
// things, look at all of it, and save. What's saved is a manifest
// (engine/manifest.js): pictures, names and credits, never physics; the
// game checks it again before anyone wears it.
//
// A model's way in: a library search (portal/library.js) → its file,
// only from that library's own place → read here (portal/gltf.js) →
// drawn once, from a locked camera, into a picture (portal/sprite.js).
// Nothing is fetched at play time. The educator is the curation gate:
// nothing saves until they say they've looked, and any new picture
// asks them to look again.

import { SPAN_GAP, validateSkin, LICENSES } from '../engine/index.js';
import { SKINS } from '../skins/index.js';
import { LIBRARIES, search, download, creditText, allowedFile } from '../portal/library.js';
import { openGltf, LIMITS } from '../portal/gltf.js';
import { renderSprite, suggestView } from '../portal/sprite.js';
import { drawScene, drawLink, drawJoints, drawCargo, restingLink } from './render.js';
import { writeCredits } from './credits.js';

const LEVEL = SPAN_GAP;
const MADE = 'willitbreak-costumes'; // the game reads these (demo/main.js)
const KEY = 'willitbreak-polypizza-key';
const SPRITE_PX = 160; // about twice the largest the game draws a picture
const TEXTURE_PX = 512; // textures are shrunk to this before drawing
const STARTERS = SKINS.map((s) => validateSkin(structuredClone(s), LEVEL));

const $ = (id) => document.getElementById(id);
function el(tag, props = {}, ...children) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}
const pressed = (node, on) => node.setAttribute('aria-pressed', String(on));
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const clip = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const words = (s, otherwise) => clip(String(s ?? '').trim() || otherwise, 120); // a manifest's text is never blank
const say = (text) => ($('status').textContent = text);
const breathe = () => new Promise((ok) => setTimeout(ok, 30)); // let a message paint before a long draw

// Saved costumes: per device, beside the game. Reading never trusts
// them; the game and this page both check each one before using it.
function readMade() {
  try {
    const list = JSON.parse(localStorage.getItem(MADE));
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

// --- The costume being made ---------------------------------------------------

let original; // the costume this one started from; its pictures can come back
let draft; // the costume being made: a plain manifest
let editing = null; // the id of the saved costume being changed, if one is
let dirty = false; // changed since it was started or saved
let slot = 'link'; // what the next model dresses
const sources = new Map(); // slot → the model wearing it, kept so it can be redrawn
const changed = new Set(); // slots whose picture isn't the original's

const slotKeys = () => ['link', 'joint', ...draft.cargo.map((_, k) => `cargo${k}`)];
const purposeOf = (key) => (key.startsWith('cargo') ? 'cargo' : key);
const cargoIndex = (key) => Number(key.slice(5));
function slotLabel(key) {
  if (key === 'link') return `the ${draft.words.links}`;
  if (key === 'joint') return `where the ${draft.words.links} join`;
  return draft.cargo[cargoIndex(key)].name;
}
function wornBy(key) {
  if (key === 'link') return draft.link;
  if (key === 'joint') return draft.joint;
  return draft.cargo[cargoIndex(key)];
}

function startFrom(base, saved = false) {
  original = base;
  draft = structuredClone(base); // a checked costume is frozen; its copy isn't
  editing = saved ? base.id : null;
  if (!saved) {
    draft.id = 'my-costume'; // a real one is given at saving
    draft.name = `My ${base.name.toLowerCase()}`;
    draft.icon = '🎨';
    draft.attribution = `Made in the costume portal from the ${base.name} costume`;
  }
  dirty = false;
  slot = 'link';
  sources.clear();
  changed.clear();
  $('curated').checked = false;
  $('saveStatus').textContent = '';
  fillForm();
  refresh();
}

// Put a model's picture on a slot, or (null) the original's back.
function dress(key, model) {
  if (key === 'link') {
    draft.link = model ? { model, fill: 0.8, perLink: 1 } : structuredClone(original.link);
  } else if (key === 'joint') {
    if (model) draft.joint = { model, scale: 0.6 };
    else if (original.joint) draft.joint = structuredClone(original.joint);
    else delete draft.joint;
  } else {
    const k = cargoIndex(key);
    const { name } = draft.cargo[k];
    const back = structuredClone(original.cargo[k]);
    draft.cargo[k] = model ? { name, model, ...(back.scale ? { scale: back.scale } : {}) } : { ...back, name };
  }
  if (model) changed.add(key);
  else changed.delete(key);
  dirty = true;
  $('curated').checked = false; // a new picture wants a new look
}

// The model drawn into the picture the costume carries: recentered and
// scaled to fill it (the normalization step, portal/sprite.js), lying
// along the chain for a link, standing on its feet for cargo. The
// credits travel with it, as the library gave them.
function picture(src, purpose) {
  const { card, model, textures, view, turn, mirror } = src;
  const anchor = purpose === 'cargo' ? 'bottom' : 'center';
  const pixels = renderSprite(model, textures, { size: SPRITE_PX, view, turn, mirror, anchor });
  const canvas = el('canvas', { width: pixels.width, height: pixels.height });
  canvas.getContext('2d').putImageData(new ImageData(pixels.data, pixels.width, pixels.height), 0, 0);
  return {
    sprite: canvas.toDataURL('image/png'),
    title: words(card.title, 'Untitled'),
    library: card.library,
    via: LIBRARIES[card.library].name,
    source: card.source,
    credits: card.credits.map((c) => ({ who: words(c.who, 'unknown'), what: words(c.what, 'Model'), license: c.license })),
    ...(card.attribution ? { attribution: clip(card.attribution, 400) } : {}),
  };
}

// --- Fetching -------------------------------------------------------------------

async function answer(res) {
  if (res.ok) return res;
  const plain = (res.headers.get('content-type') ?? '').startsWith('text/plain');
  const why = plain ? (await res.text()).trim().slice(0, 160) : '';
  throw new Error(`the library answered ${res.status}${why ? ` (${why})` : ''}`);
}

async function fetchJson(url, init) {
  return (await answer(await fetch(url, init))).json();
}

// A model file, never more than `limit` bytes, and only from where it
// was asked for: a redirect somewhere else is refused.
async function fetchBytes(url, { limit }) {
  const asked = new URL(url, location.href);
  const res = await answer(await fetch(asked));
  if (res.url && new URL(res.url).origin !== asked.origin) throw new Error('the library sent the file from somewhere else');
  if (Number(res.headers.get('content-length') ?? 0) > limit) throw new Error('the model file is too big to import');
  const reader = res.body.getReader();
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel();
      throw new Error('the model file is too big to import');
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) {
    bytes.set(c, at);
    at += c.byteLength;
  }
  return bytes;
}

// Textures, decoded by the browser and shrunk to what the picture can
// show. One that won't decode is left out and its base color stands in.
async function decodeTextures(model) {
  return Promise.all(
    model.images.map(async (image) => {
      if (!image.bytes) {
        model.warnings.push('a texture is a separate file, so it’s drawn in its base colors');
        return undefined;
      }
      try {
        const blob = new Blob([image.bytes], { type: image.mimeType ?? '' });
        const bitmap = await createImageBitmap(blob, { colorSpaceConversion: 'none' });
        const k = Math.min(1, TEXTURE_PX / Math.max(bitmap.width, bitmap.height));
        const width = Math.max(1, Math.round(bitmap.width * k));
        const height = Math.max(1, Math.round(bitmap.height * k));
        const ctx = el('canvas', { width, height }).getContext('2d', { willReadFrequently: true });
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(bitmap, 0, 0, width, height);
        bitmap.close();
        return { width, height, data: ctx.getImageData(0, 0, width, height).data };
      } catch {
        model.warnings.push('a texture couldn’t be read, so it’s drawn in its base colors');
        return undefined;
      }
    }),
  );
}

// --- Finding a model --------------------------------------------------------------

let libraryId = 'khronos';
let searching = 0; // the latest search wins
let picking = 0; // the latest pick wins

function showLibraries() {
  $('libraries').replaceChildren(
    ...[LIBRARIES.khronos, LIBRARIES.polypizza].map((lib) => {
      const radio = el('input', { type: 'radio', name: 'library', value: lib.id, checked: lib.id === libraryId });
      radio.onchange = () => {
        libraryId = lib.id;
        $('results').replaceChildren();
        say('');
        showKey();
      };
      return el('label', { className: 'library' }, radio, ` ${lib.name} `, el('span', { className: 'note', textContent: lib.about }));
    }),
  );
  showKey();
}

function showKey() {
  const lib = LIBRARIES[libraryId];
  $('keyRow').hidden = !lib.key;
  if (lib.key) $('keyHelp').href = lib.key.help;
}

function showResults(cards) {
  $('results').replaceChildren(
    ...cards.map((card) => {
      const thumb =
        card.thumbnail && allowedFile(card.library, card.thumbnail)
          ? el('img', { src: card.thumbnail, alt: '', loading: 'lazy', referrerPolicy: 'no-referrer' })
          : el('div', { className: 'nothumb', textContent: 'no picture' });
      const licenses = [...new Set(card.credits.map((c) => c.license))].map((l) =>
        el('span', { className: LICENSES[l] ? 'badge' : 'badge refused', textContent: LICENSES[l]?.name ?? l }),
      );
      return el(
        'button',
        {
          type: 'button',
          className: 'card',
          disabled: !card.usable,
          title: card.usable ? creditText(card) : `Can’t use: ${card.reason}`,
          onclick: () => pick(card),
        },
        thumb,
        el('strong', { textContent: card.title }),
        el('span', {}, ...licenses),
        card.usable ? '' : el('small', { textContent: `Can’t use: ${card.reason}` }),
      );
    }),
  );
}

$('searchForm').onsubmit = async (e) => {
  e.preventDefault();
  const mine = ++searching;
  $('results').replaceChildren();
  say(`Searching ${LIBRARIES[libraryId].name}…`);
  try {
    const cards = await search(libraryId, $('query').value, { fetchJson, key: $('key').value.trim() });
    if (mine !== searching) return;
    showResults(cards);
    const unusable = cards.filter((c) => !c.usable).length;
    say(
      cards.length === 0
        ? 'Nothing found. Try another word.'
        : `${cards.length} found${unusable ? ` (${unusable} can’t be used; each says why)` : ''}. Pick one for ${slotLabel(slot)}.`,
    );
  } catch (err) {
    if (mine === searching) say(`The search didn’t work: ${err.message}`);
  }
};

async function pick(card) {
  const key = slot;
  const mine = ++picking;
  say(`Fetching “${card.title}”…`);
  try {
    const bytes = await download(card, { fetchBytes, limit: LIMITS.bytes });
    if (mine !== picking) return;
    say(`Drawing “${card.title}”…`);
    const model = await openGltf(bytes);
    const textures = await decodeTextures(model);
    await breathe();
    if (mine !== picking) return;
    const src = { card, model, textures, ...suggestView(model, purposeOf(key)) };
    sources.set(key, src);
    dress(key, picture(src, purposeOf(key)));
    const notes = [...new Set(model.warnings)];
    say(
      `“${card.title}” is on ${slotLabel(key)}. If it looks wrong, turn it or try another view.` +
        (notes.length ? ` Note: ${notes.join('; ')}.` : ''),
    );
  } catch (err) {
    if (mine === picking) say(`Couldn’t use “${card.title}”: ${err.message}`);
  }
  refresh();
}

// --- Picturing it -------------------------------------------------------------------

function redraw(change) {
  const src = sources.get(slot);
  if (!src) return;
  Object.assign(src, change(src));
  dress(slot, picture(src, purposeOf(slot)));
  refresh();
}
for (const view of ['side', 'front', 'top']) $(view).onclick = () => redraw(() => ({ view }));
$('turn').onclick = () => redraw((s) => ({ turn: (s.turn + 1) % 4 }));
$('mirror').onclick = () => redraw((s) => ({ mirror: !s.mirror }));
$('everyCargo').onclick = () => {
  const src = sources.get(slot);
  if (!src || purposeOf(slot) !== 'cargo') return;
  const model = picture(src, 'cargo');
  for (const key of slotKeys().filter((k) => purposeOf(k) === 'cargo')) {
    sources.set(key, { ...src });
    dress(key, model);
  }
  refresh();
};
$('putBack').onclick = () => {
  sources.delete(slot);
  dress(slot, null);
  refresh();
};

// --- Names --------------------------------------------------------------------------

const WORDS = {
  link: 'One link',
  links: 'Many links',
  cargo: 'What crosses',
  jar: 'Where spare links wait',
  bank: 'The ground on each side',
  support: 'The tall supports',
  letGo: 'What a failing link does',
  danger: 'What waits below (say {cargo})',
};

function field(value, onInput) {
  const input = el('input', { type: 'text', value, maxLength: 120 });
  input.oninput = () => {
    onInput(input.value);
    dirty = true;
    refresh();
  };
  return input;
}

function fillForm() {
  $('name').value = draft.name;
  $('icon').value = draft.icon;
  $('attribution').value = draft.attribution;
  $('words').replaceChildren(
    ...Object.entries(WORDS).map(([key, label]) =>
      el('label', {}, label, field(draft.words[key], (v) => (draft.words[key] = v))),
    ),
  );
  $('cargoNames').replaceChildren(
    ...draft.cargo.map((c, k) =>
      el('label', {}, `${k + 1}: ${Math.round(LEVEL.cargo[k] * 1000)} g`, field(c.name, (v) => (draft.cargo[k].name = v))),
    ),
  );
}
for (const key of ['name', 'icon', 'attribution']) {
  $(key).oninput = () => {
    draft[key] = $(key).value;
    dirty = true;
    refresh();
  };
}

// The checker's words for what an educator can get wrong here.
function friendly(problem) {
  const at = /^([\w.[\]]+) (?:is not a valid value|is missing)/.exec(problem)?.[1];
  if (at === 'name') return 'Give the costume a name.';
  if (at === 'icon') return 'Give it an icon: an emoji, or a letter or two.';
  if (at === 'attribution') return 'Give it a credit line.';
  const word = /^words\.(\w+)$/.exec(at ?? '')?.[1];
  if (word) return `Fill in “${WORDS[word]}”.`;
  const cargo = /^cargo\[(\d+)\]\.name$/.exec(at ?? '')?.[1];
  if (cargo !== undefined) return `Name cargo ${Number(cargo) + 1}.`;
  if (problem.startsWith('words.danger should say')) return 'The words for what waits below must say {cargo}, where the cargo’s name goes.';
  return problem;
}
function problemsWith(costume) {
  try {
    validateSkin(structuredClone(costume), LEVEL);
    return [];
  } catch (e) {
    return e.message.split('\n- ').slice(1).map(friendly);
  }
}

// --- The look -------------------------------------------------------------------------

// A bridge to try the costume on: a shallow sag from bank to bank, every
// cargo standing on it. A picture only: nothing here is solved, so
// nothing here claims to hold. In the game, physics decides.
const SAMPLE = [[0, 0], [1, -1], [2, -1], [3, -1], [4, -1], [5, -1], [6, -1], [7, -1], [8, -1], [9, -1], [10, 0]];
const at = ([i, j]) => ({ x: i * LEVEL.step, y: j * LEVEL.step });
const ctx = $('preview').getContext('2d');
function drawPreview() {
  const t = performance.now() / 1000;
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  drawScene(ctx, LEVEL, draft);
  for (let k = 0; k + 1 < SAMPLE.length; k++) {
    drawLink(ctx, LEVEL, draft, restingLink(LEVEL, SAMPLE[k], SAMPLE[k + 1]), { t, seed: 7 * k + 3 });
  }
  drawJoints(ctx, LEVEL, draft, SAMPLE.map(at));
  draft.cargo.forEach((_, k) => drawCargo(ctx, LEVEL, draft, k, at(SAMPLE[2 + 2 * k])));
  requestAnimationFrame(drawPreview);
}

function refresh() {
  for (const b of $('bases').children) pressed(b, !editing && b.dataset.base === original.id);
  $('slots').replaceChildren(
    ...slotKeys().map((key) => {
      const worn = wornBy(key);
      const what = worn?.model ? `“${worn.model.title}”` : worn ? 'original' : 'nothing';
      const b = el('button', { type: 'button', onclick: () => ((slot = key), refresh()) }, `${cap(slotLabel(key))} · ${what}`);
      pressed(b, key === slot);
      return b;
    }),
  );
  $('slotName').textContent = slotLabel(slot);

  const src = sources.get(slot);
  const worn = wornBy(slot);
  $('pictureNote').textContent = src
    ? `${cap(slotLabel(slot))}: “${src.card.title}”, from the ${src.view}` +
      `${src.turn ? `, turned ${src.turn * 90}°` : ''}${src.mirror ? ', mirrored' : ''}.`
    : worn?.model
      ? `${cap(slotLabel(slot))}: “${worn.model.title}”. To see it another way, pick it again from its library.`
      : `${cap(slotLabel(slot))}: the original picture. Find a model above to change it.`;
  for (const view of ['side', 'front', 'top']) {
    $(view).disabled = !src;
    pressed($(view), src?.view === view);
  }
  $('turn').disabled = !src;
  $('mirror').disabled = !src;
  pressed($('mirror'), Boolean(src?.mirror));
  $('everyCargo').disabled = !src || purposeOf(slot) !== 'cargo';
  $('putBack').disabled = !changed.has(slot);

  writeCredits($('credit'), draft);
  const problems = problemsWith({ ...draft, id: editing ?? 'my-costume' });
  $('problems').replaceChildren(...problems.map((p) => el('li', { textContent: p })));
  $('save').disabled = problems.length > 0 || !$('curated').checked;
}

// --- Saving -------------------------------------------------------------------------

function freshId(name, list) {
  const slug = name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 22);
  const taken = new Set([...list.map((s) => s?.id), ...STARTERS.map((s) => s.id)]);
  const stem = `my-${slug || 'costume'}`.replace(/-+$/, '');
  let id = stem;
  for (let n = 2; taken.has(id); n++) id = `${stem}-${n}`;
  return id;
}

$('curated').onchange = refresh;

$('save').onclick = () => {
  const list = readMade();
  const id = editing ?? freshId(draft.name, list);
  let costume;
  try {
    costume = validateSkin(structuredClone({ ...draft, id }), LEVEL);
  } catch (e) {
    $('saveStatus').textContent = e.message;
    return;
  }
  const k = list.findIndex((s) => s?.id === id);
  if (k >= 0) list[k] = costume;
  else list.push(costume);
  try {
    localStorage.setItem(MADE, JSON.stringify(list));
  } catch {
    $('saveStatus').textContent = 'This device has no room left for it. Delete a costume below, then save again.';
    return;
  }
  editing = id;
  draft.id = id;
  dirty = false;
  $('saveStatus').textContent = `Saved “${costume.name}”. It’s in the game’s costume row now.`;
  showSaved();
  refresh();
};

function showSaved() {
  const list = readMade();
  if (list.length === 0) {
    $('saved').replaceChildren(el('li', { className: 'note', textContent: 'None yet.' }));
    return;
  }
  $('saved').replaceChildren(
    ...list.map((s) => {
      const problems = problemsWith(s);
      const name = `${s?.icon ?? ''} ${s?.name ?? 'Unnamed'}`;
      const change = el('button', {
        type: 'button',
        textContent: 'Change',
        disabled: problems.length > 0,
        onclick: () => {
          if (dirty && !confirm('Leave the costume you’re making? What you haven’t saved will be lost.')) return;
          startFrom(validateSkin(structuredClone(s), LEVEL), true);
        },
      });
      const remove = el('button', {
        type: 'button',
        textContent: 'Delete',
        onclick: () => {
          if (!confirm(`Delete “${s?.name ?? 'this costume'}”? The game will stop offering it.`)) return;
          try {
            localStorage.setItem(MADE, JSON.stringify(readMade().filter((x) => x?.id !== s?.id)));
          } catch {
            $('saveStatus').textContent = 'Couldn’t change the costumes saved on this device.';
            return;
          }
          if (editing === s?.id) editing = null;
          showSaved();
          refresh();
        },
      });
      const why = problems.length ? el('span', { className: 'why', textContent: `Won’t load in the game: ${problems[0]}` }) : '';
      return el('li', {}, name, change, remove, why);
    }),
  );
}
addEventListener('storage', (e) => {
  if (e.key === MADE || e.key === null) showSaved();
});

// --- Start ------------------------------------------------------------------------------

$('bases').replaceChildren(
  ...STARTERS.map((s) => {
    const b = el('button', {
      type: 'button',
      textContent: `${s.icon} ${s.name}`,
      onclick: () => {
        if (dirty && !confirm('Start over? What you haven’t saved will be lost.')) return;
        startFrom(s);
      },
    });
    b.dataset.base = s.id;
    return b;
  }),
);
try {
  $('key').value = localStorage.getItem(KEY) ?? '';
} catch {
  /* no storage: the key is asked each visit */
}
$('keyRow').onsubmit = (e) => e.preventDefault();
$('key').oninput = () => {
  try {
    localStorage.setItem(KEY, $('key').value.trim());
  } catch {
    /* fine */
  }
};
if ($('key').value) libraryId = 'polypizza';
showLibraries();
startFrom(STARTERS[0]);
showSaved();
drawPreview();
