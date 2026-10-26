# Intuition Engine

A game framework for growing intuition — the ability to predict an
answer before computing it, to know when you don't know, and to know
which check to run when a person, a textbook, or an AI hands you an
answer.

**Start with `docs/philosophy.md`** — the plan of record for what this
is actually for: training critical thinkers and calibrated generalists
for an AI world. Everything below it is implementation. The subject
matter is interchangeable; the ants and bridges in this repo are a
demonstration, not the product.

## The bet

It used to be that scenarios were the expensive part of educational
software, so you built one scenario and marched every kid through it.
That's inverted now: **scenarios are cheap; the engine and the learning
philosophy are the product.** With an AI coach, the costume around a
lesson can be generated per kid — but only if the things that must stay
honest are separated from the things that are allowed to be generated.

The stack, top to bottom:

1. **The philosophy** (`docs/philosophy.md`) — the invariants any
   implementation must keep: an educator sets the goal and the kid
   picks the world; predict before test; honest ground truth; score
   the goal, never the method; the question-only coach and the
   deliberately fallible Consultant; the spiral; the adult in the
   loop; hard things practiced early; works with zero technology
   first. Plus the test plan for finding out whether any of this
   actually works.
2. **The pedagogy engine** — those invariants as software, shared by
   every subject: the predict gate, calibration scoring, the
   superintendent rule, the Museum of Solutions with human review.
3. **Domain packs** — subjects as plugins, admitted by the contract in
   the philosophy doc: honest ground truth + a concept ladder + goal
   archetypes + a Consultant error taxonomy + a real-world companion.
   Pack #1 is engineering (`docs/intuitive-engineers-brief.md`, and
   the physics in `engine/`); pack #2 is negotiation and communication
   (`docs/intuitive-negotiators-brief.md`); pack #3 is systems — pull
   it apart, break it, fix it (`docs/intuitive-systems-thinkers-brief.md`,
   and the three laws in `systems/`). Anatomy, emergency medicine,
   comedy — same contract, whenever their ground truth is built (the
   systems engine is the physiology model emergency medicine needs). *No
   ground truth, no pack.*
