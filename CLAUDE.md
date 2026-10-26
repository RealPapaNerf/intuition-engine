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
   `intuitive-negotiators-brief.md`, `intuitive-systems-thinkers-brief.md`)
   for the long-range design.

The negotiators pack (`negotiation/`, `demo/lens.html`) runs in
parallel to the engineers pack — see
`docs/decisions/2026-10-22-the-lens.md`. The lens only asks; the trust
meter is never shown live; a brief's numbers are frozen like a
material's.

The systems pack (`systems/`, `demo/apart.html`, `demo/workbench.html`)
runs in parallel too — see `docs/decisions/2026-10-26-pull-it-apart.md`.
Pull a system apart, break it, fix it: three laws (conduct, oneway,
react) and a solver are its whole physics; a kid's every question is an
intervention on the bench (out, bad, good, another, beside / in line,
blocked); the questions are made from the system and answered by the
run, never written down; and a grown-up reads a system's answer key at
the Workbench before any kid plays it. It is built — engine, five
systems, both pages — and does not reorder the engineers' build order.

**The build order so far:** the 2026-10-22 §8 sequence (placement →
strain language and skins → the import portal) is complete; band
predictions — measure mode — followed (2026-10-24); and the coach step
is decided and its engine/server half built per the five 2026-10-25
decision files (newest wins where they conflict): `the-coach-arrives`,
`the-fixture-library`, `free-items-honest-physics`,
`questions-are-not-the-ration` (questions never refused; cents guard
the only wall; spoken mode — **no cloud speech-to-text, ever**),
`grant-freely-publish-carefully` (library auto-publishes; doubted
builds pend for an adult). **The demo UI that wears all of it is built
too** — the whole 16-item handoff list in coach-arrives §7,
fixture-library §4, free-items §6, questions §7 and grant-freely §5:
the coach box and its ticker, the Consultant's gate and postmortem,
multi-material placement, fixture and granted-cargo rendering, spoken
mode, the intro card, and `demo/educator.html`. Two readings the
decision files left open were settled in code and said so in the
commits: the Consultant's "unit-3 depth" is the demo's Feel/Measure
toggle (so it starts on when measuring, and a button pins it either
way), and "verify it" is the journal's `deferred`.

**Then the kitchen table opened** (Stage 0), and what it found became
three more decision files. `the-debrief` is **built**: the kid is
actually asked one now, including on a problem they resolved after
failing it, which 2026-10-19 §7 did not have, and it spends nothing.
Stage 0 also found that a server started without `ANTHROPIC_API_KEY`
grants nothing, so the kid's page now says plainly when no coach is
there.

`the-kid-places-it` and `the-setting-and-the-shelf` are **decided and
not yet built** — the next build order is the second one's §8: the
shelf the kid takes from (which unblocks a keyless table), then
inventory and placing, then the build meter in cents, then the
educator's question queue, then settings. Read both before touching
grants, the library or the coach's economy: between them they retire
free items §4, correct what "level authoring" means, and make the
money about building rather than talking.

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
- **A system file chooses laws, never writes one.** `systems/` has three
  laws; a system picks among them, wires them and gives them numbers,
  and says what it models, where the numbers come from and what it
  leaves out. A new law (a motor's coupling, drag's square) takes its
  own decision file and hand calculations. Every system a kid plays has
  been read — its answer key, every change run — by an adult first; an
  AI-composed one most of all.

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
