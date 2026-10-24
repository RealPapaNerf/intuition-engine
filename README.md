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
| `engine/` | The shared 2D node-and-member physics engine (plain ES modules, no dependencies): springs with tension/compression limits, tension-only materials, members with their own weight, dynamic relaxation for statics, breakage, and member-shedding topology optimization over every load case. Plus the first goal archetype (`archetypes.js`: span the gap), the kid's design as data (`blueprint.js`: placement rules, the jar, the frog's route), and the crossing (`crossing.js`: cargo walks the kid's bridge, judged quasi-statically). The invariant visual layer too: the strain language every skin performs (`strain.js`: droop, grip, tremble, slip, recoil) and the skin boundary (`manifest.js`: a manifest may hold only pictures and names, an imported model only as a picture with its credits under an accepted license; the physics is frozen) |
| `test/` | Hand-calculation validation (`node --test`): spring extension, two-bar truss forces, tension-only slack, breakage, shedding, self-weight, the V bridge's W/(2·sinθ) and its snap and sag limits, the lever rule, placement and routing, the droop curve's length and the recoil's energy, and manifests that try to carry physics. Plus the import portal's rules: glTF parsing (transforms, strips, sparse data, refusals), the sprite rasterizer (framing, views, depth, light, textures), the license and host allowlist, the Poly Pizza door, and the import boundaries between engine, skins, portal and game |
| `negotiation/` | Pack #2's honest core (decisions 2026-10-22, the lens): the hidden brief in the MBA simulation's own format (`brief.js`: issues, options, a point schedule per party, reservation values, caps; Pareto frontier, money on the table), the trust meter's fixed rules (`trust.js`), the scripted counterpart that plays its brief (`counterpart.js`), the predict gate (`prep.js`), the question-only lens (`lens.js`), and the first brief, The Offer Letter (`scenarios/`) |
| `skins/` | The starter skins (decisions 2026-10-22 §6): ants, stuffed animals, knotted sheets — the same tension chain in three costumes, original and generic |
| `portal/` | The import portal's machinery (decisions 2026-10-22 §5–6), no dependencies: `library.js` (the allowlist: which libraries, where their files may come from, which licenses a model may carry, and its credit line), `gltf.js` (a bounds-checked glTF 2.0 reader; Draco and meshopt refused by name), `sprite.js` (normalization, and a small software rasterizer that draws a model once, from a locked camera, into the picture a costume carries) |
| `demo/` | The current playables: Will It Break — the kid builds the bridge, calls it, the cargo walks it, and the lazy colony sheds the kid's own bridge; costume buttons flip the same physics between skins with the numbers on screen (`render.js` draws it). The Lens (`lens.html`) — negotiation practice with a coach in your eye line: commit your read of the other side, talk, see the replay. And `portal.html`, the costume portal for grown-ups: dress the game in CC models and credit them; `serve.js` is its door to Poly Pizza |
| `docs/decisions/` | Append-only decision log from design sessions. **Newest first; these override the briefs where they conflict** |
| `CLAUDE.md` | Standing instructions for any session building here — read it first |

## Running it

```bash
npm test       # validates the engine against hand calculations
npm run demo   # serves the playables at http://localhost:8123/demo/index.html
               # and http://localhost:8123/demo/lens.html, and the costume
               # portal at http://localhost:8123/demo/portal.html
```

(The demo needs the server: browsers block ES-module imports over
`file://`.)

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
- [ ] **Next: not decided yet.** The 2026-10-22 build order (§8) is
      done; a new decision file picks what follows
- [ ] Band predictions with error bands (measure mode)
- [ ] The Consultant; the AI coach
