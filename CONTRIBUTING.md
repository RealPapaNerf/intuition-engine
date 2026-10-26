# Contributing to Intuition Engine

Thanks for being here. This project exists to spread an idea — an
engine that trains kids to know when they don't know and what check to
run — and it gets better with more hands on it. Contributions are
welcome, from a typo fix to a whole domain pack.

## Before you write code

Read, in this order:

1. `README.md` — what this is and what exists.
2. `docs/philosophy.md` — the plan of record: the mission, the nine
   invariants, the domain pack contract.
3. `docs/decisions/` — newest first. Decision files override the
   briefs and the README where they conflict.

For anything bigger than a bug fix, **open an issue first** and
describe what you want to build and why. That costs you ten minutes
and can save you a week: it catches work that collides with a decision
already made, or with a branch already in flight.

## The invariants

These bind every contribution. A pull request that violates one will
be declined even if the code works — they are what the project *is*,
not style preferences. The full statements live in `CLAUDE.md` and
`docs/philosophy.md`; in short:

- **Honest physics only.** No canned outcomes. Every new sim behavior
  ships with a hand-calculation test in `test/` (see `engine.test.js`
  for the pattern). The solver stays 2D.
- **Skins never touch physics.** A skin binds primitives to meshes and
  carries no physics values. "Stronger ants" is a different level,
  not a different skin.
- **Adaptation never optimizes for session length.** `engine/journal.js`
  takes no engagement-time input; the duration-invariance test must
  keep passing, and any new adaptation signal must be added to it.
- **The coach only asks.** Coach text never answers, classifies the
  kid, or onboards. Consultant errors are curated and catchable by
  reasoning against reality — never by tone.
- **Kid-visible vs adult-only.** Disengagement flags go only through
  `adultFlag()` and are never rendered to the kid.
- **Score the goal, never the method.** Sim-breaking is a badge, not
  cheating.

## How this project is governed

This project is vision-led. `docs/philosophy.md` is the constitution;
the dated files in `docs/decisions/` amend it; the maintainer is their
steward and has the final word on what fits. That is deliberate: the
product here is a small set of load-bearing invariants, strictly kept —
not a thick rulebook — and committees are how thick rulebooks happen.

Disagreement is welcome, argued in writing against the philosophy, in
issues and decision-file PRs. The best contributions so far at any
given moment will be the ones that read the philosophy and push on it
from the inside. And if you want this to become something the
philosophy rules out, the MIT license is your friend: fork it and
build your version. That is not a hostile act here — solving the
problem a way the original author never imagined is literally
invariant 4.

## How changes are decided

Design decisions live in `docs/decisions/` as dated files, append-only.
Never edit an old one. If your change reverses or extends a decision,
your pull request includes a new dated decision file saying what
changed and why — that file is the proposal, and discussion happens on
the PR or its issue.

## Mechanics

- Plain ES modules, **zero runtime dependencies**. Adding a dependency
  requires a decision file that says so.
- Tests run with `node --test`; `npm test` must be green before every
  commit.
- Run the playable with `npm run demo`. The demo is where each engine
  capability is proven in front of a kid — keep it working, and for UI
  changes include a screenshot in the PR.
- Numeric thresholds marked `REVISIT` are placeholders awaiting
  observed kitchen-table data. Change them with data, not taste, and
  say so in the commit.

## Pull requests

- Fork the repo, branch from `main`, open a PR against `main`.
- Keep PRs small and single-purpose; say what changed and why.
- CI runs the test suite on every PR; it must pass.
- The maintainer reviews every PR. Expect questions about invariants —
  that's the review doing its job.

## Licensing

The project is MIT-licensed. By submitting a contribution you agree it
is licensed under the same terms (inbound = outbound). Meshes and
other assets you include must carry licenses compatible with
redistribution, stated in the PR.
