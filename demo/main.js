// Will It Break: the kid builds the bridge, calls it, and physics decides.
//
// Decisions 2026-10-22 §8, step 1 — the game begins when the kid builds
// the bridge, not when they test ours. Drag from a bank or a tall
// support to lay a line of links; tap a link to send it back. Nothing
// runs until the kid commits to a prediction (the one non-negotiable
// invariant). Then the scaffold comes away, the cargo walks the bridge,
// and the calibration score accumulates. After a bridge that holds, the
// lazy colony lets go of every link the cargo never needed, and they go
// back for the next build.
//
// Step 2 — the bridge wears a skin (skins/), and every skin performs the
// same strain language (engine/strain.js, drawn by render.js). The
// costume buttons flip the very same physics between skins at any
// moment, with the same numbers on screen: the costume changes, the
// physics doesn't. Nothing in this file decides an outcome, and no skin
// is ever handed to the physics.
//
// Step 3 — costumes an educator makes in the costume portal
// (demo/portal.html) from allowlisted CC models join the row, checked as
// manifests again here, and their models are credited under the game.

import {
  SPAN_GAP,
  MATERIALS,
  validateSkin,
  applyGrant,
  replayGrants,
  validateGrant,
  makeBlueprint,
  checkLink,
  addLink,
  removeLink,
  hasLink,
  isHeld,
  inBounds,
  antsLeft,
  stockLeft,
  fixtureLinks,
  pruneLoose,
  linkKey,
  pointKey,
  buildModel,
  findRoute,
  makeCrossing,
  advanceCrossing,
  cargoPosition,
  crossingCases,
  shedSteps,
  activeMembers,
  utilization,
  makeJournal,
  record,
  calibration,
  makeLadder,
  STRAIN,
} from '../engine/index.js';
import { SKINS } from '../skins/index.js';
import {
  S,
  tx,
  ty,
  fromPx,
  drawScene,
  drawMaterialLink,
  drawGenericCargo,
  drawGrid,
  drawRoute,
  drawRing,
  drawDragLine,
  drawLink,
  drawJoints,
  drawCargo,
  cargoPx,
  genericCargoPx,
  spawnDebris,
  stepDebris,
  drawDebris,
  drawNumbers,
  drawCaption,
  restingLink,
} from './render.js';
import { writeCredits } from './credits.js';
import {
  cargoDress,
  cargoIndexOf,
  collidingLinks,
  shedRemovable,
  worldMembers,
} from './variant.js';

// The archetype is the base; the level in play may be a variant of it —
// the base plus the grants the coach has given, frozen, with its own id
// (decisions 2026-10-25 §2). Everything honest about the game comes from
// LEVEL; everything a costume is checked against comes from BASE, because
// a skin dresses the archetype and never the grants (§6: a skin validates
// against the base, and granted cargo renders generically).
const BASE = SPAN_GAP;
let LEVEL = BASE;
const COSTUMES = SKINS.map((s) => validateSkin(s, BASE)); // a bad skin fails loudly, here
const SLOW_MO_FRAMES = 75; // after the first snap, the fall plays at quarter speed
const RESULT_DELAY = 70; // frames of falling before the verdict is read out
const SHED_EVERY = 20; // frames between links letting go
const SHED_BUDGET_MS = 8; // the colony's thinking time per frame
const BANNER_FRAMES = 160; // how long "the costume changed" stays up
const GRAB = 0.032; // m: how close to a dot counts as on it
const TAP = 0.022; // m: how close to a link counts as tapping it
const FINGER = 18; // px on screen: neither may shrink below a fingertip
const SCALE = BASE.measure; // the archetype's frozen instrument — a variant keeps it
const SCALE_G = Math.round(SCALE.max * 1000);
const RES_G = Math.round(SCALE.resolution * 1000);
const MEASURE_BUDGET_MS = 10; // the scale's thinking time per frame

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const $ = (id) => document.getElementById(id);
const world = (p) => ({ x: p[0] * LEVEL.step, y: p[1] * LEVEL.step });

let frogIndex = 1;
let design = makeBlueprint();
const history = []; // undo: earlier link lists
let phase; // 'build' | 'measuring' | 'testing' | 'result' | 'shedding'
let mode = 'feel'; // 'feel': holds/breaks · 'measure': a band in grams
let prediction = null; // 'holds' | 'breaks'
let measure = null; // the live measure round: ladder, band, probe, reading
let run = null; // the live test: model, crossing, snap, shed
let drag = null; // laying links: { at, placed, before }
let tap = null; // a tap that may send a link home: { link, x, y }
let pointer = null; // world position under the mouse, for hover hints
let notice = null; // a placement refusal to show while dragging
let skin = COSTUMES[0];
let stockPick = null; // the granted material the next link is made of; null = the jar's own
let numbers = false; // the educator's view: every link's pull, in numbers
let banner = 0; // frames left on "the costume changed"
const debris = []; // pictures of links that let go, on their way down
let message = () => ''; // the message line, as words to re-say in any skin

// --- Storage: per-viewer conveniences, wrapped; fine without them -------

// The commitment journal is the real log (engine/journal.js); the
// kid-visible stat is calibration(), the prestige score.
const journal = makeJournal();
try {
  const saved = JSON.parse(localStorage.getItem('willitbreak-journal'));
  if (Array.isArray(saved)) {
    for (const e of saved.slice(-200)) record(journal, e);
  }
} catch {
  /* fresh journal */
}
function saveJournal() {
  try {
    localStorage.setItem('willitbreak-journal', JSON.stringify(journal.entries.slice(-200)));
  } catch {
    /* fine */
  }
}

