// The lazy colony: member-shedding topology optimization (unit 16).
//
// Greedy evolutionary structural optimization, one member at a time so a
// kid can watch each decision: find the laziest removable member (lowest
// utilization), let it go, re-settle, and keep it gone only if the goal
// still holds. Essential members are remembered and never tried again.
// Freed nodes that no longer touch the structure walk away (pruned), so
// they don't rain through the scene forever.
//
// goal(model) -> boolean is checked after every settle, and must not
// mutate the model. Levels build goals from what must be TRUE (deck
// height, nothing overloaded), never from method.

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

export function shed(
  model,
  { removable = (m) => m.material.name === 'ant', goal, settleOpts } = {},
) {
  settle(model, settleOpts);
  if (!goal(model)) {
    return { feasible: false, removed: [], essential: [] };
  }

  const removed = [];
  const essential = new Set();

  for (;;) {
    const candidates = activeMembers(model)
      .filter((m) => removable(m) && !essential.has(m))
      .sort((x, y) => utilization(x) - utilization(y));
    if (candidates.length === 0) break;

    const laziest = candidates[0];
    const before = saveState(model);
    laziest.broken = true;
    laziest.force = 0;
    settle(model, settleOpts);

    if (goal(model)) {
      removed.push(laziest);
      pruneOrphans(model);
    } else {
      restoreState(model, before);
      essential.add(laziest);
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