4. **The skin** — generated per kid, disposable. Frogs, ants, spiders
   and termites are the *reference skin*: one person's interests, used
   to prove the games. A kid who loves excavators, dragons, or ballet
   gets the same primitives wearing their world. A level is an
   *archetype* ("span a gap using tension-only and compression
   elements, under budget, holding X") plus a skin; the archetype is
   what gets scored, compared, and archived, so personalization never
   breaks comparability between kids or the teacher's ability to
   judge work.

## What's here

| Path | What it is |
|---|---|
| `docs/philosophy.md` | The plan of record: mission, invariants, the domain pack contract, and how we'd know it's working |
| `docs/` | The domain pack briefs (engineering, negotiation, systems) |
| `engine/` | The shared 2D node-and-member physics engine (plain ES modules, no dependencies): springs with tension/compression limits, tension-only materials, members with their own weight, dynamic relaxation for statics, breakage, and member-shedding topology optimization over every load case. Plus the first goal archetype (`archetypes.js`: span the gap), the kid's design as data (`blueprint.js`: placement rules, the jar, the frog's route), and the crossing (`crossing.js`: cargo walks the kid's bridge, judged quasi-statically). The invariant visual layer too: the strain language every skin performs (`strain.js`: droop, grip, tremble, slip, recoil) and the skin boundary (`manifest.js`: a manifest may hold only pictures and names, an imported model only as a picture with its credits under an accepted license; the physics is frozen). And the scale (`measure.js`): a bridge's breaking load, measured by bisection over real crossings |
| `test/` | Hand-calculation validation (`node --test`): Ohm's law, a divider, an RC charge, clearance's G/K and τ = V/K, a spillway, a doubling time, series and parallel, a thermostat's band, a rating that breaks, a loop with a piece cut; the kidneys, the virus, the car and the bathtub each pinned to their numbers; and spring extension, two-bar truss forces, tension-only slack, breakage, shedding, self-weight, the V bridge's W/(2·sinθ) and its snap and sag limits, the lever rule, placement and routing, the droop curve's length and the recoil's energy, and manifests that try to carry physics. Plus the import portal's rules: glTF parsing (transforms, strips, sparse data, refusals), the sprite rasterizer (framing, views, depth, light, textures), the license and host allowlist, the Poly Pizza door, and the import boundaries between engine, skins, portal and game. And the coach's: the leashes and the caps, the Consultant's curated errors, the library's shape checks, the educator's packet, and the demo's own pure modules — the cargo ladder a grant grows under a costume, the world the shed may never send home, and the words the kid and the grown-up are shown |
| `systems/` | Pack #3's honest core (decisions 2026-10-26, pull it apart): three laws and nothing else — conduct (flows downhill between levels), oneway (one way past a drop), react (a machine: inputs to outputs at its rate) — and a solver that runs them (`solve.js`: backward-Euler nodal analysis, machines rationed, needs, gates, ratings that break parts, the cascade's events; no clock, no dice). A system is parts wired with those laws and honest numbers, frozen on validation (`system.js`), with the bench of everything a kid can do to it: take it out, put in a bad one, put a good one in, add another, put it beside or in line with another, block a flow. The questions are made from the system, never written, and answered by the run (`questions.js`); the Consultant answers three of them and is wrong one time in five (`consultant.js`); something can be secretly wrong (`diagnose.js`). Five systems in `library/`, data only: the flashlight, the kidneys, a flu virus in a cell, the car, the bathtub |
| `negotiation/` | Pack #2's honest core (decisions 2026-10-22, the lens): the hidden brief in the MBA simulation's own format (`brief.js`: issues, options, a point schedule per party, reservation values, caps; Pareto frontier, money on the table), the trust meter's fixed rules (`trust.js`), the scripted counterpart that plays its brief (`counterpart.js`), the predict gate (`prep.js`), the question-only lens (`lens.js`), and the first brief, The Offer Letter (`scenarios/`) |
| `skins/` | The starter skins (decisions 2026-10-22 §6): ants, stuffed animals, knotted sheets — the same tension chain in three costumes, original and generic |
| `portal/` | The import portal's machinery (decisions 2026-10-22 §5–6), no dependencies: `library.js` (the allowlist: which libraries, where their files may come from, which licenses a model may carry, and its credit line), `gltf.js` (a bounds-checked glTF 2.0 reader; Draco and meshopt refused by name), `sprite.js` (normalization, and a small software rasterizer that draws a model once, from a locked camera, into the picture a costume carries) |
| `demo/` | The current playables: Will It Break — the kid builds the bridge, calls it (Feel it: holds/breaks · Measure it: a band in grams, judged by the scale), the cargo walks it, and the lazy colony sheds the kid's own bridge; costume buttons flip the same physics between skins with the numbers on screen (`render.js` draws it). The coach is in the page too (`coachbox.js`): ask it for a thing and it stocks the world — a creature, more ants, wood, a branch, a tree — with the bill for the question shown on purpose, and two free lookups that cost nothing. The Consultant answers and is wrong about one time in five (`advice.js`, thinking in `consultant-worker.js`): trust it, doubt it or run it, then name what kind of wrong it was. Spoken mode reads the game aloud and takes tap-to-pick answers (`speak.js`) — **no speech recognition, ever**. `variant.js` follows a level the coach has granted into. The Lens (`lens.html`) — negotiation practice with a coach in your eye line: commit your read of the other side, talk, see the replay. `educator.html` is the grown-up's window: flags and their evidence, how much a kid is leaning on the coach, the builds waiting to be published, the shared library, and the reader toggle. And `portal.html`, the costume portal: dress the game in CC models and credit them; `serve.js` is the door to Claude, to Poly Pizza, and to the educator's routes. **Pull It Apart** (`apart.html`) is pack #3's playable: pick a system, take a part out, put a bad one in, add another, move it, block it — say what will happen, watch the cascade, see the system as it ships beside the system as it is now; or find the part that's secretly wrong with three checks. **The Workbench** (`workbench.html`) is where a grown-up puts a system in: check it, see it run, read its answer key of every change, tick, and save it to the device's shelf |
| `docs/decisions/` | Append-only decision log from design sessions. **Newest first; these override the briefs where they conflict** |
| `CLAUDE.md` | Standing instructions for any session building here — read it first |

## Running it

```bash
npm test       # validates the engine against hand calculations
npm run demo   # serves the playables at http://localhost:8123/demo/index.html,
               # http://localhost:8123/demo/lens.html and
               # http://localhost:8123/demo/apart.html, the costume portal
               # at http://localhost:8123/demo/portal.html, the Workbench at
               # http://localhost:8123/demo/workbench.html, and the educator's
               # window at http://localhost:8123/demo/educator.html
```

(The demo needs the server: browsers block ES-module imports over
`file://`.)

The live coach needs `ANTHROPIC_API_KEY` set for the demo server —
the key never reaches the browser, and spending is capped per kid per
day in cents. Without it the coach is simply out and the game plays
fine. Name the player and flip the reader toggle in the educator's
window; the game tab follows.

The costume portal searches two libraries. glTF Sample Assets
(Khronos) needs no key; the browser fetches it from
`raw.githubusercontent.com`. Poly Pizza needs each educator's free API
key (from https://poly.pizza/settings/api, with a free account), and
the demo server must be able to reach `api.poly.pizza` and
`static.poly.pizza`, because the portal asks Poly Pizza through the
server. Saved costumes stay on the device and show up in the game's
costume row.

## Status

- [x] Framework plans (both tracks), philosophy, decision log
- [x] Engine v0: statics by dynamic relaxation, honest materials,
      breakage, ant-shedding topology optimization (unit 16)
- [x] The predict gate: Will It Break with binary calls and the
      calibration tally
- [x] The journal: separate commitments, catch scoring, throwaway
      detection, the adaptation ladder behind the feed-line test
- [x] The kid places ants (authorship; decisions 2026-10-22 §8 step 1):
      drag to lay ants from a 30-ant jar, the frog walks whatever the
      kid built, the shed runs on the kid's own bridge. Sag against
      tension is the first lesson the level teaches on its own: the
      same ten ants snap pulled taut, hold hung in a U, and dunk the
      frog hung too deep
- [x] Strain language + skin manifests + the same-archetype toggle
      (step 2): links droop, grip, tremble, slip one by one, and
      recoil at the speed their stored strain energy gives them, in
      every skin; three starter skins; flip costumes at any moment
      and every number on screen stays put
- [x] The negotiators pack opens (decisions 2026-10-22, the lens):
      hidden briefs with point schedules as honest ground truth, the
      trust meter by fixed rules, a scripted counterpart, the predict
      gate before the first word and before every offer, and the
      lens — the question-only coach in the eye line, trust meter
      shown only in the replay. The Offer Letter is the first brief
- [x] The import portal (step 3): a manifest editor pointed at an
      allowlist of CC libraries — glTF Sample Assets (Khronos, no key)
      and Poly Pizza (an educator's free key, through the demo server).
      A model is used only if every contributor's license is CC0 or
      CC BY (NC, ND, SA and anything else refused, with the reason).
      It is read by a zero-dependency glTF loader, recentered and
      scaled to its binding, and drawn once from a locked camera into
      a picture (2.5D: the physics stays on the plane), so it performs
      the strain language like any skin. Every model is credited
      TASL-style under the game. Nothing saves until the educator ticks
      that they've looked. The allowlist and the credit format answer
      the decision log's open item and await a decision file to ratify
      them
- [x] Band predictions (measure mode; decisions 2026-10-24): the kid
      commits "my bridge holds between __ and __ grams," then the scale
      — bisection over full, honest crossings of their own bridge —
      finds the heaviest cargo that crosses dry, narrating every probe,
      and the heaviest load that held walks the bridge on stage. The
      scale is a frozen instrument on the archetype (0–500 g at 5 g,
      REVISIT); the journal's band machinery, already built, scores the
      reading against the band and keeps feeding the width detectors
- [x] The coach arrives (decisions 2026-10-25, five files): live
      Claude behind a leash it cannot talk its way past — the reply
      must be a question, a grant is re-validated against a level the
      server replays from the grant list itself, and the prompt is
      built from a whitelist of what the kid can see. The coach may
      stock the world (a creature, links, wood or silk, rocks, a
      composed fixture) but never build the kid's bridge, and every
      grant makes a new frozen level variant. Fixtures go onto a
      shared library every coach grabs from before composing anew;
      builds the coach doubts wait for an adult on the pending shelf.
      Questions are never refused — the per-problem budget is a pacing
      meter and the daily cents guard is the only wall, with a free
      canned question behind it. The kid sees the bill, because
      budgeting is curriculum. The Consultant answers and is wrong
      about one time in five, in curated ways catchable by reasoning
      against reality; the kid commits trust / doubt / run-it before
      the predict gate and names the error afterwards. Spoken mode
      plays the whole game before reading does — speechSynthesis and
      tap-to-pick pictures, and **never** speech recognition: a kid's
      voice does not leave the machine. The educator's window holds
      everything the kid must not see
- [x] The systems pack opens (decisions 2026-10-26, pull it apart):
      three laws — conduct, oneway, react — and a solver, so nothing a
      kid sees is written down in advance. The bench holds every
      question as an intervention: take it out, put in a bad one, put a
      good one in, add another, put it beside or in line with another,
      block it; what a run breaks stays broken. Questions are made from
      the system and answered by the run — will it still work, more or
      less, which stops first, does that one keep working, what's this
      part's job, how much, when — rotating kind by kind, with the
      research they lean on cited in the decision. The Consultant errs in
      the systems taxonomy (the forgotten spare, the buffer that empties,
      the stock with no way out). Something's wrong: three checks, then
      swap. Five systems pinned to hand calculations, Pull It Apart for
      the kid and the Workbench for the grown-up who puts a system in. It
      runs beside the engineers' build order, which is unchanged
- [ ] **Next: not decided yet.** A new decision file picks what
      follows; the queued candidates are sag-depth bands, the water
      pack (buoyancy and hydrostatic load, which pontoons and real
      dams wait on), and a local speech-to-text listener so the mic
      button can exist — plus the portal's still-open license
      ratification