// A stored design is replayed through the placement rules, in as many
// passes as it takes, so nothing invalid ever reaches the model. A
// link's material tag comes back with it: granted stock is budgeted
// apart from the jar (decisions 2026-10-25 §2).
function replay(links) {
  const bp = makeBlueprint();
  let pending = Array.isArray(links) ? links : [];
  for (;;) {
    const left = pending.filter(([p, q, mat]) => addLink(LEVEL, bp, p, q, mat ?? null) !== null);
    if (left.length === pending.length) return bp;
    pending = left;
  }
}
// Costumes made in the portal on this device. The game trusts no stored
// file: each is checked as a manifest again, and one that fails is left
// out with a note in the console, never fatal. A starter's id can't be
// taken.
const MADE = 'willitbreak-costumes';
let made = new Map(); // id → [the stored text, the checked costume]
let costumes = COSTUMES;
function loadCostumes() {
  let stored = [];
  try {
    stored = JSON.parse(localStorage.getItem(MADE)) ?? [];
  } catch {
    /* none */
  }
  const next = new Map();
  for (const s of Array.isArray(stored) ? stored : []) {
    const id = s?.id;
    if (next.has(id) || COSTUMES.some((c) => c.id === id)) continue;
    const text = JSON.stringify(s);
    const kept = made.get(id);
    if (kept && kept[0] === text) {
      next.set(id, kept); // unchanged: keep it, pictures already decoded
      continue;
    }
    try {
      next.set(id, [text, validateSkin(s, BASE)]);
    } catch (e) {
      console.warn(`A saved costume was left out. ${e.message}`);
    }
  }
  made = next;
  costumes = [...COSTUMES, ...[...made.values()].map(([, c]) => c)];
}
loadCostumes();

// The grants the coach has given, kept as the ordered list the engine
// replays (never a level object): a reload comes back to the same
// variant, so the branch the kid was granted is still there and their
// links still have it to hold (decisions 2026-10-25 §2). A stored list
// that no longer replays is dropped whole — the base level always plays.
const GRANTS = 'willitbreak-grants';
try {
  const stored = JSON.parse(localStorage.getItem(GRANTS));
  if (Array.isArray(stored) && stored.length > 0) LEVEL = replayGrants(BASE.id, stored);
} catch (e) {
  console.warn(`The granted things could not be set out again. ${e.message}`);
  LEVEL = BASE;
}

try {
  design = replay(JSON.parse(localStorage.getItem('willitbreak-design'))?.links);
  const prefs = JSON.parse(localStorage.getItem('willitbreak-view')) ?? {};
  skin = costumes.find((s) => s.id === prefs.skin) ?? skin;
  numbers = prefs.numbers === true;
  mode = prefs.mode === 'measure' ? 'measure' : 'feel';
} catch {
  /* start empty, in the first costume */
}
function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* fine */
  }
}
const saveDesign = () => save('willitbreak-design', design);
const saveGrants = () => save(GRANTS, LEVEL.grants ?? []);
const saveView = () => save('willitbreak-view', { skin: skin.id, numbers, mode });

