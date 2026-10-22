// Will It Break: the kid builds the bridge, calls it, and physics decides.
//
// Decisions 2026-10-22 §8, step 1 — the game begins when the kid builds
// the bridge, not when they test ours. Drag from a bank or a tree to lay
// a line of ants; tap an ant to send it back to the jar. Nothing runs
// until the kid commits to a prediction (the one non-negotiable
// invariant). Then the scaffold comes away, the frog walks the bridge,
// and the calibration score accumulates. After a bridge that holds, the
// lazy colony lets go of every ant the frog never needed, and they go
// back in the jar for the next build.
//
// The physics is the archetype's (engine/archetypes.js). The names and
// pictures here — frogs, ants, trees, crocodiles — are the reference
// skin, and nothing in this file decides an outcome.

import {
  SPAN_GAP,
  makeBlueprint,
  checkLink,
  addLink,
  removeLink,
  hasLink,
  isAnchor,
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
} from '../engine/index.js';

const LEVEL = SPAN_GAP;
const FROG_NAMES = ['Peep (20 g)', 'Hopper (50 g)', 'Chonk (100 g)', 'Big Earl (200 g)'];
const SLOW_MO_FRAMES = 75; // after the first snap, the fall plays at quarter speed
const RESULT_DELAY = 70; // frames of falling before the verdict is read out
const SHED_EVERY = 20; // frames between ants letting go
const SHED_BUDGET_MS = 8; // the colony's thinking time per frame
const GRAB = 0.032; // m: how close to a dot counts as on it
const TAP = 0.022; // m: how close to an ant counts as tapping it
const FINGER = 18; // px on screen: neither may shrink below a fingertip

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const $ = (id) => document.getElementById(id);

const S = 660;
const tx = (x) => (x + 0.15) * S;
const ty = (y) => (0.32 - y) * S;
const world = (p) => ({ x: p[0] * LEVEL.step, y: p[1] * LEVEL.step });

let frogIndex = 1;
let design = makeBlueprint();
const history = []; // undo: earlier link lists
let phase; // 'build' | 'testing' | 'result' | 'shedding'
let prediction = null; // 'holds' | 'breaks'
let run = null; // the live test: model, crossing, snap, shed
let drag = null; // laying ants: { at, placed, before }
let tap = null; // a tap that may send an ant home: { link, x, y }
let pointer = null; // world position under the mouse, for hover hints
let notice = null; // a placement refusal to show while dragging

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
} catch {
  /* start empty */
}
function saveDesign() {
  try {
    localStorage.setItem('willitbreak-design', JSON.stringify(design));
  } catch {
    /* fine */
  }
}

// A prediction is only a prediction if the kid hasn't seen that exact
// bridge carry that exact frog. Seen setups come back from the journal.
function fnv1a(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}
function levelId() {
  return `${LEVEL.id}:${LEVEL.cargo[frogIndex] * 1000}g`;
}
function setupKey() {
  const links = design.links.map(([p, q]) => linkKey(p, q)).sort();
  return `${levelId()}:${fnv1a(links.join(';'))}`;
}
const seen = new Set(journal.entries.map((e) => e.setup).filter(Boolean));

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
// and the middle of an ant — could both claim the same touch.
function reach(meters, cap) {
  const scale = canvas.getBoundingClientRect().width / canvas.width;
  return Math.min(cap, Math.max(meters, FINGER / scale / S));
}

function nearestPoint(x, y) {
  const p = [Math.round(x / LEVEL.step), Math.round(y / LEVEL.step)];
  if (!inBounds(LEVEL, p)) return null;
  const w = world(p);
  return Math.hypot(w.x - x, w.y - y) <= reach(GRAB, 0.45 * LEVEL.step) ? p : null;
}

function antAt(x, y) {
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
  'nothing-to-hold': 'Ants need something to hold: start from a bank, a tree, or your bridge.',
  'both-anchored': 'The bank and the tree already hold each other. Send the ants out over the gap.',
  'jar-empty': 'The jar is empty! Tap an ant on your bridge to send it back, then build somewhere else.',
  'out-of-bounds': 'That is as far as the ants can reach.',
};

