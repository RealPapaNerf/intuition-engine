// The scale: measuring a bridge's breaking load by bisection over real
// crossings (decisions 2026-10-24). No formula on the side — each probe
// is a full experiment on a fresh copy of the structure, and the
// measured value is the heaviest grid mass that carried the cargo
// across. Bisection leans on quasi-static monotonicity (heavier is
// never easier), which is how the crossing loads; the hand-calc test in
// test/measure.test.js pins the reading to the V bridge's analytic
// critical cargo.
//
// A ladder speaks in masses (kg) on the resolution grid of the
// archetype's frozen `measure` block. It asks for at most
// 1 + ceil(log2(max/resolution + 1)) probes: the top of the scale
// first — a reading pinned at the stop is an answer, like a real
// scale's — then binary search.

export function makeLadder({ max, resolution }) {
  if (!(max > 0) || !(resolution > 0) || resolution > max) {
    throw new Error('a scale needs 0 < resolution <= max');
  }
  const N = Math.round(max / resolution);
  let lo = -1; // largest grid step proven to hold (-1: none yet)
  let hi = N + 1; // smallest grid step proven to fail (N+1: none yet)
  let asked = null; // the probe awaiting its report, as a grid step
  const probes = [];

  // The next mass to try, or null when the reading is in.
  function next() {
    if (asked !== null) throw new Error('report the last probe first');
    if (hi > N) {
      if (lo === N) return null; // the top held: pinned at the stop
      asked = N;
    } else if (hi - lo > 1) {
      asked = Math.floor((lo + hi) / 2);
    } else {
      return null;
    }
    return asked * resolution;
  }

  function report(holds) {
    if (asked === null) throw new Error('nothing was asked');
    probes.push({ mass: asked * resolution, holds: holds === true });
    if (holds === true) lo = asked;
    else hi = asked;
    asked = null;
  }

  function done() {
    return asked === null && (lo === N || (hi <= N && hi - lo <= 1));
  }

  // The reading. heldAny false means no positive grid mass was carried
  // — the reading is 0 and the journal entry's buildFailed is true.
  // maxed true means the scale is pinned at its stop.
  function result() {
    if (!done()) throw new Error('the ladder is still running');
    return {
      mass: Math.max(lo, 0) * resolution,
      maxed: lo === N,
      heldAny: lo >= 1,
    };
  }

  return { next, report, done, result, probes };
}

// Run a ladder to its reading (tests, and anything headless).
// holdsAt(massKg) must run a fresh crossing and say whether it held.
export function breakingLoad(holdsAt, scale) {
  const ladder = makeLadder(scale);
  for (let m = ladder.next(); m !== null; m = ladder.next()) {
    ladder.report(holdsAt(m));
  }
  return { ...ladder.result(), probes: ladder.probes };
}
