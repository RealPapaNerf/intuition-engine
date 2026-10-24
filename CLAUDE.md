# Intuition Engine — standing instructions

Read this before doing anything in this repo.

## 1. FIRST: check for unmerged branches

Sessions working here cannot see each other, and this repo already
takes PRs from parallel sessions. Before writing a line:

```bash
git fetch origin --prune
for b in $(git branch -r | grep -v HEAD | grep -v origin/main); do
  echo -n "$b — commits not in main: "
  git rev-list --count origin/main..$b
done
```

Any branch with a non-zero count has work main does not. Read those
commits before starting; if they touch what you're about to touch,
resolve that first rather than writing a second version of the same
thing.

## 2. Reading order for a new session

1. `README.md` — what this is and what exists.
2. `docs/philosophy.md` — the plan of record: mission, the nine
   invariants, the domain pack contract, the adaptation leash.
3. `docs/decisions/` — **newest first. Decision files override the
   briefs and the README where they conflict.** They are append-only:
   never edit an old one; a new decision gets a new dated file.
4. The pack briefs (`intuitive-engineers-brief.md`,
   `intuitive-negotiators-brief.md`) for the long-range design.

The negotiators pack (`negotiation/`, `demo/lens.html`) runs in
parallel to the engineers pack — see
`docs/decisions/2026-10-22-the-lens.md`. The lens only asks; the trust
meter is never shown live; a brief's numbers are frozen like a
material's.

**The build order so far:** the 2026-10-22 §8 sequence (placement →
strain language and skins → the import portal) is complete, and band
predictions — measure mode — followed it, built per
`docs/decisions/2026-10-24-band-predictions.md`. The next step is not
decided; it takes a new decision file, as always.

## 3. Hard rules that bind code

These are invariants, not preferences. A change that violates one is
wrong even if it works.

- **Honest physics only.** No canned outcomes anywhere; every new sim
  behavior gets a hand-calculation test in `test/` (see
  `engine.test.js` for the pattern). The solver stays 2D; imported
  meshes may be 3D (2.5D render), but the physics never follows them.
- **Skins never touch physics.** A skin is a manifest binding
  primitives to meshes — it may not carry or alter a single physics
  value. Grip limits, stiffness, goals belong to the level/archetype.
  "Stronger ants" is a different level, not a different skin.
- **The feed line.** Adaptation optimizes for prediction quality,
  never session length. `engine/journal.js` takes no engagement-time
  input, and the duration-invariance test in `test/journal.test.js`
  must keep passing; any new adaptation signal must be added to that
  test.
- **The coach only asks; the Consultant's errors are curated.** Coach
  text never answers, classifies the kid, or onboards. Consultant
  errors must be catchable by reasoning against reality (units, sign,
  scaling, limiting case, order of magnitude, calibrated prior) —
  never by tone.
- **Kid-visible vs adult-only.** The kid sees the prestige stats
  (calibration, streak). Disengagement flags and their evidence go
  only through `adultFlag()` and are never rendered to the kid.
- **Score the goal, never the method.** Level checks test what is
  true, not how it was done. Sim-breaking is a badge, not cheating.

## 4. Conventions

- Plain ES modules, **zero runtime dependencies** — keep it that way
  unless a decision file says otherwise. `node --test` for tests.
- `npm test` must be green before every commit. Run the demo with
  `npm run demo` (browsers block ES-module imports over `file://`,
  which is why `demo/serve.js` exists).
- Numeric thresholds marked `REVISIT` (`engine/journal.js`
  `THRESHOLDS`, future strain-state cutoffs) are placeholders awaiting
  Stage 0 kitchen-table data. Change them with observed data, not
  taste, and say so in the commit.
- The demo is the current playable, not a throwaway: it is where each
  engine capability is proven in front of a kid. Keep it working.
- Headless verification: Playwright is preinstalled in cloud sessions
  (`/opt/node-tools/node_modules/playwright`, Chromium at
  `/opt/pw-browsers/chromium`). Drive the demo and screenshot it
  before claiming UI work done.

## 5. What this project is, in one line

Scenarios are cheap and generated per kid; the honest primitives, the
predict-before-test loop, and the concept ladders are the product —
the engine trains kids to know when they don't know and know what
check to run.