// Walk the drag one dot at a time toward the pointer, laying an ant on
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
        if (notice) $('msg').textContent = notice; // say so mid-drag
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
      ? `Back in the jar — and ${stranded} more ${stranded === 1 ? 'ant that' : 'ants that'} had nothing left to hold.`
      : null,
  );
}

function toWorld(e) {
  const r = canvas.getBoundingClientRect();
  const px = ((e.clientX - r.left) * canvas.width) / r.width;
  const py = ((e.clientY - r.top) * canvas.height) / r.height;
  return { x: px / S - 0.15, y: 0.32 - py / S };
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
    const link = antAt(x, y);
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

function frogName() {
  return FROG_NAMES[frogIndex];
}

function buildPrompt() {
  if (design.links.length === 0) {
    return `${frogName()} wants to cross. Drag from the bank to lay a line of ants — reach the other side!`;
  }
  if (!findRoute(LEVEL, design)) {
    return 'Keep going — the frog needs ants all the way to the other bank.';
  }
  if (seen.has(setupKey())) {
    return 'You have seen this bridge carry this frog. Change the bridge or the frog to make a new call.';
  }
  return `${frogName()} wants to cross. Will your bridge hold? Say it before you see it.`;
}

// Buttons follow the phase; the message is whatever just happened, or
// the build prompt.
function refresh(message = null) {
  const building = phase === 'build';
  const callable = building && findRoute(LEVEL, design) !== null && !seen.has(setupKey());
  const frogs = building || phase === 'result';
  $('smaller').disabled = !frogs || frogIndex === 0;
  $('bigger').disabled = !frogs || frogIndex === FROG_NAMES.length - 1;
  $('undo').disabled = !building || history.length === 0;
  $('clear').disabled = !building || design.links.length === 0;
  $('holds').disabled = !callable;
  $('breaks').disabled = !callable;
  $('shed').disabled = !(phase === 'result' && run.crossing.outcome === 'holds' && !run.shed);
  $('build').disabled = phase !== 'result';
  $('frog').textContent = frogName();
  if (message !== null) $('msg').textContent = message;
  else if (building) $('msg').textContent = buildPrompt();
}

function toBuild(message = null) {
  phase = 'build';
  run = null;
  refresh(message);
}

function predict(call) {
  prediction = call;
  const built = buildModel(LEVEL, design);
  const route = findRoute(LEVEL, design);
  run = {
    ...built,
    route,
    crossing: makeCrossing(built.model, {
      route: route.map((p) => built.nodeOf.get(pointKey(p))),
      cargoMass: LEVEL.cargo[frogIndex],
      dryY: LEVEL.dryY,
    }),
    snap: null, // the first ant to let go, and where
    slowMo: 0,
    shed: null,
  };
  phase = 'testing';
  refresh(`You say it ${call === 'holds' ? 'HOLDS' : 'BREAKS'}. The scaffold comes away…`);
}

function narrate() {
  const c = run.crossing;
  if (c.phase === 'rest') $('msg').textContent = 'The scaffold is off. The ants hold on…';
  if (c.phase === 'walk') $('msg').textContent = `Here comes ${frogName()}…`;
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
    at: Date.now(),
  });
  saveJournal();
  seen.add(setup);

  let why;
  if (c.outcome === 'holds') {
    why =
      `💪 It held — ${frogName()} made it across! The hardest-working ant pulled at ` +
      `${Math.round(c.peakUtilization * 100)}% of its grip. Now — which ants were even needed?`;
  } else if (c.outcome === 'dunked') {
    why = `🐊 Nothing snapped — but the bridge sagged so low the crocodiles could reach ${frogName()}.`;
  } else if (!c.onBridge) {
    why = '💥 It couldn’t even hold itself up: an ant let go before the frog stepped on.';
  } else {
    const { member: m, x } = run.snap; // where it let go, not where it fell
    const under = [c.route[c.leg], c.route[c.leg + 1]].some((n) => n === m.a || n === m.b);
    const span = world(LEVEL.end).x;
    const nearBank = x < 0.25 * span || x > 0.75 * span;
    const where = under ? 'right under the frog' : nearBank ? 'near the bank' : 'out in the middle';
    why = `💥 It broke. The first ant let go ${where}.`;
  }
  phase = 'result';
  refresh(`${prediction === actual ? '✅ Called it!' : '❌ Not this time.'} ${why}`);
}

