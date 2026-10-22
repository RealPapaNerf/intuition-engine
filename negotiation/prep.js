// The predict gate for a negotiation: nothing is said until the user has
// committed to what they think the other side wants (invariant 2).
//
// Three commitments before the first word, scored against the hidden
// brief at the reveal, through the same journal as the bridge
// (engine/journal.js), so calibration is one stat across packs:
//   ranking   the other side's issues, most important first
//   walkAway  a band on the headline issue: where their wall is
//   worry     which of the offered worries is the real one
// And one more before every offer: how they will react to it
// (accept / counter / walk). Predicting a person's reaction is the
// social version of predicting the branch breaking.

import { party, priorities } from './brief.js';

export function commitPrep(brief, counterpartId, { ranking, walkAway, worry }) {
  const ids = brief.issues.map((i) => i.id);
  if (!Array.isArray(ranking) || ranking.length !== ids.length || new Set(ranking).size !== ids.length) {
    throw new Error('ranking must order every issue exactly once');
  }
  for (const id of ranking) if (!ids.includes(id)) throw new Error(`ranking names unknown issue ${id}`);
  const headline = brief.issues.find((i) => i.id === brief.headline);
  if (!headline?.values) throw new Error('brief needs a headline issue with values to predict a wall on');
  const { lo, hi } = walkAway ?? {};
  if (!(Number.isFinite(lo) && Number.isFinite(hi) && hi >= lo)) {
    throw new Error('walkAway needs { lo, hi } with hi >= lo');
  }
  if (!brief.worries.some((w) => w.id === worry)) throw new Error(`unknown worry ${worry}`);
  return Object.freeze({
    counterpart: counterpartId,
    headline: headline.id,
    ranking: Object.freeze([...ranking]),
    walkAway: Object.freeze({ lo, hi }),
    worry,
  });
}

// Spearman's footrule: how far each issue sits from where it really
// belongs, summed. 0 is a perfect ranking.
export function footrule(predicted, actual) {
  return predicted.reduce((s, id, i) => s + Math.abs(i - actual.indexOf(id)), 0);
}

// Journal entries for the prep, written only at the reveal. The prep is
// scored against the arithmetic of the brief and nothing else.
export function scorePrep(brief, prep, { impasse = false } = {}) {
  const actual = priorities(brief, prep.counterpart);
  const headline = brief.issues.find((i) => i.id === prep.headline);
  const cap = headline.cap?.[prep.counterpart];
  if (cap == null) throw new Error('headline issue needs a cap for the counterpart');
  const wall = headline.values[cap];
  const range = Math.max(...headline.values) - Math.min(...headline.values);
  const trueWorry = brief.worries.find((w) => w.right).id;
  const level = brief.id;
  const common = { level, buildFailed: impasse, consultant: null };
  const entries = [
    { ...common, kind: 'binary', about: 'top-priority', prediction: prep.ranking[0], outcome: actual[0] },
    { ...common, kind: 'band', about: 'wall', prediction: { ...prep.walkAway }, range, outcome: wall },
    { ...common, kind: 'binary', about: 'worry', prediction: prep.worry, outcome: trueWorry },
  ];
  return {
    entries,
    ranking: { predicted: prep.ranking, actual, footrule: footrule(prep.ranking, actual) },
    wall: { predicted: prep.walkAway, actual: wall, hit: wall >= prep.walkAway.lo && wall <= prep.walkAway.hi },
    worry: { predicted: prep.worry, actual: trueWorry, hit: prep.worry === trueWorry },
  };
}

// The per-offer commitment: a reaction call, as a binary-style entry
// (equality of strings; the journal does not care that there are three).
export function reactionEntry(brief, predicted, actual, { impasse = false } = {}) {
  const ok = ['accept', 'counter', 'walk'];
  if (!ok.includes(predicted) || !ok.includes(actual)) throw new Error('reaction must be accept, counter or walk');
  return { level: brief.id, kind: 'binary', about: 'reaction', prediction: predicted, outcome: actual, buildFailed: impasse, consultant: null };
}

export { party };
