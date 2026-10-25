# 2026-10-25 — The coach arrives: Claude behind the leash, the quartermaster, the Consultant, the educator's window

Band predictions (2026-10-24) are built and merged. This file decides the
next step, per the standing rule: **the live AI coach arrives, powered by
the Claude API, alongside the canned Consultant and the educator's
window.** Decided by the owner, 2026-10-25. Everything below binds the
build.

This session builds the parts where a wrong decision is expensive — the
engine modules, the server, the leashes, and their tests. The demo UI
that wears them is deliberately left for a follow-up build session; §7
is that session's contract.

## 1. Two AIs, one lesson (invariant 5, unchanged)

- **The Coach** is live Claude. It only asks — and now, one new verb,
  §2's granting. It never predicts, never answers, never places a link,
  never classifies the kid.
- **The Consultant** stays a curriculum pretending to be an AI: canned
  error *types* applied to honest *numbers*, wrong about 1 time in 5,
  deterministic per setup. It is never a live model — with live output
  we cannot control the error, and the error is the lesson.

The kid's intuition for AI comes from the pair: the one you can trust
never answers; the one that answers must be checked.

## 2. The coach may grant, never solve — the quartermaster amendment

The brief says the coach "never builds for the kid." That stands, with
its meaning made precise. What the coach must never build is **the
solution**: the kid's bridge, the kid's prediction, the kid's check.
What it may now do is **stock the world**: invariant 1 says the kid
picks the world, and there is no reason that stops at level start. Are
there branches in the forest? Then a kid may ask for one. A rock, a
slug, more ants, a monkey — the coach grants the thing asked for.

The line that keeps invariant 5 alive:

- **Grants change the world or the jar, never the bridge.** A grant is
  stock to place, a creature to carry, ground to anchor to. The coach
  never places anything, and never grants *to fix a design* — only when
  the kid asks for a thing.
- **A grant may not carry physics.** Materials come only from the
  catalog (`engine/materials.js`); a granted creature's only honest
  number is its mass, clamped to the level's scale. "Stronger ants"
  remains a different level an educator authors, never a grant.
- **Every grant makes a new level** — a *variant*: the base archetype
  plus an ordered grant list, deep-frozen, with its own id
  (2026-10-22 §4: more ants is a different level, not a different
  skin). Journal entries carry the variant id, so calibration, seen
  setups, and any future Museum never mix levels that differ.

Grant kinds, v1 (all validated by `engine/grants.js`, bounds REVISIT):

| kind | the ask | what changes |
|---|---|---|
| `cargo` | "is there a slug/monkey?" | a new mass joins the cargo ladder, 0 < m ≤ scale max, on the resolution grid; its name is display-only (`grantedCargo`) |
| `links` | "can I have more ants?" | the jar grows, capped (60) |
| `stock` | "is there a branch? silk?" | a stash of `wood` or `silk` links the kid places, capped (20 each) |
| `anchor` | "can I dump rocks in?" | new anchor grid points inside bounds, capped (8 added) |

Multi-material placement rides on the blueprint: a link may carry a
material name (`[p, q, 'wood']`); untagged links are the level's base
material, budgeted by the jar; tagged links are budgeted by the stock.
One link per point pair, whatever it's made of. `buildModel` resolves
names through the frozen catalog — the granted plank is real WOOD with
WOOD's honest limits, and the hand-calc test pins the new path the same
way the ant's was pinned. (Catalog creature masses for wood and silk
are unset — granted stock places massless members for now; REVISIT with
the materials pack.)

## 3. The Claude door: server-side, capped, mutable

- The key lives in `ANTHROPIC_API_KEY` on the demo server, never in the
  browser. `coach/service.js` is the one door, wired into
  `demo/serve.js` exactly like the Poly Pizza door: Node's built-in
  fetch, zero runtime dependencies (the standing convention holds; this
  file is the decision that raw HTTP, not the SDK, is how this repo
  calls Claude).
- Model: `claude-opus-5-5`, small `max_tokens`, structured output
  (`output_config.format`) so the reply is always
  `{ question, grant | null }` — parseable, leash-checkable, no tool
  loop, one request per ask. Server-side refusal fallback is on
  (`fallbacks: "default"`).