// The lazy colony, on the kid's own bridge: the ants work out who the
// frog never needed — with the frog standing on every joint of its walk
// — and those let go one by one. The walkway stays: the frog walks on it.
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
  refresh('Watch: the ants are working out who is lazy…');
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
    refresh('This bridge is right at its limit — every ant is needed.');
    return;
  }
  if (freed.length === 0) {
    phase = 'result';
    refresh('Every ant is needed. No one gets to be lazy.');
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
    `Done: ${back} ${back === 1 ? 'ant' : 'ants'} back in your jar. ` +
      `Will the lean bridge still hold ${frogName()}? Say it before you see it.`,
  );
}

function tick() {
  if (run) {
    const before = run.crossing.phase;
    const slow = run.slowMo > 0;
    if (slow) run.slowMo--;
    const broke = advanceCrossing(run.crossing, { substeps: slow ? 6 : undefined });
    if (broke.length > 0 && !run.snap) {
      // Pin where the failure started; the pieces will fall away from it.
      const { a, b } = broke[0];
      run.snap = { member: broke[0], x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      run.slowMo = SLOW_MO_FRAMES;
    }
    if (phase === 'testing') {
      const c = run.crossing;
      if (c.phase !== before) narrate();
      if (c.outcome && (c.outcome === 'holds' || c.overFrames >= RESULT_DELAY)) finishRound();
    } else if (phase === 'shedding') {
      pumpShed();
    }
  }
  draw();
  requestAnimationFrame(tick);
}

// --- Drawing ---------------------------------------------------------------

function drawWorld() {
  const W = canvas.width;
  const H = canvas.height;
  ctx.fillStyle = '#7fb6d9';
  ctx.fillRect(0, ty(LEVEL.waterY), W, H - ty(LEVEL.waterY));
  // The crocodiles' reach: a cargo below dryY is theirs.
  ctx.fillStyle = 'rgba(127, 182, 217, 0.35)';
  ctx.fillRect(tx(0), ty(LEVEL.dryY), tx(1) - tx(0), ty(LEVEL.waterY) - ty(LEVEL.dryY));
  ctx.font = '26px serif';
  ctx.fillText('🐊', tx(0.35), ty(LEVEL.waterY) + 34);
  ctx.fillText('🐊', tx(0.62), ty(LEVEL.waterY) + 44);

  ctx.fillStyle = '#8a6b43';
  ctx.fillRect(0, ty(0), tx(0), H);
  ctx.fillRect(tx(1), ty(0), W - tx(1), H);

  // Trees on the bank edges: the tall supports of the archetype.
  const top = ty(LEVEL.bounds.jMax * LEVEL.step + 0.012);
  for (const [x, lean] of [[0, -1], [1, 1]]) {
    ctx.fillStyle = '#6b4f2e';
    ctx.fillRect(tx(x) - 5, top, 10, ty(0) - top);
    ctx.fillStyle = '#6f9d4f';
    for (const [dx, dy, r] of [[0.07, 0.29, 30], [0.11, 0.22, 24], [0.04, 0.24, 22]]) {
      ctx.beginPath();
      ctx.arc(tx(x + lean * dx), ty(dy), r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawAnt(a, b, color, width) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(tx(a.x), ty(a.y));
  ctx.lineTo(tx(b.x), ty(b.y));
  ctx.stroke();
  ctx.font = '11px serif';
  ctx.fillText('🐜', tx((a.x + b.x) / 2) - 5, ty((a.y + b.y) / 2) + 4);
}

function drawBlueprint() {
  const { iMin, iMax, jMin, jMax } = LEVEL.bounds;
  for (let i = iMin; i <= iMax; i++) {
    for (let j = jMin; j <= jMax; j++) {
      const p = [i, j];
      const w = world(p);
      const anchor = isAnchor(LEVEL, p); // a peg in the bank or the tree
      ctx.fillStyle = anchor ? '#f4e3c3' : 'rgba(70, 100, 115, 0.35)';
      ctx.beginPath();
      ctx.arc(tx(w.x), ty(w.y), anchor ? 4 : 2.2, 0, Math.PI * 2);
      ctx.fill();
      if (anchor) {
        ctx.strokeStyle = '#3d2e1c';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
  }

  // The way the frog will walk: the shortest way across.
  const route = findRoute(LEVEL, design);
  if (route) {
    ctx.save();
    ctx.setLineDash([3, 7]);
    ctx.strokeStyle = 'rgba(70, 150, 70, 0.8)';
    ctx.lineWidth = 7;
    ctx.beginPath();
    route.forEach((p, k) => {
      const w = world(p);
      if (k === 0) ctx.moveTo(tx(w.x), ty(w.y) - 4);
      else ctx.lineTo(tx(w.x), ty(w.y) - 4);
    });
    ctx.stroke();
    ctx.restore();
  }

  const hovered = !drag && pointer ? antAt(pointer.x, pointer.y) : null;
  for (const [p, q] of design.links) {
    const isHover = hovered && linkKey(p, q) === linkKey(...hovered);
    drawAnt(world(p), world(q), isHover ? '#c0503c' : '#6d5a46', isHover ? 4 : 3);
  }

  // Where a drag can start: the dot under the pointer, if it is held.
  const p = pointer && nearestPoint(pointer.x, pointer.y);
  if (p && !hovered) {
    const w = world(p);
    ctx.strokeStyle = isHeld(LEVEL, design, p) ? '#2f7d32' : 'rgba(160, 60, 40, 0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(tx(w.x), ty(w.y), 9, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (drag && pointer) {
    const w = world(drag.at);
    ctx.save();
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = 'rgba(80, 60, 40, 0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(tx(w.x), ty(w.y));
    ctx.lineTo(tx(pointer.x), ty(pointer.y));
    ctx.stroke();
    ctx.restore();
  }
}

function stressColor(u) {
  return `rgba(${(120 + 135 * u) | 0}, ${(70 - 40 * u) | 0}, 40, 0.95)`;
}

function drawTest() {
  const c = run.crossing;
  // After a crossing that held, each ant shows the hardest it pulled
  // while the frog crossed: that is where the load went.
  const showPeak = c.outcome === 'holds';
  for (const m of activeMembers(run.model)) {
    const u = Math.min(showPeak ? c.peak.get(m) ?? 0 : utilization(m), 1);
    const slack = !showPeak && m.force <= 1e-6;
    drawAnt(m.a, m.b, slack ? 'rgba(120,120,120,0.45)' : stressColor(u), 1.5 + 2.5 * u);
  }
  if (run.snap) {
    ctx.font = '28px serif';
    ctx.fillText('💥', tx(run.snap.x) - 14, ty(run.snap.y) + 10);
  }
  if (showPeak) {
    ctx.fillStyle = '#4a4238';
    ctx.font = '14px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Colors show how hard each ant pulled while the frog crossed', tx(0.5), ty(0.27));
    ctx.textAlign = 'start';
  }
}

function drawFrog() {
  const size = 26 + frogIndex * 10;
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
  ctx.font = `${size}px serif`;
  if (pos.y < LEVEL.waterY) {
    ctx.fillText('💦', tx(pos.x) - size / 2, ty(LEVEL.waterY) + 8); // in it went
  } else {
    ctx.fillText('🐸', tx(pos.x) - size / 2, ty(pos.y) - 4);
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawWorld();
  if (phase === 'build') drawBlueprint();
  else drawTest();
  drawFrog();

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
  frogIndex = Math.max(0, Math.min(FROG_NAMES.length - 1, frogIndex + delta));
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

toBuild();
tick();