// A prediction is only a prediction if the kid hasn't seen that exact
// bridge carry that exact cargo — in any costume. Seen setups come back
// from the journal.
function hash(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
// Measure-mode setups are keyed apart from feel-mode ones: the same
// bridge is a new commitment when the question changes (decisions
// 2026-10-24 §4).
function levelId() {
  return mode === 'measure' ? `${LEVEL.id}:measure` : `${LEVEL.id}:${LEVEL.cargo[frogIndex] * 1000}g`;
}
function setupKey() {
  const links = design.links.map(([p, q]) => linkKey(p, q)).sort();
  return `${levelId()}:${hash(links.join(';')).toString(16)}`;
}
const seen = new Set(journal.entries.map((e) => e.setup).filter(Boolean));

// --- Words: the skin names things; the numbers come from the archetype ----

const w = () => skin.words;
const cap = (s) => s[0].toUpperCase() + s.slice(1);
const an = (s) => `${/^[aeiou]/i.test(s) ? 'an' : 'a'} ${s}`;
const some = (n) => `${n} ${n === 1 ? w().link : w().links}`;
const stockWord = (mat) => mat ?? w().link;

// What is left of each granted material (decisions 2026-10-25 §2):
// stock is budgeted apart from the jar, and the kid can see both.
function stockText() {
  return Object.keys(LEVEL.stock ?? {})
    .map((n) => `${n}: ${stockLeft(LEVEL, design, n)}`)
    .join(' · ');
}

// Which picture dresses which rung of the cargo ladder — recomputed
// whenever a grant grows the ladder. A granted creature has no picture
// (costume null) and is drawn generically, by name (decisions
// 2026-10-25 §6).
let dress = cargoDress(LEVEL, BASE);
function rung(i) {
  return dress[i] ?? dress[0];
}
function rungName(i = frogIndex) {
  const d = rung(i);
  return d.costume === null ? d.name : skin.cargo[d.costume].name;
}
function cargoName() {
  return `${rungName()} (${Math.round(LEVEL.cargo[frogIndex] * 1000)} g)`;
}

function say(words) {
  message = words;
  $('msg').textContent = words();
}

// Everything on the page that names a thing, in the current costume.
function relabel() {
  $('title').textContent = `Will It Break? ${skin.cargo[0].glyph ?? ''}${skin.icon}`;
  $('subtitle').textContent = `Build a bridge of ${w().links}. ${cap(an(w().cargo))} wants to cross.`;
  $('smaller').textContent = `Smaller ${w().cargo}`;
  $('bigger').textContent = `Bigger ${w().cargo}`;
  $('shed').textContent = `Shed the lazy ${w().links}`;
  $('cargoWord').textContent = mode === 'measure' ? 'Scale' : cap(w().cargo);
  $('linksWord').textContent = cap(w().links);
  $('jarWord').textContent = w().jar;
  $('linkWord').textContent = w().link;
  $('frog').textContent = mode === 'measure' ? `reads to ${SCALE_G} g` : cargoName();
  writeCredits($('credit'), skin);
  for (const b of document.querySelectorAll('[data-skin]')) {
    b.setAttribute('aria-pressed', String(b.dataset.skin === skin.id));
  }
  $('numbers').setAttribute('aria-pressed', String(numbers));
  $('feel').setAttribute('aria-pressed', String(mode === 'feel'));
  $('measure').setAttribute('aria-pressed', String(mode === 'measure'));
  $('msg').textContent = message();
}

// --- Building ------------------------------------------------------------

// Undo keeps the material tag: a plank put back is a plank, and the
// stock it was paid from is what it goes back to (decisions 2026-10-25
// §7.3).
function snapshot() {
  return design.links.map(([p, q, mat]) => (mat ? [[...p], [...q], mat] : [[...p], [...q]]));
}
function pushUndo(links) {
  history.push(links);
  if (history.length > 100) history.shift();
}

// A reach in meters, never smaller than a fingertip on screen (the canvas
// scales down on a tablet), and never so big that two dots — or a dot
// and the middle of a link — could both claim the same touch.
function reach(meters, cap) {
  const scale = canvas.getBoundingClientRect().width / canvas.width;
  return Math.min(cap, Math.max(meters, FINGER / scale / S));
}

function nearestPoint(x, y) {
  const p = [Math.round(x / LEVEL.step), Math.round(y / LEVEL.step)];
  if (!inBounds(LEVEL, p)) return null;
  const at = world(p);
  return Math.hypot(at.x - x, at.y - y) <= reach(GRAB, 0.45 * LEVEL.step) ? p : null;
}

function linkAt(x, y) {
  let best = null;
  let bestD = reach(TAP, 0.3 * LEVEL.step);
  for (const [p, q] of design.links) {
    const a = world(p);
    const b = world(q);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const t = ((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy);
    if (t < 0.15 || t > 0.85) continue; // near a dot means building, not tapping
    const d = Math.hypot(a.x + t * dx - x, a.y + t * dy - y);
    if (d < bestD) {
      best = [p, q];
      bestD = d;
    }
  }
  return best;
}

const REFUSALS = {
  'no-stock': () => `That is all the ${stockWord(stockPick)} there is. Ask the coach for more, or build with ${w().links}.`,
  'unknown-material': () => `There is none of that to build with.`,
  'nothing-to-hold': () =>
    `${cap(w().links)} need something to hold: start from ${an(w().bank)}, ${an(w().support)}, or your bridge.`,
  'both-anchored': () =>
    `The ${w().bank} and the ${w().support} already hold each other. Send the ${w().links} out over the gap.`,
  'jar-empty': () =>
    `The ${w().jar} is empty! Tap one of your ${w().links} to send it back, then build somewhere else.`,
  'out-of-bounds': () => `That is as far as the ${w().links} can reach.`,
};

// Walk the drag one dot at a time toward the pointer, laying a link on
// every step that doesn't have one yet.
function layToward(q) {
  while (q[0] !== drag.at[0] || q[1] !== drag.at[1]) {
    const next = [
      drag.at[0] + Math.sign(q[0] - drag.at[0]),
      drag.at[1] + Math.sign(q[1] - drag.at[1]),
    ];
    if (!hasLink(design, drag.at, next)) {
      const why = checkLink(LEVEL, design, drag.at, next, stockPick);
      if (why) {
        notice = REFUSALS[why] ?? null;
        if (notice) say(notice); // say so mid-drag
        return;
      }
      if (drag.placed === 0) pushUndo(drag.before);
      addLink(LEVEL, design, drag.at, next, stockPick);
      drag.placed++;
    }
    drag.at = next;
  }
  notice = null;
}

function sendHome([p, q]) {
  pushUndo(snapshot());
  removeLink(design, p, q);
  const stranded = pruneLoose(LEVEL, design).length;
  saveDesign();
  refresh(
    stranded > 0
      ? () => `Back in the ${w().jar} — and ${some(stranded)} more that had nothing left to hold.`
      : null,
  );
}

function toWorld(e) {
  const r = canvas.getBoundingClientRect();
  return fromPx(((e.clientX - r.left) * canvas.width) / r.width, ((e.clientY - r.top) * canvas.height) / r.height);
}

canvas.addEventListener('pointerdown', (e) => {
  if (phase !== 'build') return;
  const { x, y } = toWorld(e);
  const p = nearestPoint(x, y);
  if (p && isHeld(LEVEL, design, p)) {
    drag = { at: p, placed: 0, before: snapshot() };
    canvas.setPointerCapture(e.pointerId);
  } else if (p) {
    refresh(REFUSALS['nothing-to-hold']);
  } else {
    const link = linkAt(x, y);
    if (link) tap = { link, x, y };
  }
});

canvas.addEventListener('pointermove', (e) => {
  pointer = toWorld(e);
  if (!drag) return;
  const q = nearestPoint(pointer.x, pointer.y);
  if (q) layToward(q);
});

function endPointer(e) {
  if (drag) {
    const placed = drag.placed;
    drag = null;
    if (placed > 0) saveDesign();
    refresh(notice);
    notice = null;
  } else if (tap && e.type === 'pointerup') {
    const { x, y } = toWorld(e);
    if (Math.hypot(x - tap.x, y - tap.y) < reach(TAP, 0.3 * LEVEL.step)) sendHome(tap.link);
  }
  tap = null;
}
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('pointerleave', () => {
  pointer = null;
});

// --- The round -------------------------------------------------------------

function buildPrompt() {
  if (design.links.length === 0) {
    return mode === 'measure'
      ? `Build a bridge to weigh: drag from the ${w().bank} to lay a line of ${w().links} — reach the other side!`
      : `${cargoName()} wants to cross. Drag from the ${w().bank} to lay a line of ${w().links} — reach the other side!`;
  }
  if (!findRoute(LEVEL, design)) {
    return `Keep going — the ${w().cargo} needs ${w().links} all the way to the other ${w().bank}.`;
  }
  if (seen.has(setupKey())) {
    return mode === 'measure'
      ? `You have weighed this bridge. Change it to make a new call.`
      : `You have seen this bridge carry this ${w().cargo}. Change the bridge or the ${w().cargo} to make a new call.`;
  }
  return mode === 'measure'
    ? `How many grams can your bridge carry across? Set your band — say it before the scale says it.`
    : `${cargoName()} wants to cross. Will your bridge hold? Say it before you see it.`;
}

// Buttons follow the phase; the message is whatever just happened (as
// words to say in any skin), or the build prompt.
function refresh(words = null) {
  const building = phase === 'build';
  const measuring = mode === 'measure';
  const callable = building && findRoute(LEVEL, design) !== null && !seen.has(setupKey());
  const frogs = !measuring && (building || phase === 'result');
  $('smaller').disabled = !frogs || frogIndex === 0;
  $('bigger').disabled = !frogs || frogIndex === LEVEL.cargo.length - 1;
  $('undo').disabled = !building || history.length === 0;
  $('clear').disabled = !building || design.links.length === 0;
  $('holds').style.display = measuring ? 'none' : '';
  $('breaks').style.display = measuring ? 'none' : '';
  $('bandbox').style.display = measuring ? '' : 'none';
  $('holds').disabled = !callable;
  $('breaks').disabled = !callable;
  $('lockband').disabled = !callable;
  // The shed stays a feel-mode move: its load cases are the frog ladder's
  // fixed cargo, not the scale's reading.
  $('shed').disabled = !(phase === 'result' && !measuring && run && run.crossing.outcome === 'holds' && !run.shed);
  $('build').disabled = phase !== 'result';
  $('frog').textContent = measuring ? `reads to ${SCALE_G} g` : cargoName();
  stockButtons(); // the counts tick down as links go out
  if (words !== null) say(words);
  else if (building) say(buildPrompt);
}

function toBuild(words = null) {
  phase = 'build';
  run = null;
  measure = null;
  debris.length = 0;
  refresh(words);
}

// --- What the coach grants -------------------------------------------------
//
// A grant stocks the world and never the bridge (decisions 2026-10-25
// §2): it arrives between rounds, makes a new frozen variant of the
// level, and the UI follows it. The one thing it may disturb of the
// kid's is a link sitting exactly where an incoming fixture's members
// go — those walk back to the jar, out loud (fixture library §4.7).
// Nothing here decides an outcome, and the physics only ever hears
// about it through the level the engine itself froze.
function grantWords(grant, moved, stranded) {
  const aside =
    moved > 0
      ? ` ${cap(some(moved))} moved aside — back in the ${w().jar}${
          stranded > 0 ? `, with ${some(stranded)} that had nothing left to hold` : ''
        }.`
      : '';
  switch (grant.kind) {
    case 'cargo':
      return () =>
        `🎁 ${grant.name} is here — ${Math.round(LEVEL.cargo[cargoIndexOf(LEVEL, grant.mass)] * 1000)} g. ` +
        `Use ${w().cargo} bigger and smaller to pick who crosses.${aside}`;
    case 'links':
      return () => `🎁 ${some(grant.count)} more in the ${w().jar}!${aside}`;
    case 'stock':
      return () =>
        `🎁 ${grant.count} ${grant.material} to build with. Pick ${grant.material} under “Build with”, then drag.${aside}`;
    case 'anchor':
      return () =>
        `🎁 ${grant.points.length} new ${grant.points.length === 1 ? 'place' : 'places'} to hold on — ` +
        `start a line of ${w().links} there.${aside}`;
    case 'fixture':
      return () =>
        `🎁 A ${grant.name} is out there now. Your ${w().links} can hold onto it — and it can break too.${aside}`;
    default:
      return () => `🎁 Something new is in the world.${aside}`;
  }
}

// Take a grant into the world. Returns why not, or null when it landed.
function receiveGrant(grant) {
  const why = validateGrant(LEVEL, grant);
  if (why) return why;
  const moved = grant.kind === 'fixture' ? collidingLinks(design, grant.members) : [];
  for (const [p, q] of moved) removeLink(design, p, q);
  const stranded = moved.length > 0 ? pruneLoose(LEVEL, design).length : 0;
  const was = LEVEL.cargo[frogIndex];
  LEVEL = applyGrant(LEVEL, grant);
  dress = cargoDress(LEVEL, BASE);
  frogIndex = cargoIndexOf(LEVEL, was);
  if (stockPick !== null && !(LEVEL.stock?.[stockPick] > 0)) stockPick = null;
  saveGrants();
  if (moved.length > 0) saveDesign();
  stockButtons();
  relabel();
  toBuild(grantWords(grant, moved.length, stranded));
  return null;
}

function startRun(cargoMass) {
  const built = buildModel(LEVEL, design);
  const route = findRoute(LEVEL, design);
  const seedOf = new Map();
  for (const [key, m] of built.memberOf) seedOf.set(m, hash(key));
  run = {
    ...built,
    route,
    // The world's own members: scenery to draw as what it is made of
    // (decisions 2026-10-25, the fixture library §4.6).
    worldSet: worldMembers(built),
    seedOf, // each link moves as itself, in build mode and test alike
    crossing: makeCrossing(built.model, {
      route: route.map((p) => built.nodeOf.get(pointKey(p))),
      cargoMass,
      dryY: LEVEL.dryY,
    }),
    snap: null, // the first link to let go, and where
    slowMo: 0,
    shed: null,
  };
  phase = 'testing';
}

function predict(call) {
  prediction = call;
  startRun(LEVEL.cargo[frogIndex]);
  refresh(() => `You say it ${call === 'holds' ? 'HOLDS' : 'BREAKS'}. The scaffold comes away…`);
}

// --- The scale (measure mode; decisions 2026-10-24) ------------------------
//
// The kid commits a band in grams; the ladder bisects with full, honest
// crossings of their bridge, pumped invisibly a time-budget per frame;
// then the heaviest load that held walks the bridge on stage — the same
// physics, now as theater — and the verdict reads the scale against the
// band.

const toGrid = (g, up) => (up ? Math.ceil(g / RES_G) : Math.floor(g / RES_G)) * RES_G;

function lockBand() {
  const empty = $('lo').value.trim() === '' || $('hi').value.trim() === '';
  const lo = toGrid(Number($('lo').value), false);
  const hi = toGrid(Number($('hi').value), true);
  if (empty || !Number.isFinite(lo) || !Number.isFinite(hi) || lo < 0 || hi < lo || hi > SCALE_G) {
    say(() => `The band needs two numbers: 0 to ${SCALE_G} g, low first.`);
    return;
  }
  measure = {
    ladder: makeLadder(SCALE),
    band: { lo, hi },
    probing: null, // the headless crossing under way
    last: null, // the latest probe, for the narration
    reading: null,
  };
  phase = 'measuring';
  refresh(() => `Locked in: ${lo}–${hi} g. The scale gets to work — every try is a real crossing…`);
}

function measureWords() {
  const p = measure?.last;
  if (!p) return 'The scale is getting ready…';
  return `⚖️ ${p.g} g — ${p.holds ? `the ${w().links} held it.` : 'too heavy!'} The scale narrows in…`;
}

function pumpMeasure() {
  const start = performance.now();
  while (performance.now() - start < MEASURE_BUDGET_MS) {
    if (!measure.probing) {
      const mass = measure.ladder.next();
      if (mass === null) {
        finishLadder();
        return;
      }
      const built = buildModel(LEVEL, design);
      const route = findRoute(LEVEL, design);
      measure.probing = {
        mass,
        crossing: makeCrossing(built.model, {
          route: route.map((p) => built.nodeOf.get(pointKey(p))),
          cargoMass: mass,
          dryY: LEVEL.dryY,
        }),
      };
    }
    const c = measure.probing.crossing;
    advanceCrossing(c);
    if (c.outcome) {
      const holds = c.outcome === 'holds';
      measure.ladder.report(holds);
      measure.last = { g: Math.round(measure.probing.mass * 1000), holds };
      measure.probing = null;
      say(measureWords);
    }
  }
}

function finishLadder() {
  measure.reading = measure.ladder.result();
  const { mass, heldAny } = measure.reading;
  // A zero reading still gets its stage time: the lightest probe snaps
  // in full view, which is the lesson.
  startRun(heldAny ? mass : SCALE.resolution);
  refresh(() => `The scale reads ${Math.round(mass * 1000)} g. Watch it carry that…`);
}

function runCargoName() {
  return mode === 'measure' && run
    ? `the ${Math.round(run.crossing.cargoMass * 1000)} g ${w().cargo}`
    : cargoName();
}

function narrate() {
  const c = run.crossing;
  if (c.phase === 'rest') say(() => `The scaffold is off. The ${w().links} hold on…`);
  if (c.phase === 'walk') say(() => `Here comes ${runCargoName()}…`);
}

// The verdict is kept as facts and said in whatever costume is on, so
// flipping the skin re-words it and changes none of it.
function verdictWords(v) {
  return () => {
    const head = v.correct ? '✅ Called it!' : '❌ Not this time.';
    if (v.outcome === 'holds') {
      return (
        `${head} 💪 It held — ${cargoName()} made it across! The hardest-working ${w().link} was at ` +
        `${v.pct}% of what it can hold. Now — which ${w().links} were even needed?`
      );
    }
    if (v.outcome === 'dunked') {
      const lurker = skin.scene.water.lurkers[0];
      const danger = w().danger.replace('{cargo}', cargoName());
      return `${head} ${lurker} Nothing came apart — but the bridge sagged so low ${danger}.`;
    }
    if (!v.onBridge) {
      return `${head} 💥 It couldn’t even hold itself up: one of the ${w().links} ${w().letGo} before the ${w().cargo} stepped on.`;
    }
    const where = { under: `right under ${cargoName()}`, bank: `near the ${w().bank}`, middle: 'out in the middle' }[v.where];
    return `${head} 💥 It broke. The first ${w().link} ${w().letGo} ${where}.`;
  };
}

// The band verdict is kept as facts and said in whatever costume is on.
function bandVerdictWords(v) {
  return () => {
    const head = v.hit ? '✅ Inside your band!' : '❌ Outside your band.';
    const read = v.maxed
      ? `The scale pinned at its stop — ${v.gRead} g and still holding. More than the scale goes!`
      : v.heldAny
        ? `The scale reads ${v.gRead} g — the heaviest ${w().cargo} your bridge carried across dry.`
        : `The scale reads 0 g — it couldn't carry even the lightest ${w().cargo}.`;
    return `${head} You said ${v.lo}–${v.hi} g. ${read}`;
  };
}

function finishMeasureRound() {
  const { mass, maxed, heldAny } = measure.reading;
  const gRead = Math.round(mass * 1000);
  const { lo, hi } = measure.band;
  const setup = setupKey();
  record(journal, {
    level: levelId(),
    kind: 'band',
    prediction: { lo, hi },
    range: SCALE_G, // the scale's span: every band judged on one ruler
    outcome: gRead,
    buildFailed: !heldAny,
    consultant: null,
    // display metadata; the journal never reads these
    ants: design.links.length,
    setup,
    skin: skin.id,
    at: Date.now(),
  });
  saveJournal();
  seen.add(setup);
  phase = 'result';
  refresh(bandVerdictWords({ hit: gRead >= lo && gRead <= hi, gRead, maxed, heldAny, lo, hi }));
}

function finishRound() {
  if (mode === 'measure' && measure?.reading) {
    finishMeasureRound();
    return;
  }
  const c = run.crossing;
  const actual = c.outcome === 'holds' ? 'holds' : 'breaks';
  const setup = setupKey();
  record(journal, {
    level: levelId(),
    kind: 'binary',
    prediction,
    outcome: actual,
    buildFailed: actual === 'breaks',
    consultant: null,
    // display metadata; the journal never reads these
    ants: design.links.length,
    setup,
    skin: skin.id,
    at: Date.now(),
  });
  saveJournal();
  seen.add(setup);

  const v = {
    correct: prediction === actual,
    outcome: c.outcome,
    onBridge: c.onBridge,
    pct: Math.round(c.peakUtilization * 100),
  };
  if (c.outcome === 'snapped' && c.onBridge) {
    const { member: m, x } = run.snap; // where it let go, not where it fell
    const under = [c.route[c.leg], c.route[c.leg + 1]].some((n) => n === m.a || n === m.b);
    const gap = LEVEL.end[0] * LEVEL.step;
    v.where = under ? 'under' : x < 0.25 * gap || x > 0.75 * gap ? 'bank' : 'middle';
  }
  phase = 'result';
  refresh(verdictWords(v));
}

// The lazy colony, on the kid's own bridge: the links work out who the
// cargo never needed — with the cargo standing on every joint of its
// walk — and those let go one by one. The walkway stays: the cargo walks
// on it.
function startShed() {
  const plan = buildModel(LEVEL, design);
  const walkway = new Set();
  for (let k = 0; k < run.route.length - 1; k++) {
    walkway.add(plan.memberOf.get(linkKey(run.route[k], run.route[k + 1])));
  }
  const cases = crossingCases(
    run.route.map((p) => plan.nodeOf.get(pointKey(p))),
    LEVEL.cargo[frogIndex],
    { dryY: LEVEL.dryY },
  );
  run.shed = {
    steps: shedSteps(plan.model, {
      // The walkway stays, and so does the world (fixture library §4.8).
      removable: shedRemovable(plan, walkway),
      ...cases,
      settleOpts: { maxSteps: 30000 },
    }),
    keyOf: new Map([...plan.memberOf].map(([k, m]) => [m, k])),
    queue: [],
    freed: [],
    result: null,
    timer: 0,
  };
  phase = 'shedding';
  refresh(() => `Watch: the ${w().links} are working out who is lazy…`);
}

function pumpShed() {
  const s = run.shed;
  const start = performance.now();
  while (!s.result && performance.now() - start < SHED_BUDGET_MS) {
    const { done, value } = s.steps.next();
    if (done) s.result = value;
    else if (value.removed) s.queue.push(s.keyOf.get(value.removed));
  }
  if (s.queue.length > 0 && ++s.timer >= SHED_EVERY) {
    s.timer = 0;
    const key = s.queue.shift();
    const m = run.memberOf.get(key);
    m.broken = true;
    m.force = 0;
    s.freed.push(key);
  }
  if (s.result && s.queue.length === 0) finishShed();
}

function finishShed() {
  const { result, freed } = run.shed;
  if (!result.feasible) {
    phase = 'result';
    refresh(() => `This bridge is right at its limit — every ${w().link} is needed.`);
    return;
  }
  if (freed.length === 0) {
    phase = 'result';
    refresh(() => `Every ${w().link} is needed. No one gets to be lazy.`);
    return;
  }
  pushUndo(snapshot());
  const had = design.links.length;
  for (const key of freed) {
    const [p, q] = key.split('|').map((s) => s.split(',').map(Number));
    removeLink(design, p, q);
  }
  pruneLoose(LEVEL, design);
  saveDesign();
  const back = had - design.links.length;
  toBuild(
    () =>
      `Done: ${some(back)} back in your ${w().jar}. ` +
      `Will the lean bridge still hold ${cargoName()}? Say it before you see it.`,
  );
}

// Near the limit the cargo walks at a third of its pace, so the slipping
// gets its stage time. A quasi-static crossing's outcome never depends
// on pace (engine/crossing.js), so this is drama, not physics.
function pace() {
  if (phase !== 'testing' || run.crossing.phase !== 'walk') return 1;
  let u = 0;
  for (const m of activeMembers(run.model)) u = Math.max(u, utilization(m));
  return u >= STRAIN.slip ? 3 : 1;
}

let frames = 0;
function tick() {
  frames++;
  if (run && frames % pace() === 0) {
    const before = run.crossing.phase;
    const slow = run.slowMo > 0;
    if (slow) run.slowMo--;
    const substeps = slow ? 6 : run.crossing.timing.substeps;
    const broke = advanceCrossing(run.crossing, { substeps });
    for (const m of broke) {
      // The costume's pictures are the costume's: a snapped plank or a
      // granted branch is not a shower of ants, so it simply goes.
      if (m.material === LEVEL.material && !run.worldSet.has(m)) {
        spawnDebris(debris, LEVEL, skin, m, { seed: run.seedOf.get(m) ?? 0 });
      }
    }
    if (broke.length > 0 && !run.snap) {
      // Pin where the failure started; the pieces will fall away from it.
      const { a, b } = broke[0];
      run.snap = { member: broke[0], x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      run.slowMo = SLOW_MO_FRAMES;
    }
    // The pieces fall on the sim's own clock, slow motion included.
    stepDebris(debris, LEVEL, substeps * run.crossing.timing.dt, run.model.gravity);
    if (phase === 'testing') {
      const c = run.crossing;
      if (c.phase !== before) narrate();
      if (c.outcome && (c.outcome === 'holds' || c.overFrames >= RESULT_DELAY)) finishRound();
    } else if (phase === 'shedding') {
      pumpShed();
    }
  }
  if (phase === 'measuring') pumpMeasure();
  if (banner > 0) banner--;
  draw();
  requestAnimationFrame(tick);
}

// --- Drawing ---------------------------------------------------------------

function drawBlueprint(t) {
  drawGrid(ctx, LEVEL, skin);
  const route = findRoute(LEVEL, design);
  if (route) drawRoute(ctx, LEVEL, route);

  // The world first, under everything: whatever the coach has built out
  // there, drawn as the material it is made of.
  for (const [p, q, mat] of fixtureLinks(LEVEL)) {
    drawMaterialLink(ctx, LEVEL, restingLink(LEVEL, p, q, mat), { world: true });
  }
  for (const [p, q, mat] of design.links) {
    const m = restingLink(LEVEL, p, q, mat);
    // A link of granted stock is not the material any costume was
    // authored for, so it wears its own (coach arrives §7.3).
    if (mat) drawMaterialLink(ctx, LEVEL, m);
    else drawLink(ctx, LEVEL, skin, m, { t, seed: hash(linkKey(p, q)) });
  }
  const joints = new Map();
  for (const [p, q] of design.links) {
    for (const r of [p, q]) joints.set(pointKey(r), world(r));
  }
  drawJoints(ctx, LEVEL, skin, joints.values());

  const hovered = !drag && pointer ? linkAt(pointer.x, pointer.y) : null;
  if (hovered) {
    // the link a tap would send home
    const [a, b] = hovered.map(world);
    ctx.strokeStyle = 'rgba(192, 80, 60, 0.55)';
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.moveTo(tx(a.x), ty(a.y));
    ctx.lineTo(tx(b.x), ty(b.y));
    ctx.stroke();
  }
  const p = pointer && nearestPoint(pointer.x, pointer.y);
  if (p && !hovered) drawRing(ctx, LEVEL, p, isHeld(LEVEL, design, p) ? '#2f7d32' : 'rgba(160, 60, 40, 0.6)');
  if (drag && pointer) drawDragLine(ctx, LEVEL, drag.at, pointer);
}

function drawTest(t) {
  const c = run.crossing;
  // After a crossing that held, each link glows with the hardest it
  // pulled while the cargo crossed: that is where the load went.
  const showPeak = c.outcome === 'holds';
  const members = activeMembers(run.model);
  const heatOf = (m) => (showPeak ? c.peak.get(m) ?? 0 : undefined);
  for (const m of members) {
    if (run.worldSet.has(m)) drawMaterialLink(ctx, LEVEL, m, { heat: heatOf(m), world: true });
  }
  const joints = new Set();
  for (const m of members) {
    if (run.worldSet.has(m)) continue;
    if (m.material !== LEVEL.material) drawMaterialLink(ctx, LEVEL, m, { heat: heatOf(m) });
    else drawLink(ctx, LEVEL, skin, m, { t, seed: run.seedOf.get(m) ?? 0, heat: heatOf(m) });
    joints.add(m.a).add(m.b);
  }
  drawJoints(ctx, LEVEL, skin, joints);
  drawDebris(ctx, LEVEL, skin, debris);
  if (run.snap) {
    ctx.font = '28px serif';
    ctx.fillText('💥', tx(run.snap.x) - 14, ty(run.snap.y) + 10);
  }
}

// On the scale, the cargo's picture is the biggest costume cargo at or
// under the live mass — the picture is costume, the mass is the physics.
function displayFrogIndex() {
  if (!(mode === 'measure' && run)) return frogIndex;
  let i = 0;
  for (let k = 0; k < LEVEL.cargo.length; k++) {
    if (LEVEL.cargo[k] <= run.crossing.cargoMass) i = k;
  }
  return i;
}

// The cargo on stage: a base rung in its costume, a granted creature
// generically, by name (decisions 2026-10-25 §6). BASE is handed to the
// renderer on purpose — on a variant a costume's pictures and the
// level's cargo ladder no longer share an index (demo/variant.js), and
// every size stays measured off the archetype's lightest rung.
function showCargo(i, pos) {
  const d = rung(i);
  if (d.costume === null) drawGenericCargo(ctx, BASE, skin, d, pos);
  else drawCargo(ctx, BASE, skin, d.costume, pos);
}
function cargoPxOf(i) {
  const d = rung(i);
  return d.costume === null ? genericCargoPx(BASE, d.mass) : cargoPx(BASE, skin, d.costume);
}

function cargoAt() {
  let pos = { x: -0.08, y: 0 };
  if (run) {
    const c = run.crossing;
    if (c.onBridge) pos = cargoPosition(c);
    else if (c.phase === 'rest') pos.x = -0.08 * (1 - Math.min(1, c.frame / c.timing.restFrames));
    if (c.outcome === 'holds') {
      const end = world(LEVEL.end); // and off onto the far bank
      pos = { x: end.x + 0.08 * Math.min(1, c.overFrames / 20), y: end.y };
    }
  }
  return pos;
}

function draw() {
  const t = performance.now() / 1000;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawScene(ctx, LEVEL, skin);
  if (phase === 'build' || phase === 'measuring') drawBlueprint(t);
  else drawTest(t);
  const pos = cargoAt();
  const shown = displayFrogIndex();
  showCargo(shown, pos);

  if (numbers) {
    const c = run?.crossing;
    const members = run ? activeMembers(run.model) : [];
    const valueOf = (m) => (c.outcome === 'holds' ? c.peak.get(m) ?? 0 : utilization(m));
    drawNumbers(ctx, LEVEL, skin, members, valueOf, {
      pos,
      grams: Math.round(LEVEL.cargo[shown] * 1000),
      px: cargoPxOf(shown),
    });
  }
  if (banner > 0) {
    drawCaption(ctx, LEVEL, skin, 'The costume changed. The physics didn’t.', Math.min(1, banner / 30));
  } else if (phase === 'measuring') {
    drawCaption(ctx, LEVEL, skin, 'The scale is working — every try is a real crossing');
  } else if (run && run.crossing.outcome === 'holds') {
    drawCaption(ctx, LEVEL, skin, `Colors show how hard each ${w().link} pulled while the ${w().cargo} crossed`);
  }

  if (phase === 'build' || phase === 'measuring') {
    $('working').textContent = design.links.length;
    $('jar').textContent = antsLeft(LEVEL, design);
    $('maxu').textContent = '—';
    $('stockbox').textContent = stockText();
  } else {
    $('working').textContent = activeMembers(run.model).length;
    $('jar').textContent = antsLeft(LEVEL, design) + (run.shed ? run.shed.freed.length : 0);
    $('maxu').textContent = `${Math.round(run.crossing.peakUtilization * 100)}%`;
    $('stockbox').textContent = stockText();
  }
  const cal = calibration(journal);
  $('calib').textContent = cal.total === 0 ? '—' : `${cal.hits}/${cal.total} right · streak ${cal.streak}`;
}

// --- Controls --------------------------------------------------------------

function changeFrog(delta) {
  frogIndex = Math.max(0, Math.min(LEVEL.cargo.length - 1, frogIndex + delta));
  toBuild();
}
$('smaller').onclick = () => changeFrog(-1);
$('bigger').onclick = () => changeFrog(1);
$('undo').onclick = () => {
  if (history.length === 0) return;
  design = makeBlueprint(history.pop());
  saveDesign();
  refresh();
};
$('clear').onclick = () => {
  pushUndo(snapshot());
  design = makeBlueprint();
  saveDesign();
  refresh();
};
$('holds').onclick = () => predict('holds');
$('breaks').onclick = () => predict('breaks');
$('lockband').onclick = lockBand;
$('shed').onclick = startShed;
$('build').onclick = () => toBuild();

// The mode is part of the commitment: it only changes between rounds,
// never once a call or a band is locked in.
function setMode(m) {
  if (m === mode || (phase !== 'build' && phase !== 'result')) return;
  mode = m;
  saveView();
  relabel();
  toBuild();
}
$('feel').onclick = () => setMode('feel');
$('measure').onclick = () => setMode('measure');
for (const id of ['lo', 'hi']) {
  $(id).step = RES_G;
  $(id).max = SCALE_G;
}

const numbersButton = document.createElement('button');
numbersButton.id = 'numbers';
numbersButton.textContent = 'Show the numbers';
numbersButton.onclick = () => {
  numbers = !numbers;
  saveView();
  relabel();
};
$('skins').append(numbersButton);

// The costumes: any time, mid-crossing included. The physics never
// hears about it.
function wear(s) {
  if (s === skin) return;
  skin = s;
  banner = BANNER_FRAMES;
  saveView();
  relabel();
}
// Build with: the jar's own creatures, or a granted stash. The picker
// only exists once something has been granted to build with (coach
// arrives §7.3).
function stockButtons() {
  const row = $('stockrow');
  for (const b of row.querySelectorAll('[data-mat]')) b.remove();
  const names = Object.keys(LEVEL.stock ?? {});
  row.hidden = names.length === 0;
  if (names.length === 0) {
    stockPick = null;
    return;
  }
  for (const mat of [null, ...names]) {
    const b = document.createElement('button');
    b.dataset.mat = mat ?? '';
    b.textContent = mat
      ? `${mat} (${stockLeft(LEVEL, design, mat)})`
      : `${cap(w().links)} (${antsLeft(LEVEL, design)})`;
    b.setAttribute('aria-pressed', String(mat === stockPick));
    b.onclick = () => {
      stockPick = mat;
      stockButtons();
      refresh(() =>
        mat === null
          ? `Dragging lays ${w().links} from the ${w().jar}.`
          : `Dragging lays ${mat}. ${cap(stockText())} left.`,
      );
    };
    row.append(b);
  }
}

function costumeButtons() {
  for (const b of document.querySelectorAll('[data-skin]')) b.remove();
  for (const s of costumes) {
    const b = document.createElement('button');
    b.dataset.skin = s.id;
    b.textContent = `${s.icon} ${s.name}`;
    b.onclick = () => wear(s);
    numbersButton.before(b);
  }
}
costumeButtons();
stockButtons();

// The portal saves in another tab; its costumes arrive here as it does.
// One being worn that was changed is put on again, and one deleted is
// taken off.
addEventListener('storage', (e) => {
  if (e.key !== MADE && e.key !== null) return;
  loadCostumes();
  costumeButtons();
  const now = costumes.find((s) => s.id === skin.id) ?? COSTUMES[0];
  if (now !== skin) {
    skin = now;
    banner = BANNER_FRAMES;
    saveView();
  }
  relabel();
});

toBuild();
relabel();
tick();
