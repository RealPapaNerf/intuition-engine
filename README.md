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
   (`docs/intuitive-negotiators-brief.md`). Anatomy, emergency
   medicine, comedy — same contract, whenever their ground truth is
   built. *No ground truth, no pack.*
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
| `docs/` | The domain pack briefs (engineering, negotiation) |
| `engine/` | The shared 2D node-and-member physics engine (plain ES modules, no dependencies): springs with tension/compression limits, tension-only materials, members with their own weight, dynamic relaxation for statics, breakage, and member-shedding topology optimization over every load case. Plus the first goal archetype (`archetypes.js`: span the gap), the kid's design as data (`blueprint.js`: placement rules, the jar, the frog's route), and the crossing (`crossing.js`: cargo walks the kid's bridge, judged quasi-statically). The invariant visual layer too: the strain language every skin performs (`strain.js`: droop, grip, tremble, slip, recoil) and the skin boundary (`manifest.js`: a manifest may hold only pictures and names; the physics is frozen) |
| `test/` | Hand-calculation validation (`node --test`): spring extension, two-bar truss forces, tension-only slack, breakage, shedding, self-weight, the V bridge's W/(2·sinθ) and its snap and sag limits, the lever rule, placement and routing, the droop curve's length and the recoil's energy, and manifests that try to carry physics |
| `skins/` | The starter skins (decisions 2026-10-22 §6): ants, stuffed animals, knotted sheets — the same tension chain in three costumes, original and generic |
| `demo/` | The current playable: Will It Break — the kid builds the bridge, calls it, the cargo walks it, and the lazy colony sheds the kid's own bridge; costume buttons flip the same physics between skins with the numbers on screen (`render.js` draws it) |
| `docs/decisions/` | Append-only decision log from design sessions. **Newest first; these override the briefs where they conflict** |
| `CLAUDE.md` | Standing instructions for any session building here — read it first |

## Running it

```bash
npm test       # validates the engine against hand calculations
npm run demo   # serves the playable at http://localhost:8123/demo/index.html
```

(The demo needs the server: browsers block ES-module imports over
`file://`.)

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
- [ ] **Next (build order decided — decisions 2026-10-22 §8):**
      import portal (glTF from an allowlist, educator-curated) — a
      manifest editor pointed at a CC library
- [ ] Band predictions with error bands (measure mode)
- [ ] The Consultant; the AI coach
