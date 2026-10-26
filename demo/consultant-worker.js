// The Consultant thinks off the main thread. Its advice costs a real
// breaking-load ladder or a real crossing — honest numbers first, the
// curated wrongness after (engine/consultant.js) — which is most of a
// second of solving, and the game must keep drawing while it happens.
// The same budget-a-frame rule the scale plays by, in the only form a
// single synchronous call allows.
//
// Nothing here decides an outcome: it replays the level from its grant
// list and hands the engine the kid's own blueprint.

import { replayGrants, makeBlueprint, consult } from '../engine/index.js';

self.onmessage = ({ data }) => {
  const { id, base, grants, links, mode, cargoIndex, seed } = data ?? {};
  try {
    const level = replayGrants(base, grants ?? []);
    const advice = consult({ level, design: makeBlueprint(links ?? []), mode, cargoIndex, seed });
    self.postMessage({ id, advice });
  } catch (e) {
    self.postMessage({ id, error: e.message });
  }
};
