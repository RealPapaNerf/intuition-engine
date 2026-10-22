// Goal archetypes: level skeletons stated as outcomes, with no skin in
// them. An archetype fixes everything honest about a level — the world's
// geometry, the material and its limits, the budget, the cargo, the goal
// — so every skin of it solves to the same numbers (decisions 2026-10-22
// §4: "stronger ants" is a different level, not a different skin).
//
// Grid points are integer pairs [i, j] at x = i·step, y = j·step (meters,
// y up). Units are SI throughout, like materials.js.

import { ANT } from './materials.js';
import { deepFreeze } from './freeze.js';

// Span the gap: get the cargo from one bank to the other over links the
// kid places, under budget. The goal, checked by physics and never by
// method: the cargo reaches the far bank, stays above dryY the whole way,
// and no link lets go.
//
// The jar is marked REVISIT: 30 was picked by simulation (room for the
// ten-ant answers, the twenty-odd-ant experiments, and a few mistakes)
// and wants Stage 0 data — watching a kid build — before it moves.
//
// The banks are the columns i = 0 and i = 10. Every grid point there is
// an anchor: the cliff face below the bank top (j < 0), the bank edge
// itself (j = 0, where the cargo steps on and off), and a tall fixed
// support above it (j > 0). Nothing asks the kid to use the tall
// support — it is slack in the world (decisions 2026-10-22 §1), and the
// suspension bridge is waiting in it for whoever finds it.
const I_MAX = 10;
const J_MIN = -3;
const J_MAX = 3;

function bankColumn(i) {
  const points = [];
  for (let j = J_MIN; j <= J_MAX; j++) points.push([i, j]);
  return points;
}

// Frozen all the way down: a skin, or anything else at runtime, cannot
// change a single honest number of the level it dresses.
export const SPAN_GAP = deepFreeze({
  id: 'span-gap',
  material: ANT,
  jar: 30, // links the kid may place                      REVISIT
  step: 0.1,
  bounds: { iMin: 0, iMax: I_MAX, jMin: J_MIN, jMax: J_MAX },
  anchors: [...bankColumn(0), ...bankColumn(I_MAX)],
  start: [0, 0],
  end: [I_MAX, 0],
  waterY: -0.4,
  dryY: -0.36, // the cargo stays dry above this
  cargo: [0.02, 0.05, 0.1, 0.2], // kg
});
