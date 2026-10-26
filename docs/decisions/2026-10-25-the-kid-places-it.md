# 2026-10-25 — The kid places it: picking up, moving and sizing what the coach stocks

Sixth decision of the day, from the owner, after the first kitchen-table
session with the coach step built. Where this conflicts with the earlier
files, **this one wins** (the standing newest-first rule).

## 1. What Stage 0 found

A granted branch arrives where the coach put it, at the size the coach
chose, and the kid's hands do nothing to it. In the owner's words: *"I
need to be able to size the branch. I also select the branch and it
doesn't do anything."*

The earlier files already point this way and never finish the thought.
`the-coach-arrives` §2: **"The coach never places anything"** — yet a
fixture grant arrives with coordinates in it. `free-items-honest-physics`
§1 says the kid may rest an object across the gap, leave it loose and tie
it up with ants, or ask for it planted — three verbs the kid has no way
to perform. This file finishes it: **the coach stocks the world; the kid's
hands place what it stocks.**

## 2. The gesture, and it is the one the kid already knows

In the build phase only — the world does not move under a cargo
mid-crossing (fixture library §4.6):

- **Take it out**: a granted object waits in the kid's inventory
  (`2026-10-25-the-setting-and-the-shelf.md` §4) until they put it in
  the world.
- **Pick it up**: tap a world object. It lifts: its joints show as
  handles, and nothing else changes.
- **Move it**: drag the middle of any of its members. The whole object
  travels, whole, on the grid.
- **Size it**: drag from one of its ends, exactly as laying a line of
  links already works — the object grows a member at a time in its own
  material, the way the kid's hand goes. Drag an end back onto its
  neighbour and the last member comes off. **A branch is drawn out, not
  configured.**
- **Drop it**: physics takes over. Nothing is held up because it was
  placed — an unheld object falls when the scaffold comes away (free
  items §1, unchanged, and the whole point).

The kid's own links that the new shape would sit on go back to the jar,
out loud — already true of an arriving grant, now true of a moved one.

A world object is not one of the kid's links and never was tappable to
send home, so the new gesture takes nothing away from the old one.

## 3. Items are free; the physics is not (unchanged)

Growing a branch costs no ants, no stock and no cents — items were
always free, and the earlier file's title says so. What remains are
solver-sanity caps, as generous as they already are: `fixtureMembersMax`
(40), `fixturesMax` (12), the level's bounds (all REVISIT). Crowding the
riverbed with a forty-member tree until the sim groans is protected play:
score the goal, never the method.

## 4. Roots are where a thing was planted, not a property it carries

Move a planted fixture and the roots still standing on real ground (the
bed row, or an anchor column) stay roots. The rest are **pulled out**,
and the game says so. An object lifted clear of the ground is simply an
object again — which is honest, and which the solver will demonstrate
the moment the scaffold comes away. Re-planting is an ask, as it always
was: pilings are an ask, never a default (free items §1).

## 5. Placing makes a variant, like every grant

The level stays frozen and replayable. A move or a resize appends a
**`reshape`** entry to the grant list — which fixture, its new members,
its new roots — and that entry passes the same `engine/grants.js` gate a
fresh fixture does: grid-adjacent members, catalog materials only, one
connected object, in bounds, under the caps, no duplicate of another
fixture's member, roots on real ground. `replayGrants` stays
self-contained, the variant id changes, and the journal never mixes a
level whose branch moved with one where it didn't.

A reshape that fails the gate is refused with its reason, in the kid's
words, and nothing is negotiated — the same rule as every grant.

## 6. The companion: the kid takes it off the shelf themselves

Stage 0 ran with no `ANTHROPIC_API_KEY`, which means nothing was ever
granted, which means this whole half of the game was unreachable. A kid
playing without a coach should still get to place a branch.

The answer is not an adult handing things out — **level authoring is
choosing the setting, not handing out items**
(`2026-10-25-the-setting-and-the-shelf.md` §1, which corrects an
earlier draft of this section). The answer is that **the kid searches
the shelf themselves and takes what is already there**: free, local, no
model, no coach, no cents. The library was always free to look at; this
makes it free to take from, because the thing was already built once.

So a keyless kitchen table plays the whole loop — search the shelf,
take a branch, place it, tie it up, test it — and the coach is needed
only for the one thing a shelf cannot do: build something nobody has
built yet.

## 7. What this does not change

The coach still never places the kid's bridge, never predicts, never
answers. The journal takes no new inputs, and the duration-invariance
test keeps passing. Skins still validate against the base. The solver
stays 2D. No canned outcomes anywhere: a placed object holds or falls
because the physics says so.

## 8. The build session's list

1. **Engine**: the `reshape` grant kind in `engine/grants.js` —
   validation, application, replay — with tests pinning that a reshaped
   branch is ordinary members with ordinary limits, that a reshape which
   breaks the object into pieces or leaves the bounds is refused, and
   that roots off the ground are dropped rather than carried.
2. **Demo**: pick up, move, size on the canvas. Handles no smaller than
   a fingertip (`FINGER`), refusals said in the kid's words, and the
   gesture kept clear of the existing tap-to-send-home.
3. **Demo**: colliding links back to the jar on a move (reuse
   `collidingLinks`), and the stock/jar counts stay honest.
4. **Demo**: the kid's own shelf search — the library, free, searchable
   from the kid's page, and takeable into the inventory with no coach
   involved (§6).
5. The kid's page still shows no adult anything, and spoken mode still
   needs no reading: picking up and dragging is the one input a
   pre-reader already has.
