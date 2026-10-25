# 2026-10-25 — Fixtures and the coaches' library: build it once, every coach can grab it

Same day as the coach decision, a second step decided by the owner: the
coach's grants grow up from counts to **composed objects**, and composed
objects go into a **shared library** every coach searches before
building anew. "If someone builds a stick with branches that reach the
ground — cool, save it with the other stick. That way we aren't
rebuilding work over and over."

## 1. A fixture is a built thing in the world

A **fixture** is a named, composed world object: a set of members on the
grid (each one grid step, like everything the solver resolves), each of
a catalog material, plus **roots** — the points where it holds the
ground. A tree is a wood trunk and branches rooted in the bank or the
bed; a dam is a wall of struts rooted across the bed with a walkable
top; an arch, a piling, a leaning branch are all the same shape of data.

Fixtures keep every rule grants already live under:

- **Catalog materials only, no physics in the data.** A fixture names
  `wood`, `silk`, `ant`; it never carries a constant. Its members are
  ordinary members with ordinary limits — a granted tree can snap.
- **Grid-adjacent members only**, so every joint is a point the solver
  resolves and loads land where physics can carry them (the same
  no-single-ant-spans-the-gap rule the blueprint enforces).
- **Nothing floats.** Every member must trace to a root or an existing
  anchor; a root must sit on the bed row (`jMin` — the shallows are
  real ground; the antlion will live there someday) or on an existing
  anchor column. A fixture that would hang in the air is refused.
- **A fixture grant is a level variant** like every other grant: new
  frozen level, new id, roots join the anchors, journal comparability
  keyed on the variant.

And one new power that makes the world composable: fixture joints are
**holdable**. The kid's ants can grab a granted branch; the route can
walk a granted dam. The engine treats fixture members as part of the
world — `buildModel` simulates them, `findRoute` walks them, the shed
must never shed them (they are the world, not the kid's design).

What a fixture is *not*, yet: anything needing physics the solver
doesn't have. **Pontoons wait for buoyancy** — that's unit 6's primitive
(displaced volume), and it arrives as an honest material behavior with
hand-calc tests, not as a fixture that pretends to float. A dam is
walkable today; the river backing up behind it is costume until water
is modeled. "The ground is lava" needs no engine at all — the hazard
line is already generic; lava is a skin.

## 2. The library: built once, searched by every coach

`coach/library.js`, files under `fixtures/` in the repo — plain JSON,
one fixture per file, position-independent (coordinates normalized to
the fixture's own frame; a grant places it with an offset). Committing
the directory is a human act, like everything else in git; the server
just writes files.

The economy, which is the point:

- On every ask, the server searches the library with the kid's words
  and hands the coach the top matches. The coach's standing instruction
  is **grab before you build**: a matching fixture is granted by id and
  offset — no composition tokens spent, no work redone.
- A fixture the coach composes fresh is validated, granted, **and
  saved to the library** in the same turn, normalized, tagged, with the
  asking kid credited as its provenance. The next kid's monkey-puzzle
  tree starts from this kid's tree.
- **Stored files are never trusted.** Entries are shape-checked on
  read (adjacency, catalog, no duplicates, roots among endpoints) and
  fully re-validated against the live level at grant time, exactly like
  a saved costume. A corrupt or edited file is skipped, never fatal.
- **Replay stays self-contained.** A from-library grant is resolved to
  concrete members *before* it enters the grant list, so
  `replayGrants` never reads the library and a variant's identity never
  changes because a library file did.

## 3. Bounds (REVISIT, like all of them)

At most 6 fixtures per level, 40 members per fixture, 8 tags per entry.
The structured-output schema grows two grant forms — a fresh fixture
(name, tags, members, roots) and a library pick (id, offset) — and
`engine/grants.js` stays the only gate either passes through.

## 4. Added to the build session's §7 list

On top of 2026-10-25-the-coach-arrives §7:

6. **Fixture rendering**: world members drawn in their materials,
   visually distinct from the kid's links (they are scenery that can
   snap, not jar ants); granted fixtures appear between rounds.
7. **Applying a fixture grant to a design in progress**: kid links that
   collide with incoming fixture members go back to the jar, said out
   loud.
8. **The shed and the tap must respect the world**: `buildModel`'s
   `worldKeys` are excluded from the shed's removable set and can't be
   tapped home.
9. A small library browse for the educator (search box over
   `GET /coach/fixtures?q=`).
