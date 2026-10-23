// The hidden brief: negotiation's honest ground truth.
//
// docs/intuitive-negotiators-brief.md, "The honest-physics problem":
// people have no solver, so every character carries a consistent hidden
// brief — what they say they want (position), what they actually want
// (interest), what they're afraid of — and reacts by fixed, discoverable
// rules. This module is the part of the brief that is pure arithmetic,
// in the format MBA negotiation simulations already use: issues, options
// per issue, and a point value for every option for every party, plus a
// reservation value (the points below which that party walks).
//
// Everything checkable about a deal lives here, with no judge in the
// loop: what each side scored, whether both cleared their walk-away,
// where the Pareto frontier is, and whether money was left on the table
// (a deal exists that is better for one side and no worse for the
// other). A brief is frozen on validation so nothing downstream — not
// the counterpart, not the lens, not the demo — can move a number.

import { deepFreeze } from '../engine/freeze.js';

const asArray = (v) => (Array.isArray(v) ? v : null);

export function validateBrief(brief) {
  const fail = (msg) => {
    throw new Error(`brief ${brief?.id ?? '?'}: ${msg}`);
  };
  if (!brief || typeof brief.id !== 'string') fail('needs a string id');
  const parties = asArray(brief.parties);
  if (!parties || parties.length !== 2) fail('needs exactly two parties');
  for (const p of parties) {
    if (typeof p.id !== 'string') fail('every party needs an id');
    if (!(Number.isFinite(p.reservation) && p.reservation >= 0)) {
      fail(`party ${p.id} needs a non-negative reservation`);
    }
  }
  const issues = asArray(brief.issues);
  if (!issues || issues.length < 1) fail('needs at least one issue');
  for (const issue of issues) {
    if (typeof issue.id !== 'string') fail('every issue needs an id');
    const opts = asArray(issue.options);
    if (!opts || opts.length < 2) fail(`issue ${issue.id} needs two or more options`);
    for (const p of parties) {
      const pts = asArray(issue.points?.[p.id]);
      if (!pts || pts.length !== opts.length) {
        fail(`issue ${issue.id} needs one point value per option for ${p.id}`);
      }
      if (!pts.every((x) => Number.isFinite(x) && x >= 0)) {
        fail(`issue ${issue.id}: points for ${p.id} must be finite and non-negative`);
      }
    }
    if (issue.values && (!asArray(issue.values) || issue.values.length !== opts.length || !issue.values.every(Number.isFinite))) {
      fail(`issue ${issue.id}: values must be one number per option`);
    }
    if (issue.cap) {
      for (const [pid, idx] of Object.entries(issue.cap)) {
        if (!parties.some((p) => p.id === pid)) fail(`cap names unknown party ${pid}`);
        if (!(Number.isInteger(idx) && idx >= 0 && idx < opts.length)) {
          fail(`issue ${issue.id}: cap for ${pid} must index an option`);
        }
      }
    }
  }
  if (brief.worries !== undefined) {
    const w = asArray(brief.worries);
    if (!w || w.filter((x) => x.right).length !== 1) fail('worries must name exactly one right worry');
  }
  if (brief.headline !== undefined && !issues.some((i) => i.id === brief.headline)) {
    fail('headline must name an issue');
  }
  for (const p of parties) {
    const max = maxPoints(brief, p.id);
    if (p.reservation > max) fail(`party ${p.id} can never reach its reservation`);
  }
  return deepFreeze(brief);
}

export function party(brief, id) {
  const p = brief.parties.find((x) => x.id === id);
  if (!p) throw new Error(`no party ${id} in brief ${brief.id}`);
  return p;
}

export function otherParty(brief, id) {
  return brief.parties.find((x) => x.id !== id).id;
}

// A deal is { [issueId]: optionIndex } for every issue.
export function points(brief, partyId, deal) {
  let total = 0;
  for (const issue of brief.issues) {
    const idx = deal[issue.id];
    if (!(Number.isInteger(idx) && idx >= 0 && idx < issue.options.length)) {
      throw new Error(`deal has no valid option for issue ${issue.id}`);
    }
    total += issue.points[partyId][idx];
  }
  return total;
}

