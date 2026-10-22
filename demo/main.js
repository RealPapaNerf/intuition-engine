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

import {
  SPAN_GAP,
  validateSkin,
  makeBlueprint,
  checkLink,
  addLink,
  removeLink,
  hasLink,
  isHeld,
  inBounds,
  antsLeft,
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
  STRAIN,
} from '../engine/index.js';
import { SKINS } from '../skins/index.js';
import {
  S,
  tx,
  ty,
  fromPx,
  drawScene,
  drawGrid,
  drawRoute,
  drawRing,
  drawDragLine,
  drawLink,
  drawJoints,
  drawCargo,
  spawnDebris,
  stepDebris,
  drawDebris,
  drawNumbers,
  drawCaption,
  restingLink,
} from './render.js';

const LEVEL = SPAN_GAP;
const COSTUMES = SKINS.map((s) => validateSkin(s, LEVEL)); // a bad skin fails loudly, here
const SLOW_MO_FRAMES = 75; // after the first snap, the fall plays at quarter speed
const RESULT_DELAY = 70; // frames of falling before the verdict is read out
const SHED_EVERY = 20; // frames between links letting go
const SHED_BUDGET_MS = 8; // the colony's thinking time per frame
const BANNER_FRAMES = 160; // how long "the costume changed" stays up
const GRAB = 0.032; // m: how close to a dot counts as on it
const TAP = 0.022; // m: how close to a link counts as tapping it
const FINGER = 18; // px on screen: neither may shrink below a fingertip

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const $ = (id) => document.getElementById(id);
const world = (p) => ({ x: p[0] * LEVEL.step, y: p[1] * LEVEL.step });

