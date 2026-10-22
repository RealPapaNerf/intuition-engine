// The crossing: cargo walks a route across a built structure while
// physics decides. One call to advanceCrossing() is one animation frame,
// so the demo and the tests run the exact same experiment.
//
// Loading is quasi-static, the way a careful frog walks. The structure
// comes off its scaffold first — gravity ramps on, so it settles from its
// as-built shape instead of being dropped. Then the cargo's weight moves
// along the route, shared between the two joints of the link it stands
// on by the lever rule, and the structure is relaxed toward equilibrium
// every frame. At each joint the cargo waits until the bridge is still.
//
// Only equilibrium states are judged. Forces in a frame whose relaxation
// has not settled are artifacts of the solution method, not physics, so
// a snap, a dunk, or a peak is only ever read off a still bridge — the
// statics the hand calcs and the shed use — and no walking speed decides
// the result. (The cargo between two joints is never worse off than on
// the worse of them; test/crossing.test.js holds that true, and it is
// what makes judging at the joints enough.)
//
// The moment a link lets go, the run switches to plain dynamics: failure
// is a real event, and the bridge falls the way things fall.
//
// Outcomes are goal checks, never method: 'holds' — the cargo reached the
// end of the route and no link let go; 'snapped' — a link let go;
// 'dunked' — the cargo sank below dryY.

import { activeMembers, utilization } from './model.js';
import { step, settle, checkBreaks } from './solver.js';

export const CROSSING_TIMING = {
  releaseFrames: 40, // gravity ramps on: the scaffold comes away
  restFrames: 20, // the bridge hangs on its own before the cargo steps on
  restCap: 240, // ...and is judged anyway if it is still moving by then
  legFrames: 16, // walking one link
  dwellFrames: 6, // standing on a joint, at least this long and until still
  dwellCap: 60, // ...judged anyway if the bridge is still moving by then
  frameSteps: 800, // relaxation budget per quasi-static frame
  substeps: 24, // dynamic steps per frame once something lets go
  dt: 0.0008,
  bleed: 0.999, // per-step velocity bleed while falling (air)
};

// route: the nodes the cargo walks, start to end (both usually anchors).
export function makeCrossing(model, { route, cargoMass, dryY, timing = {} }) {
  return {
    model,
    route,
    cargoMass,
    dryY,
    timing: { ...CROSSING_TIMING, ...timing },
    gravity: model.gravity,
    baseMass: route.map((n) => n.mass),
    phase: 'release', // 'release' | 'rest' | 'walk' | 'over'
    frame: 0,
    still: false, // did the last frame's relaxation reach equilibrium?
    onBridge: false, // false until the cargo steps off the start
    leg: 0, // the cargo is on route[leg] → route[leg + 1] ...
    t: 0, // ... this far along
    outcome: null, // set when phase becomes 'over'
    overFrames: 0,
    snapped: [], // links that let go, in order
    peak: new Map(), // member → highest judged utilization
    peakUtilization: 0,
  };
}

// The lever rule: standing a fraction t along a link, the cargo's weight
// splits (1 − t) to the joint behind and t to the joint ahead.
function placeCargo(c) {
  c.route.forEach((n, i) => {
    n.mass = c.baseMass[i];
  });
  if (!c.onBridge) return;
  c.route[c.leg].mass += (1 - c.t) * c.cargoMass;
  c.route[c.leg + 1].mass += c.t * c.cargoMass;
}

export function cargoPosition(c) {
  if (!c.onBridge) return { x: c.route[0].x, y: c.route[0].y };
  const a = c.route[c.leg];
  const b = c.route[c.leg + 1];
  return { x: a.x + (b.x - a.x) * c.t, y: a.y + (b.y - a.y) * c.t };
}

function trackPeaks(c) {
  for (const m of activeMembers(c.model)) {
    const u = utilization(m);
    if (u > (c.peak.get(m) ?? 0)) c.peak.set(m, u);
    if (u > c.peakUtilization) c.peakUtilization = u;
  }
}

function finish(c, outcome) {
  c.phase = 'over';
  c.outcome = outcome;
  c.model.gravity = c.gravity; // a failure mid-release still falls at g
}

