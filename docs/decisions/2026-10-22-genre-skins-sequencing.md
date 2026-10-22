# Intuition Engine — decisions from design session, 2026-10-20/22

For the build session. These decisions refine the plan of record; where
they conflict with existing design briefs, these win. Read the "Why"
sections so the implementation serves the intent, not just the letter.

## 1. Genre framing: Zachtronics lineage, Factorio architecture

The game's loop is **episodic** — look, predict, test, see why, iterate
— which makes its genre lineage SpaceChem / Opus Magnum, not Factorio:
discrete puzzles on an honest sim, scored on multiple axes
(holds / material used / calibration ≈ cycles / cost / area), with the
Museum of Solutions playing the role of Zachtronics' your-solution-vs-
the-world histograms. Mine Zachtronics post-mortems for design
precedent at least as hard as Factorio's FFF blog.

What we keep from Factorio is the **architecture lesson**, already
stated in the briefs: one compositional simulation with honest rules,
goal-only win conditions, constraints make the game. The emergence we
expect is **combinatorial** (ants + planks = truss; silk + sticks =
damped structure), not Factorio's systemic feedback-loop emergence —
combinatorial arrives earlier and cheaper, and the bestiary table is
its roadmap.

**Honest status:** emergence needs three things — player authorship,
multiple interacting primitives, and slack in the world — and the
current playable has none of the three (fixed bridge topology, one
material, binary call). The engine is proven honest, which is the
precondition, not the thing. The first genuinely emergent moment is
scheduled for the day there are **two materials and a placement tool**.

## 2. No aesthetic art budget; buy legibility instead

Factorio's real lesson is not "invest in graphics" — it shipped
utilitarian art and invested obsessively in **readability**. Ours is
sharper: in this game the visualization *is* the lesson (invariant 3
made visible — stress color, slow-motion break, load path). And because
the skin layer is generated per kid and disposable by design, every
dollar of fixed hand-made art fights the architecture.

So: the graphics budget goes to the invariant visual layer — the parts
that survive every skin.

## 3. The strain performance: the engine acts, the model wears it

The emotional payload of "a colony straining and then giving up" lives
in the mapping from sim state to behavior, not in any mesh. Decision:

- Build a **procedural strain language** driven by per-member
  utilization (already computed by the engine): grip at low load,
  tremble at ~75%, legs/links slipping one by one near limit, recoil
  and tumble at break, slack droop at zero force.
- A chain member renders as N instances of a mesh positioned and
  rotated along the member; stretch opens gaps between instances;
  jitter, lean, slip, and recoil are applied to the **chain**, never
  baked into the mesh.

**Why:** imported models will never come with strain animation. Written
once, procedurally, every model anyone ever imports inherits the drama
for free — stuffed animals pull apart at the stitches, knotted sheets
go taut and quiver, mice lose grip one by one, all from the same four
behaviors. If the library instead relies on models bringing their own
animation, it is dead on arrival.

## 4. Skins are manifests; they never touch the physics

The bring-your-own-model direction is approved, with a hard contract:

- A skin is a **manifest**: bindings from physics primitives to meshes
  (tension-link → this model, cargo → that model, banks → that one),
  plus scale and attribution. Nothing else.
- The honest parameters (grip limit, stiffness, the archetype's goal)
  are fixed by the level/archetype. **No imported content may carry or
  alter physics values.** A chain of school buses and a chain of ants
  solve to the same numbers.
- When an educator asks "can I make my ants stronger?" the answer is
  "that's a different level, not a different skin."

**Why:** otherwise two invariants die at once — honest ground truth
(the skin may never invent its physics; the rule binds educators the
same as the AI) and comparability across kids, which is what lets a
teacher judge work and lets the Museum mean anything.

Note the pedagogical freebie: ant chains, stuffed animals stitched end
to end, knotted sheets, Rapunzel's hair, mice on a seagull are all the
**same primitive** (tension-only chain with per-link grip limit). The
educator demo is a toggle that flips one level between two skins with
the same load numbers on screen: "the costume changed, the physics
didn't." Build that toggle before any import portal.

## 5. The sim stays 2D; models may be 3D

Imported glTF models render in a side-view **2.5D** scene (3D meshes,
camera locked, physics on the plane). The honest-physics rule is cheap
in 2D and expensive in 3D (the briefs already flag this); the model
library does not get to drag the solver into 3D, where honest contact
quietly becomes fake physics.

## 6. Import portal constraints

- Format: glTF. Sources: an **allowlist** of CC libraries (e.g.
  Poly Pizza, Sketchfab's CC section), never a free URL field.
- Surface the license; plumb CC-BY attribution onto the level screen.
- Budget for a **normalization step** (auto-scale to the binding's
  size, recenter origin) — library models are wildly inconsistent, and
  "hit import and it works" is mostly this step.
- The educator doing the importing is the curation gate — consistent
  with invariant 7 (an adult stays in the loop).
- **Starter skins ship generic and original** (ants, stuffed animals,
  knotted sheets). Trademarked characters (Gandalf, Rapunzel) may
  appear in pitches and may be imported by an educator on their own
  authority, but are never bundled in the product.

## 7. Onboarding is not the coach's job

The AI coach does not excuse weak onboarding:

- **Invariant 5 forbids delegating it.** The coach only asks questions
  and must be mutable ("the game must work without it"). A coach that
  onboards is a coach that answers; if onboarding lives in the coach,
  muting the coach breaks the game.
- **A coach fixes confusion, not boredom.** The first five minutes are
  a want-to problem, not a how-to problem. The five-minute hook is
  already designed and already in the demo: **"✅ Called it!"** — being
  right about the future, within sixty seconds, with a spectacular
  resolution (slow-motion break, crocodiles).
- **The educator's on-ramp is a separate product surface** (goal
  authoring, printable build sheets, the adult review flow, the skin
  toggle of §4) and matters more than the kid's: the educator is the
  gatekeeper and adopts in five minutes or never. The coach cannot help
  there at all.

Where the coach *does* relax the classic game-design burden:
**mid-game difficulty tailoring** (the adaptation ladder, per concept),
not minute zero.

## 8. Build order

The sequence that compounds, in order:

1. **The kid places ants** — authorship. Still the gate on both
   emergence and the hook; the demo currently tests a bridge, the game
   begins when the kid builds one.
2. **Strain language + skin manifest**, with two or three built-in
   skins and the same-archetype toggle. This forces the skin/physics
   separation to become real code instead of a README claim, and is
   the educator demo.
3. **The import portal** — at that point a manifest editor pointed at
   a CC library (a small job). Built first instead, it is a facade on
   a game that doesn't let anyone build anything.

## Open items (not decided)

- Exact utilization thresholds for the strain states (grip / tremble /
  slip), and whether they are per-material or global. Pick something,
  tune by watching a kid.
- The manifest schema details (how cargo, banks, and decorations bind;
  how N-instances-per-member is specified vs derived from mesh size).
- Which CC libraries make the initial allowlist, and the attribution
  display format.