export function maxPoints(brief, partyId) {
  return brief.issues.reduce((s, i) => s + Math.max(...i.points[partyId]), 0);
}

// The swing of an issue for a party: how much that issue can matter to
// them at all. Priorities are issues ordered by swing, largest first —
// what a counterpart "cares most about," as the arithmetic has it.
export function swing(issue, partyId) {
  const pts = issue.points[partyId];
  return Math.max(...pts) - Math.min(...pts);
}

export function priorities(brief, partyId) {
  return brief.issues
    .map((i) => ({ id: i.id, swing: swing(i, partyId) }))
    .sort((a, b) => b.swing - a.swing || brief.issues.findIndex((i) => i.id === a.id) - brief.issues.findIndex((i) => i.id === b.id))
    .map((x) => x.id);
}

// The option a party likes best on an issue (first of equals).
export function bestOption(issue, partyId) {
  const pts = issue.points[partyId];
  return pts.indexOf(Math.max(...pts));
}

// A cap: an option index this party cannot go past on an issue (a budget
// band, a policy). Offers past it are refused outright, not weighed.
export function violatesCap(brief, partyId, deal) {
  for (const issue of brief.issues) {
    const cap = issue.cap?.[partyId];
    if (cap == null) continue;
    const best = bestOption(issue, partyId);
    // the cap bounds movement away from the party's best option
    if (best <= cap ? deal[issue.id] > cap : deal[issue.id] < cap) return issue.id;
  }
  return null;
}

export function allDeals(brief) {
  let deals = [{}];
  for (const issue of brief.issues) {
    const next = [];
    for (const d of deals) {
      for (let k = 0; k < issue.options.length; k++) next.push({ ...d, [issue.id]: k });
    }
    deals = next;
  }
  return deals;
}

export function sameDeal(a, b) {
  return Object.keys(a).length === Object.keys(b).length && Object.keys(a).every((k) => a[k] === b[k]);
}

// b dominates a when b is at least as good for both and better for one.
function dominates(brief, b, a) {
  const [p, q] = brief.parties.map((x) => x.id);
  const bp = points(brief, p, b);
  const bq = points(brief, q, b);
  const ap = points(brief, p, a);
  const aq = points(brief, q, a);
  return bp >= ap && bq >= aq && (bp > ap || bq > aq);
}

export function paretoFrontier(brief) {
  const deals = allDeals(brief);
  return deals.filter((a) => !deals.some((b) => dominates(brief, b, a)));
}

// A deal that dominates this one, if any — the "money left on the table."
// Prefers the dominating deal with the largest joint gain.
export function moneyOnTheTable(brief, deal) {
  const [p, q] = brief.parties.map((x) => x.id);
  const joint = (d) => points(brief, p, d) + points(brief, q, d);
  let best = null;
  for (const b of allDeals(brief)) {
    if (dominates(brief, b, deal) && (!best || joint(b) > joint(best))) best = b;
  }
  return best;
}

// Everything true about a closed deal, from the arithmetic alone.
export function judgeDeal(brief, deal) {
  const [p, q] = brief.parties.map((x) => x.id);
  const pp = points(brief, p, deal);
  const qp = points(brief, q, deal);
  const frontier = paretoFrontier(brief);
  const maxJoint = Math.max(...frontier.map((d) => points(brief, p, d) + points(brief, q, d)));
  const above = {
    [p]: pp >= party(brief, p).reservation,
    [q]: qp >= party(brief, q).reservation,
  };
  return {
    points: { [p]: pp, [q]: qp },
    joint: pp + qp,
    maxJoint,
    efficiency: (pp + qp) / maxJoint,
    onFrontier: frontier.some((d) => sameDeal(d, deal)),
    aboveReservation: above,
    // The brief's rule: a deal that leaves either side under its
    // walk-away is a loss for both, however the other side scored.
    bothWin: above[p] && above[q],
    moneyOnTheTable: moneyOnTheTable(brief, deal),
  };
}