function lastLeg(c) {
  return c.leg === c.route.length - 2;
}

// Advance one frame. Returns the links that let go this frame.
export function advanceCrossing(c, { substeps } = {}) {
  const T = c.timing;
  const model = c.model;

  if (c.phase === 'over') {
    c.overFrames++;
    if (c.outcome === 'holds') {
      settle(model, { maxSteps: T.frameSteps, dt: T.dt });
    } else {
      for (let s = 0; s < (substeps ?? T.substeps); s++) {
        step(model, T.dt);
        for (const n of model.nodes) {
          n.vx *= T.bleed;
          n.vy *= T.bleed;
        }
      }
    }
    const broke = checkBreaks(model);
    c.snapped.push(...broke);
    return broke;
  }

  c.frame++;
  if (c.phase === 'release') {
    model.gravity = c.gravity * Math.min(1, c.frame / T.releaseFrames);
    if (c.frame >= T.releaseFrames) {
      c.phase = 'rest';
      c.frame = 0;
    }
  } else if (c.phase === 'rest') {
    if (c.frame > T.restFrames && (c.still || c.frame > T.restCap)) {
      c.phase = 'walk';
      c.frame = 0;
      c.onBridge = true;
    }
  } else {
    // Step on only once the bridge is still under this joint (or the
    // wait ran out). The last joint is the far bank: nothing to step to.
    const dwelt = c.frame > T.legFrames + T.dwellFrames && c.still;
    const waited = c.frame > T.legFrames + T.dwellCap;
    if ((dwelt || waited) && !lastLeg(c)) {
      c.leg++;
      c.frame = 1;
    }
    c.t = Math.min(1, c.frame / T.legFrames);
  }

  placeCargo(c);
  c.still = settle(model, { maxSteps: T.frameSteps, dt: T.dt }).settled;

  const forced =
    (c.phase === 'rest' && c.frame >= T.restCap) ||
    (c.phase === 'walk' && c.frame >= T.legFrames + T.dwellCap);
  if (!c.still && !forced) return []; // mid-motion: nothing to judge

  trackPeaks(c);
  const broke = checkBreaks(model);
  c.snapped.push(...broke);
  if (broke.length > 0) {
    finish(c, 'snapped');
  } else if (c.onBridge && cargoPosition(c).y < c.dryY) {
    finish(c, 'dunked');
  } else if (c.phase === 'walk' && lastLeg(c) && c.t === 1) {
    finish(c, 'holds');
  }
  return broke;
}

// Run a crossing to its outcome (tests, and anything headless).
export function runCrossing(model, opts) {
  const c = makeCrossing(model, opts);
  while (c.phase !== 'over') advanceCrossing(c);
  return c;
}

// The shed's view of a crossing: the structure must meet the goal with
// no cargo at all, and with the cargo standing on each joint of the
// route in turn — the same states the crossing judges. Each case sets
// every route joint's load, so cases never leak into each other. Pass
// both to shed().
//
// The goal keeps a hair of margin — 0.1% of grip, 1 mm of height. The
// shed and the crossing read the same statics through different
// relaxation paths, each good to a few hundredths of a percent; the
// margin means a lean bridge the shed hands back never sits on an edge
// that solver tolerance alone could tip. The crossing keeps no margin:
// it is the ground truth.
export const SHED_MARGIN = { utilization: 1e-3, height: 1e-3 };

export function crossingCases(route, cargoMass, { dryY }) {
  const base = route.map((n) => n.mass);
  const loadCases = [
    () =>
      route.forEach((n, i) => {
        n.mass = base[i];
      }),
  ];
  const watch = [null];
  route.forEach((cargoNode, k) => {
    if (cargoNode.fixed) return; // on a bank: the ground takes it
    loadCases.push(() =>
      route.forEach((n, i) => {
        n.mass = base[i] + (i === k ? cargoMass : 0);
      }),
    );
    watch.push(cargoNode);
  });
  const goal = (model, caseIndex) => {
    for (const m of activeMembers(model)) {
      if (utilization(m) > 1 - SHED_MARGIN.utilization) return false;
    }
    const n = watch[caseIndex];
    return n === null || n.y >= dryY + SHED_MARGIN.height;
  };
  return { loadCases, goal };
}
