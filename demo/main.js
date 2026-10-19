// Will It Break: the frog, the ant bridge, and the predict gate.
//
// The one non-negotiable invariant, enforced: nothing runs until the kid
// commits to a prediction. The frog walks on only after "holds" or
// "breaks" is called; physics decides; the calibration score accumulates.
// After a bridge that holds, the lazy-colony shed is available.

import {
  makeModel,
  addNode,
  addMember,
  step,
  settle,
  checkBreaks,
  shed,
  makeGoal,
  activeMembers,
  utilization,
  ANT,
  makeJournal,
  record,
  calibration,
} from '../engine/index.js';

const FROG_SIZES = [0.02, 0.05, 0.1, 0.2]; // kg
const FROG_NAMES = ['Peep (20 g)', 'Hopper (50 g)', 'Chonk (100 g)', 'Big Earl (200 g)'];
const RIVER_Y = -0.4;
const DECK_MIN_Y = -0.36;
const RAMP_FRAMES = 90; // the frog walks on over ~1.5 s: a gentle load
const WATCH_FRAMES = 150;

function buildBridge() {
  const model = makeModel();
  const left = addNode(model, { x: 0, y: 0, fixed: true });
  const right = addNode(model, { x: 1, y: 0, fixed: true });

  const xs = [1, 2, 3, 4, 5].map((i) => i / 6);
  const deck = xs.map((x) => addNode(model, { x, y: -0.16, mass: 0.004 }));
  const lower = xs.map((x) => addNode(model, { x, y: -0.28, mass: 0.004 }));

  const chain = (nodes) => {
    addMember(model, left, nodes[0], ANT);
    for (let i = 0; i < nodes.length - 1; i++) {
      addMember(model, nodes[i], nodes[i + 1], ANT);
    }
    addMember(model, nodes[nodes.length - 1], right, ANT);
  };
  chain(deck);
  chain(lower);
  for (let i = 0; i < xs.length; i++) addMember(model, deck[i], lower[i], ANT);
  for (let i = 0; i < xs.length - 1; i++) {
    addMember(model, deck[i], lower[i + 1], ANT);
    addMember(model, deck[i + 1], lower[i], ANT);
  }

  const frogNode = deck[Math.floor(deck.length / 2)];
  return { model, deck, frogNode, baseMass: frogNode.mass };
}

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const $ = (id) => document.getElementById(id);

const S = 660;
const tx = (x) => (x + 0.15) * S;
const ty = (y) => (0.32 - y) * S;

let frogIndex = 1;
let scene;
let phase; // 'predict' | 'testing' | 'result'
let prediction = null; // 'holds' | 'breaks'
let verdict = null;
let rampFrame = 0;
let watchFrame = 0;
let snappedAt = null; // x of the first snapped member
let freed = 0;
let shedQueue = [];
let shedTimer = 0;

// The commitment journal is the real log (engine/journal.js); the
// kid-visible stat is calibration(), the prestige score. localStorage
// is a per-viewer convenience: wrapped, and the game is fine without it.
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
    localStorage.setItem(
      'willitbreak-journal',
      JSON.stringify(journal.entries.slice(-200)),
    );
  } catch {
    /* fine */
  }
}

function setPhase(next) {
  phase = next;
  $('smaller').disabled = phase !== 'predict';
  $('bigger').disabled = phase !== 'predict';
  $('holds').disabled = phase !== 'predict';
  $('breaks').disabled = phase !== 'predict';
  $('shed').disabled = !(phase === 'result' && verdict === 'holds' && shedQueue.length === 0);
  $('reset').disabled = phase === 'testing';
}

function newRound() {
  scene = buildBridge();
  settle(scene.model, { maxSteps: 20000 });
  prediction = null;
  verdict = null;
  rampFrame = 0;
  watchFrame = 0;
  snappedAt = null;
  freed = 0;
  shedQueue = [];
  $('frog').textContent = FROG_NAMES[frogIndex];
  $('msg').textContent = `${FROG_NAMES[frogIndex]} wants to cross. Will the bridge hold? Say it before you see it.`;
  setPhase('predict');
}

function predict(call) {
  prediction = call;
  $('msg').textContent =
    call === 'holds' ? 'You say it HOLDS. Here comes the frog…' : 'You say it BREAKS. Here comes the frog…';
  setPhase('testing');
}

function finishRound(actual) {
  verdict = actual;
  record(journal, {
    level: `frog-bridge:${FROG_SIZES[frogIndex] * 1000}g`,
    kind: 'binary',
    prediction,
    outcome: actual,
    buildFailed: actual === 'breaks',
    consultant: null,
    at: Date.now(), // display metadata; the journal never reads it
  });
  saveJournal();
  const correct = prediction === actual;

  let why;
  if (actual === 'breaks') {
    const where = snappedAt == null ? '' : snappedAt < 0.25 || snappedAt > 0.75 ? ' It snapped near the bank — that is where the pull is biggest.' : ' It snapped near the middle, right under the frog.';
    why = `💥 It broke.${where}`;
  } else {
    let maxU = 0;
    for (const m of activeMembers(scene.model)) maxU = Math.max(maxU, utilization(m));
    why = `💪 It held. The hardest ant worked at ${Math.round(maxU * 100)}% of its grip.`;
  }
  $('msg').textContent = `${correct ? '✅ Called it!' : '❌ Not this time.'} ${why}${actual === 'holds' ? ' Now — which ants were even needed?' : ''}`;
  setPhase('result');
}