- **The session cap is the credit guard**: per kid per day, a call cap
  and an output-token cap (`COACH_CAPS`, REVISIT), enforced in the
  service, counted from the API's own `usage`. When the jar of
  questions is empty the coach goes quiet and says so once; the game
  never blocks (the coach has always been mutable — no key, same
  thing).
- **The leash is checked, not trusted.** A reply whose text isn't a
  question is replaced by a canned question. A grant is validated by
  the same `engine/grants.js` the client uses, against a variant the
  server *replays from the grant list itself* — the client's level is
  never taken on faith. An invalid grant is dropped, never negotiated.
- **The coach is told only what the kid can see.** The service builds
  its prompt from a whitelist (level id, mode, jar, links placed,
  kid-visible calibration, grants, the kid's words). Adult-only flags
  never reach the coach's context, whatever the client posts. The
  kid's words go in as data, marked as a kid talking, never as
  instructions.

## 4. The Consultant engine

`engine/consultant.js`. The Consultant computes the honest truth first
— the real breaking load by the real ladder (measure), the real
crossing (feel) — then a seeded draw (deterministic per kid + setup +
round, so there is no reroll-fishing) makes it wrong ~1 in 5. Wrongness
is a curated transform from the 2026-10-19 taxonomy, never noise:

- measure: magnitude (×10), unit slip (÷10), and for a bridge that
  carries nothing, a confident nonzero claim (limiting case: no bridge
  should mean no load).
- feel: the opposite verdict — argued for the wrong cargo when another
  cargo's verdict genuinely differs (answered a different question),
  confident nonsense otherwise.

Every transform is catchable by reasoning against reality (a 10×
number, the wrong animal named, a claim that a bridge that isn't there
carries weight) and never produces the true value. The engine returns
the claim, the error type, and the truth (for the postmortem); the
journal's existing `consultant` field records the kid's separate trust
commitment, as decided 2026-10-19 §4.

## 5. The educator's window

`coach/educator.js`, two routes on the demo server. The demo posts the
kid's journal entries (`POST /educator/log`); the educator's page reads
per-kid attempts and flags (`GET /educator/flags`). The flags are
exactly `journal.js`'s `fingerprint` / `recommend` / `adultFlag` —
nothing new is detected, the existing adult-only packet finally has
somewhere to go. Bored shows up as what it already is: narrow bands,
high hit rate, flagged to the adult, invisible to the kid. Entries
persist as JSONL under `demo/.educator-log/` (gitignored); no auth on
the educator routes yet — kitchen-table trust, REVISIT before any
classroom.

## 6. What this does not change

The journal takes no new inputs — grants and coach traffic add no
engagement-time signal, and the duration-invariance test keeps passing.
The solver stays 2D. Skins still never touch physics; a skin validates
against the **base** archetype, and granted cargo renders generically
until a costume is authored for it. The Consultant's 1-in-5 and all
caps/bounds here are REVISIT numbers awaiting Stage 0 data.

## 7. Left for the build session (the routine parts)

1. **Coach UI**: a small ask box + the coach's question line in
   `demo/index.html`, calling `POST /coach/ask`, applying returned
   grants via `applyGrant`, swapping the live level to the variant
   (LEVEL becomes mutable state in `main.js`; `levelId()` and skin
   validation follow `level.base`). Show the spent/left question count.
2. **Consultant UI**: the advice line before the predict gate from
   unit-3 depth on, the trust / doubt / verify commitment buttons, and
   the postmortem "what kind of wrong was it?" — writing the journal's
   `consultant` field the engine already scores.
3. **Multi-material placement**: a stock picker when a variant has
   stock; `snapshot()` in `main.js` must copy the material tag.
4. **Educator page** (`demo/educator.html`): kids list, attempts,
   alert badge on a non-null signal, the adultFlag evidence unfolded.
5. Granted-cargo generic rendering (name + blob at the right size).

The engine/server API these parts consume is in place and tested; none
of them may weaken a leash to get built.