let frogIndex = 1;
let design = makeBlueprint();
const history = []; // undo: earlier link lists
let phase; // 'build' | 'testing' | 'result' | 'shedding'
let prediction = null; // 'holds' | 'breaks'
let run = null; // the live test: model, crossing, snap, shed
let drag = null; // laying links: { at, placed, before }
let tap = null; // a tap that may send a link home: { link, x, y }
let pointer = null; // world position under the mouse, for hover hints
let notice = null; // a placement refusal to show while dragging
let skin = COSTUMES[0];
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
// passes as it takes, so nothing invalid ever reaches the model.
function replay(links) {
  const bp = makeBlueprint();
  let pending = Array.isArray(links) ? links : [];
  for (;;) {
    const left = pending.filter(([p, q]) => addLink(LEVEL, bp, p, q) !== null);
    if (left.length === pending.length) return bp;
    pending = left;
  }
}
try {
  design = replay(JSON.parse(localStorage.getItem('willitbreak-design'))?.links);
  const prefs = JSON.parse(localStorage.getItem('willitbreak-view')) ?? {};
  skin = COSTUMES.find((s) => s.id === prefs.skin) ?? skin;
  numbers = prefs.numbers === true;
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
const saveView = () => save('willitbreak-view', { skin: skin.id, numbers });

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
function levelId() {
  return `${LEVEL.id}:${LEVEL.cargo[frogIndex] * 1000}g`;
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
function cargoName() {
  return `${skin.cargo[frogIndex].name} (${Math.round(LEVEL.cargo[frogIndex] * 1000)} g)`;
}

function say(words) {
  message = words;
  $('msg').textContent = words();
}

// Everything on the page that names a thing, in the current costume.
function relabel() {
  $('title').textContent = `Will It Break? ${skin.cargo[0].glyph}${skin.icon}`;
  $('subtitle').textContent = `Build a bridge of ${w().links}. ${cap(an(w().cargo))} wants to cross.`;
  $('smaller').textContent = `Smaller ${w().cargo}`;
  $('bigger').textContent = `Bigger ${w().cargo}`;
  $('shed').textContent = `Shed the lazy ${w().links}`;
  $('cargoWord').textContent = cap(w().cargo);
  $('linksWord').textContent = cap(w().links);
  $('jarWord').textContent = w().jar;
  $('linkWord').textContent = w().link;
  $('frog').textContent = cargoName();
  $('credit').textContent = `Costume: ${skin.name} — ${skin.attribution}.`;
  for (const b of document.querySelectorAll('[data-skin]')) {
    b.setAttribute('aria-pressed', String(b.dataset.skin === skin.id));
  }
  $('numbers').setAttribute('aria-pressed', String(numbers));
  $('msg').textContent = message();
}

// --- Building ------------------------------------------------------------

function snapshot() {
  return design.links.map(([p, q]) => [[...p], [...q]]);
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
      const why = checkLink(LEVEL, design, drag.at, next);
      if (why) {
        notice = REFUSALS[why] ?? null;
        if (notice) say(notice); // say so mid-drag
        return;
      }
      if (drag.placed === 0) pushUndo(drag.before);
      addLink(LEVEL, design, drag.at, next);
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
    return `${cargoName()} wants to cross. Drag from the ${w().bank} to lay a line of ${w().links} — reach the other side!`;
  }
  if (!findRoute(LEVEL, design)) {
    return `Keep going — the ${w().cargo} needs ${w().links} all the way to the other ${w().bank}.`;
  }
  if (seen.has(setupKey())) {
    return `You have seen this bridge carry this ${w().cargo}. Change the bridge or the ${w().cargo} to make a new call.`;
  }
  return `${cargoName()} wants to cross. Will your bridge hold? Say it before you see it.`;
}

// Buttons follow the phase; the message is whatever just happened (as
// words to say in any skin), or the build prompt.
function refresh(words = null) {
  const building = phase === 'build';
  const callable = building && findRoute(LEVEL, design) !== null && !seen.has(setupKey());
  const frogs = building || phase === 'result';
  $('smaller').disabled = !frogs || frogIndex === 0;
  $('bigger').disabled = !frogs || frogIndex === LEVEL.cargo.length - 1;
  $('undo').disabled = !building || history.length === 0;
  $('clear').disabled = !building || design.links.length === 0;
  $('holds').disabled = !callable;
  $('breaks').disabled = !callable;
  $('shed').disabled = !(phase === 'result' && run.crossing.outcome === 'holds' && !run.shed);
  $('build').disabled = phase !== 'result';
  $('frog').textContent = cargoName();
  if (words !== null) say(words);
  else if (building) say(buildPrompt);
}

function toBuild(words = null) {
  phase = 'build';
  run = null;
  debris.length = 0;
  refresh(words);
}

function predict(call) {
  prediction = call;
  const built = buildModel(LEVEL, design);
  const route = findRoute(LEVEL, design);
  const seedOf = new Map();
  for (const [key, m] of built.memberOf) seedOf.set(m, hash(key));
  run = {
    ...built,
    route,
    seedOf, // each link moves as itself, in build mode and test alike
    crossing: makeCrossing(built.model, {
      route: route.map((p) => built.nodeOf.get(pointKey(p))),
      cargoMass: LEVEL.cargo[frogIndex],
      dryY: LEVEL.dryY,
    }),
    snap: null, // the first link to let go, and where
    slowMo: 0,
    shed: null,
  };
  phase = 'testing';
  refresh(() => `You say it ${call === 'holds' ? 'HOLDS' : 'BREAKS'}. The scaffold comes away…`);
}

function narrate() {
  const c = run.crossing;
  if (c.phase === 'rest') say(() => `The scaffold is off. The ${w().links} hold on…`);
  if (c.phase === 'walk') say(() => `Here comes ${cargoName()}…`);
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

function finishRound() {
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
      removable: (m) => !walkway.has(m),
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
      spawnDebris(debris, LEVEL, skin, m, { seed: run.seedOf.get(m) ?? 0 });
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
  if (banner > 0) banner--;
  draw();
  requestAnimationFrame(tick);
}

// --- Drawing ---------------------------------------------------------------

function drawBlueprint(t) {
  drawGrid(ctx, LEVEL, skin);
  const route = findRoute(LEVEL, design);
  if (route) drawRoute(ctx, LEVEL, route);

  for (const [p, q] of design.links) {
    drawLink(ctx, LEVEL, skin, restingLink(LEVEL, p, q), { t, seed: hash(linkKey(p, q)) });
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
  for (const m of members) {
    drawLink(ctx, LEVEL, skin, m, {
      t,
      seed: run.seedOf.get(m) ?? 0,
      heat: showPeak ? c.peak.get(m) ?? 0 : undefined,
    });
  }
  const joints = new Set();
  for (const m of members) joints.add(m.a).add(m.b);
  drawJoints(ctx, LEVEL, skin, joints);
  drawDebris(ctx, LEVEL, skin, debris);
  if (run.snap) {
    ctx.font = '28px serif';
    ctx.fillText('💥', tx(run.snap.x) - 14, ty(run.snap.y) + 10);
  }
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
  if (phase === 'build') drawBlueprint(t);
  else drawTest(t);
  const pos = cargoAt();
  drawCargo(ctx, LEVEL, skin, frogIndex, pos);

  if (numbers) {
    const c = run?.crossing;
    const members = run ? activeMembers(run.model) : [];
    const valueOf = (m) => (c.outcome === 'holds' ? c.peak.get(m) ?? 0 : utilization(m));
    drawNumbers(ctx, LEVEL, skin, members, valueOf, { index: frogIndex, pos });
  }
  if (banner > 0) {
    drawCaption(ctx, LEVEL, skin, 'The costume changed. The physics didn’t.', Math.min(1, banner / 30));
  } else if (run && run.crossing.outcome === 'holds') {
    drawCaption(ctx, LEVEL, skin, `Colors show how hard each ${w().link} pulled while the ${w().cargo} crossed`);
  }

  if (phase === 'build') {
    $('working').textContent = design.links.length;
    $('jar').textContent = antsLeft(LEVEL, design);
    $('maxu').textContent = '—';
  } else {
    $('working').textContent = activeMembers(run.model).length;
    $('jar').textContent = antsLeft(LEVEL, design) + (run.shed ? run.shed.freed.length : 0);
    $('maxu').textContent = `${Math.round(run.crossing.peakUtilization * 100)}%`;
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
$('shed').onclick = startShed;
$('build').onclick = () => toBuild();

// The costumes: any time, mid-crossing included. The physics never
// hears about it.
for (const s of COSTUMES) {
  const b = document.createElement('button');
  b.dataset.skin = s.id;
  b.textContent = `${s.icon} ${s.name}`;
  b.onclick = () => {
    if (s === skin) return;
    skin = s;
    banner = BANNER_FRAMES;
    saveView();
    relabel();
  };
  $('skins').append(b);
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

toBuild();
relabel();
tick();