function runShed() {
  const plan = buildBridge();
  plan.frogNode.mass = plan.baseMass + FROG_SIZES[frogIndex];
  const goal = makeGoal({ watchNodes: plan.deck, minY: DECK_MIN_Y });
  const result = shed(plan.model, { goal, settleOpts: { maxSteps: 30000 } });
  if (!result.feasible || result.removed.length === 0) {
    $('msg').textContent = 'Every ant is needed. No one gets to be lazy.';
    return;
  }
  shedQueue = result.removed.map((m) => plan.model.members.indexOf(m));
  $('msg').textContent = 'Watch: the laziest ants let go, one by one…';
  $('shed').disabled = true;
}

function tick() {
  for (let i = 0; i < 24; i++) {
    step(scene.model, 0.0008);
    for (const n of scene.model.nodes) {
      if (!n.fixed) {
        n.vx *= 0.999;
        n.vy *= 0.999;
      }
    }
  }

  if (phase === 'testing') {
    if (rampFrame < RAMP_FRAMES) {
      rampFrame++;
      scene.frogNode.mass = scene.baseMass + (FROG_SIZES[frogIndex] * rampFrame) / RAMP_FRAMES;
    } else {
      watchFrame++;
    }
    const snapped = checkBreaks(scene.model);
    if (snapped.length > 0 && snappedAt == null) {
      snappedAt = (snapped[0].a.x + snapped[0].b.x) / 2;
    }
    const fell = scene.frogNode.y < RIVER_Y + 0.03;
    if (snappedAt != null || fell) {
      if (fell || watchFrame > 30) finishRound('breaks');
    } else if (watchFrame >= WATCH_FRAMES) {
      finishRound('holds');
    }
  }

  if (shedQueue.length > 0 && ++shedTimer >= 20) {
    shedTimer = 0;
    const idx = shedQueue.shift();
    const m = scene.model.members[idx];
    if (m && !m.broken) {
      m.broken = true;
      m.force = 0;
      freed++;
    }
    if (shedQueue.length === 0) {
      $('msg').textContent = `Done: ${freed} ants back in your jar, and the bridge still holds the frog.`;
    }
  }

  draw();
  requestAnimationFrame(tick);
}

function draw() {
  const { model, frogNode } = scene;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#7fb6d9';
  ctx.fillRect(0, ty(RIVER_Y), canvas.width, canvas.height - ty(RIVER_Y));
  ctx.fillStyle = '#8a6b43';
  ctx.fillRect(0, ty(0), tx(0), canvas.height);
  ctx.fillRect(tx(1), ty(0), canvas.width - tx(1), canvas.height);
  ctx.font = '26px serif';
  ctx.fillText('🐊', tx(0.35), ty(RIVER_Y) + 34);
  ctx.fillText('🐊', tx(0.62), ty(RIVER_Y) + 44);

  let maxU = 0;
  for (const m of activeMembers(model)) {
    const u = Math.min(utilization(m), 1);
    maxU = Math.max(maxU, u);
    ctx.strokeStyle =
      m.force <= 1e-6
        ? 'rgba(120,120,120,0.45)'
        : `rgba(${(120 + 135 * u) | 0}, ${(70 - 40 * u) | 0}, 40, 0.95)`;
    ctx.lineWidth = 1.5 + 2.5 * u;
    ctx.beginPath();
    ctx.moveTo(tx(m.a.x), ty(m.a.y));
    ctx.lineTo(tx(m.b.x), ty(m.b.y));
    ctx.stroke();
    ctx.font = '11px serif';
    ctx.fillText('🐜', tx((m.a.x + m.b.x) / 2) - 5, ty((m.a.y + m.b.y) / 2) + 4);
  }

  // The frog: on the bank while you decide, walking on during the test,
  // riding the deck (or falling with it) after.
  const size = 26 + frogIndex * 10;
  ctx.font = `${size}px serif`;
  if (phase === 'predict') {
    ctx.fillText('🐸', tx(-0.1), ty(0.02));
  } else {
    const t = Math.min(rampFrame / RAMP_FRAMES, 1);
    const fx = -0.1 + (frogNode.x - -0.1) * t;
    const fy = t < 1 ? 0.02 + (frogNode.y - 0.02) * t : frogNode.y;
    ctx.fillText('🐸', tx(fx) - 14 - frogIndex * 5, ty(fy) - 4);
  }

  $('working').textContent = activeMembers(model).length;
  $('freed').textContent = freed;
  $('maxu').textContent = `${Math.round(maxU * 100)}%`;
  const c = calibration(journal);
  $('calib').textContent = c.total === 0 ? '—' : `${c.hits}/${c.total} right · streak ${c.streak}`;
}

$('bigger').onclick = () => {
  frogIndex = Math.min(frogIndex + 1, FROG_SIZES.length - 1);
  newRound();
};
$('smaller').onclick = () => {
  frogIndex = Math.max(frogIndex - 1, 0);
  newRound();
};
$('holds').onclick = () => predict('holds');
$('breaks').onclick = () => predict('breaks');
$('shed').onclick = runShed;
$('reset').onclick = newRound;

newRound();
tick();
