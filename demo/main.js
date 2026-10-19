// The Lazy Colony: an ant bridge, a frog, and member-shedding topology
// optimization you can watch. Dev demo for the engine, not the game yet.

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
} from '../engine/index.js';

const FROG_SIZES = [0.02, 0.05, 0.1, 0.2]; // kg
const RIVER_Y = -0.4;
const DECK_MIN_Y = -0.36;

// Deterministic builder, used for both the live scene and the shedder's
// planning copy, so member indices line up between the two.
function buildBridge(frogMass) {
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

  const mid = Math.floor(deck.length / 2);
  deck[mid].mass += frogMass;
  return { model, deck, frogNode: deck[mid] };
}

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const $ = (id) => document.getElementById(id);

const S = 660;
const tx = (x) => (x + 0.15) * S;
const ty = (y) => (0.32 - y) * S;

let frogIndex = 1;
let scene;
let freed = 0;
let frogFell = false;
let shedQueue = [];
let shedTimer = 0;

function rebuild() {
  scene = buildBridge(FROG_SIZES[frogIndex]);
  // Start at static equilibrium: the drama should come from the physics
  // of the load, not from the numerical transient of dropping the whole
  // bridge into place. A genuinely overloaded bridge still snaps on the
  // first frame — honestly.
  settle(scene.model, { maxSteps: 20000 });
  freed = 0;
  frogFell = false;
  shedQueue = [];
  $('msg').textContent = '';
  $('frog').textContent = `${FROG_SIZES[frogIndex] * 1000} g`;
}

function runShed() {
  // Plan on a fresh copy (same geometry, same frog), replay on the live
  // scene one ant at a time so the kid can watch each decision.
  const plan = buildBridge(FROG_SIZES[frogIndex]);
  const goal = makeGoal({ watchNodes: plan.deck, minY: DECK_MIN_Y });
  const settleOpts = { maxSteps: 30000 };
  const result = shed(plan.model, { goal, settleOpts });

  if (!result.feasible) {
    $('msg').textContent =
      "⚠️ The bridge can't even hold this frog — try a smaller frog.";
    return;
  }
  if (result.removed.length === 0) {
    $('msg').textContent = 'Every ant is needed. No one gets to be lazy.';
    return;
  }
  shedQueue = result.removed.map((m) => plan.model.members.indexOf(m));
  $('msg').textContent = 'Watch: the laziest ants let go, one by one…';
}

function tick() {
  // Live dynamics, lightly damped so the bridge jiggles and then rests.
  if (!frogFell) {
    for (let i = 0; i < 24; i++) {
      step(scene.model, 0.0008);
      for (const n of scene.model.nodes) {
        if (!n.fixed) {
          n.vx *= 0.999;
          n.vy *= 0.999;
        }
      }
    }
    const snapped = checkBreaks(scene.model);
    if (snapped.length > 0) {
      $('msg').textContent = `💥 ${snapped.length} ant(s) snapped!`;
    }
    if (scene.frogNode.y < RIVER_Y + 0.03) {
      frogFell = true;
      $('msg').textContent = '🐊 The crocodiles say thank you. Rebuild!';
    }
  }

  // Replay the shed plan, one ant every ~20 frames.
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
      $('msg').textContent =
        `Done: ${freed} ants back in your jar, and the bridge still holds.`;
    }
  }

  draw();
  requestAnimationFrame(tick);
}

function draw() {
  const { model, frogNode } = scene;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // River and banks.
  ctx.fillStyle = '#7fb6d9';
  ctx.fillRect(0, ty(RIVER_Y), canvas.width, canvas.height - ty(RIVER_Y));
  ctx.fillStyle = '#8a6b43';
  ctx.fillRect(0, ty(0), tx(0), canvas.height);
  ctx.fillRect(tx(1), ty(0), canvas.width - tx(1), canvas.height);
  ctx.font = '26px serif';
  ctx.fillText('🐊', tx(0.35), ty(RIVER_Y) + 34);
  ctx.fillText('🐊', tx(0.62), ty(RIVER_Y) + 44);

  // Members: red by how hard the ant works, gray when slack.
  let maxU = 0;
  for (const m of activeMembers(model)) {
    const u = Math.min(utilization(m), 1);
    maxU = Math.max(maxU, u);
    ctx.strokeStyle =
      m.force <= 1e-6
        ? 'rgba(120,120,120,0.45)'
        : `rgba(${120 + 135 * u | 0}, ${70 - 40 * u | 0}, 40, 0.95)`;
    ctx.lineWidth = 1.5 + 2.5 * u;
    ctx.beginPath();
    ctx.moveTo(tx(m.a.x), ty(m.a.y));
    ctx.lineTo(tx(m.b.x), ty(m.b.y));
    ctx.stroke();
    // The ant itself, at mid-span.
    ctx.font = '11px serif';
    ctx.fillText('🐜', tx((m.a.x + m.b.x) / 2) - 5, ty((m.a.y + m.b.y) / 2) + 4);
  }

  // The frog.
  ctx.font = `${26 + frogIndex * 10}px serif`;
  ctx.fillText('🐸', tx(frogNode.x) - 14 - frogIndex * 5, ty(frogNode.y) - 4);

  $('working').textContent = activeMembers(model).length;
  $('freed').textContent = freed;
  $('maxu').textContent = `${Math.round(maxU * 100)}%`;
}

$('bigger').onclick = () => {
  frogIndex = Math.min(frogIndex + 1, FROG_SIZES.length - 1);
  rebuild();
};
$('smaller').onclick = () => {
  frogIndex = Math.max(frogIndex - 1, 0);
  rebuild();
};
$('shed').onclick = runShed;
$('reset').onclick = rebuild;

rebuild();
tick();
