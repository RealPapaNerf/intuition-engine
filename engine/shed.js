// The lazy colony: member-shedding topology optimization (unit 16).
//
// Greedy evolutionary structural optimization, one member at a time so a
// kid can watch each decision: find the laziest removable member (lowest
// utilization), let it go, re-settle, and keep it gone only if the goal
// still holds. Essential members are remembered and never tried again.
// Freed nodes that no longer touch the structure walk away (pruned), so
// they don't rain through the scene forever.
//
// goal(model, caseIndex) -> boolean is checked after every settle, and
// must not mutate the model. Levels build goals from what must be TRUE
// (deck height, nothing overloaded), never from method.
//
// loadCases (optional): functions that each put the model into one load
// case — the cargo standing on each joint of its route, say (see
// crossingCases in crossing.js). Each must set every load it touches.
// The structure must meet the goal in every case, and a member's
// laziness is its highest utilization across them: an ant idle while the
// frog is at one end may be essential when it is at the other. Omitted,
// the model as it stands is the only case.

import { activeMembers, utilization } from './model.js';
import { settle } from './solver.js';

function saveState(model) {
  return {
    nodes: model.nodes.map((n) => [n.x, n.y, n.vx, n.vy]),
    members: model.members.map((m) => [m.broken, m.force]),
  };
}

function restoreState(model, s) {
  model.nodes.forEach((n, i) => {
    [n.x, n.y, n.vx, n.vy] = s.nodes[i];
  });
  model.members.forEach((m, i) => {
    [m.broken, m.force] = s.members[i];
  });
}

function pruneOrphans(model) {
  const used = new Set();
  for (const m of activeMembers(model)) {
    used.add(m.a);
    used.add(m.b);
  }
  model.nodes = model.nodes.filter((n) => n.fixed || used.has(n));
}

export function shed(model, opts) {
  const steps = shedSteps(model, opts);
  for (;;) {
    const { done, value } = steps.next();
    if (done) return value;
  }
}

// The same shed, one decision at a time: yields { removed } or
// { essential } after each member is tried, and returns what shed()
// returns. A game can pump it a few decisions per frame and show each
// ant letting go the moment the colony decides, instead of freezing
// while it thinks.
export function* shedSteps(
  model,
  {
    removable = (m) => m.material.name === 'ant',
    goal,
    settleOpts,
    loadCases = [() => {}],
  } = {},
) {
  // Settle every case; null at the first one that misses the goal, else
  // each member's highest utilization across the cases.
  const evaluate = () => {
    const envelope = new Map();
    for (let i = 0; i < loadCases.length; i++) {
      loadCases[i](model);
      settle(model, settleOpts);
      if (!goal(model, i)) return null;
      for (const m of activeMembers(model)) {
        envelope.set(m, Math.max(envelope.get(m) ?? 0, utilization(m)));
      }
    }
    return envelope;
  };

  let envelope = evaluate();
  if (envelope === null) {
    return { feasible: false, removed: [], essential: [] };
  }

  const removed = [];
  const essential = new Set();

  for (;;) {
    const candidates = activeMembers(model)
      .filter((m) => removable(m) && !essential.has(m))
      .sort((x, y) => envelope.get(x) - envelope.get(y));
    if (candidates.length === 0) break;

    const laziest = candidates[0];
    const before = saveState(model);
    laziest.broken = true;
    laziest.force = 0;
    const next = evaluate();

    if (next !== null) {
      removed.push(laziest);
      pruneOrphans(model);
      envelope = next;
      yield { removed: laziest };
    } else {
      restoreState(model, before);
      essential.add(laziest);
      yield { essential: laziest };
    }
  }

  return { feasible: true, removed, essential: [...essential] };
}

// A standard goal: nothing overloaded, and every watched node (the deck
// the cargo stands on) stayed above minY. Checked on the settled state —
// statics; dynamic breakage during play is the solver's checkBreaks.
export function makeGoal({ watchNodes, minY }) {
  return (model) => {
    for (const m of activeMembers(model)) {
      if (utilization(m) > 1) return false;
    }
    return watchNodes.every((n) => n.y >= minY);
  };
}
