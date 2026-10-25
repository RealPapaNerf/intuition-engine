// The Consultant: the AI that answers — and is deliberately, curatedly
// fallible (invariant 5; decisions 2026-10-19 §2, 2026-10-25 §4). It is
// never a live model: with canned errors we control the flaw — one per
// round, of a known type, catchable by reasoning against reality, never
// by tone.
//
// The truth comes first, honestly: the real breaking load by the real
// ladder, the real crossing for a verdict. Then a seeded draw makes the
// claim wrong about 1 time in 5 — deterministic per seed, so the same
// setup always gets the same advice and there is no reroll-fishing.
// Wrongness is a transform from the taxonomy, and never the true value:
//
//   magnitude    ×10 the real load (not when the scale is pinned — a
//                claim above a pinned stop can't be proven wrong)
//   unit-slip    ÷10, the grams/kilograms slip
//   limiting-case a confident load for a bridge that carries nothing —
//                zero structure should mean zero
//   answered-different-question  the verdict argued for another cargo
//                whose answer genuinely differs
//   confident-nonsense  fluent, assured, and opposite to reality
//
// The engine returns the claim, the error type, and the truth (for the
// postmortem). What the kid did about it — trusted, doubted, deferred —
// is the journal's separate `consultant` commitment (2026-10-19 §4).

import { buildModel, findRoute, pointKey } from './blueprint.js';
import { runCrossing } from './crossing.js';
import { breakingLoad } from './measure.js';

export const WRONG_RATE = 0.2; // right about 4 times in 5   REVISIT

function hash(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// mulberry32: a tiny deterministic stream, seeded by the round's key.
function makeRng(seed) {
  let a = hash(seed) || 1;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function crossingVerdict(level, design, cargoMass) {
  const route = findRoute(level, design);
  if (!route) return 'breaks'; // nothing to cross on
  const built = buildModel(level, design);
  const c = runCrossing(built.model, {
    route: route.map((p) => built.nodeOf.get(pointKey(p))),
    cargoMass,
    dryY: level.dryY,
  });
  return c.outcome === 'holds' ? 'holds' : 'breaks';
}

function measureTruth(level, design) {
  if (!findRoute(level, design)) return { grams: 0, maxed: false };
  const { mass, maxed } = breakingLoad(
    (m) => crossingVerdict(level, design, m) === 'holds',
    level.measure,
  );
  return { grams: Math.round(mass * 1000), maxed };
}

const toGrams = (kg) => Math.round(kg * 1000);

function measureClaim(level, truth, rng) {
  const resG = toGrams(level.measure.resolution);
  const maxG = toGrams(level.measure.max);
  if (truth.grams === 0) {
    // A bridge that carries nothing, confidently credited with a load:
    // the limiting case that doesn't vanish.
    const grams = Math.max(resG, Math.round(maxG / 2 / resG) * resG);
    return { grams, errorType: 'limiting-case' };
  }
  const candidates = [];
  if (!truth.maxed) {
    candidates.push({ grams: truth.grams * 10, errorType: 'magnitude' });
  }
  const slipped = Math.round(truth.grams / 10 / resG) * resG;
  if (slipped > 0 && slipped !== truth.grams) {
    candidates.push({ grams: slipped, errorType: 'unit-slip' });
  }
  if (candidates.length === 0) {
    // Nowhere lower to slip and the scale is pinned: claim under it.
    return { grams: Math.max(resG, truth.grams - resG), errorType: 'unit-slip' };
  }
  return candidates[Math.floor(rng() * candidates.length)];
}

// The Consultant's advice for one round.
//   level, design  the variant and the kid's blueprint, as they stand
//   mode           'measure' (a breaking-load claim, in grams) or
//                  'feel' (a holds/breaks verdict for cargo[cargoIndex])
//   seed           the round's key, e.g. `${kid}:${levelId}:${setup}:${n}` —
//                  same seed, same advice, always
export function consult({ level, design, mode, cargoIndex = 0, seed }) {
  const rng = makeRng(String(seed));
  const wrong = rng() < WRONG_RATE;

  if (mode === 'measure') {
    const truth = measureTruth(level, design);
    if (!wrong) {
      return { quantity: 'breaking-load', claim: truth.grams, wrong: false, errorType: null, truth: truth.grams };
    }
    const { grams, errorType } = measureClaim(level, truth, rng);
    return { quantity: 'breaking-load', claim: grams, wrong: true, errorType, truth: truth.grams };
  }

  const truth = crossingVerdict(level, design, level.cargo[cargoIndex]);
  if (!wrong) {
    return { quantity: 'verdict', claim: truth, wrong: false, errorType: null, truth, cargoIndex };
  }
  const claim = truth === 'holds' ? 'breaks' : 'holds';
  // Argued for the wrong cargo when another cargo's verdict genuinely
  // differs — scanned in a seeded order so the pick is the seed's too.
  const others = level.cargo.map((_, i) => i).filter((i) => i !== cargoIndex);
  for (let i = others.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [others[i], others[j]] = [others[j], others[i]];
  }
  for (const i of others) {
    if (crossingVerdict(level, design, level.cargo[i]) === claim) {
      return { quantity: 'verdict', claim, wrong: true, errorType: 'answered-different-question', truth, cargoIndex, aboutCargoIndex: i };
    }
  }
  return { quantity: 'verdict', claim, wrong: true, errorType: 'confident-nonsense', truth, cargoIndex };
}
