# 2026-10-25 — The items are free, the physics is not

Third decision of the day, from the owner, refining the fixture library
(same day, earlier file). Where this conflicts with
`2026-10-25-the-fixture-library.md`, **this file wins** (the standing
newest-first rule).

## 1. A fixture is an object, not a structure — support is physics' job

The earlier file required every fixture to trace to ground ("nothing
floats"). **Retired.** A branch with a forked branch off it doesn't have
to reach the ground unless the kid asks it to. The kid may:

- rest it across the gap (its points landing on bank grid points are
  pinned there, the same abstraction every kid link has always used);
- leave it loose and tie it up with ants — one branch as a span, one as
  a piling the ants hold in place, is a solution, not a rule violation;
- ask for it **planted** — and only then does it get roots. Roots stay
  what they were: endpoints driven into real ground (the bed row or a
  bank column). Pilings are an ask, never a default.

Validation keeps shape honesty only: one connected object (a grant of
scattered pieces is `in-pieces` — ask twice), grid-step members, catalog
materials, bounds, caps. Groundedness is no longer checked, because the
solver checks it the only honest way: **an unheld object falls when the
scaffold comes away.**

Which exposed a cheat this file closes: catalog wood and silk carried no
creature mass, and the solver treats a zero-mass node as immovable — an
untied massless branch would have hung in the sky like a hook. So the
catalog gets honest masses (fantasy-scaled like everything in
`materials.js`, REVISIT with Stage 0): **wood 8 g per link, silk 0.2 g
per link** — a stick outweighs five ants and one ant can still hold it.
Free bodies fall; spans carry their own weight; the sky-hook is dead.
Wood's stiffness also comes down (5000 → 1000): a placed stick's light
nodes must integrate stably at the crossing's own dt, and the old value
blew past the stepper's limit the moment wood stopped being massless.
Fantasy constants were always scaled for a legible scene; now they are
scaled for a legible solver too. Hand-calc tests that lump the apex
mass pick up the new terms; the two-bar-truss relationship test never
pinned the old number.

## 2. Dams hold frogs; water waits for water physics

A dam built today is judged as what the engine can honestly judge: a
structure the cargo walks. **The demo must never render water held back,
backed up, or redirected until hydrostatic load is a real primitive** —
pressure on sealed faces, leaks through gaps, with hand calculations,
alongside buoyancy (the brief's unit 6) in a future water pack and its
own decision file. A dam that "works" against unmodeled water would be
exactly the canned outcome invariant 3 forbids. Ground-is-lava needs
none of this: the hazard line is already generic; lava is a skin.

## 3. The kid sees the bill — budgeting is curriculum

Every coach ask returns its real cost, and the demo shows it. The
service prices the turn from the API's own usage (COACH_MODEL's
published rates, kept next to the model id, REVISIT together) and
returns cents for this ask, cents today, and what's left. Kids learning
to spend questions like they spend ants is part of the lesson, not
telemetry to hide.

## 4. The budget starts big and shrinks as the library grows

Replacing the flat daily call cap:

- **Per problem** (kid + base level + day): a question budget of
  `budgetFor(librarySize)` — starts at 30 asks, loses one per 2 library
  entries, floor 8 (all REVISIT). A young library means lots of
  composing, so the budget is generous; a rich library means grabbing
  is cheap, so the budget tightens and teaches thrift.
- **Per kid per day, in cents**: the hard credit guard (25¢, REVISIT).
  Cents, not tokens — the guard and the lesson speak the same unit.
- A library pick still costs an ask (the turn happened) but few tokens
  — the library is how the budget stays enough.

## 5. World knowledge is free

"What is already built?" is the library list — `GET /coach/fixtures`,
no Claude, no cost. "What exists in the forest?" is the grant
vocabulary and the catalog — `GET /coach/forest`, same. The coach may
**name** what the forest offers and what the library holds when the kid
asks (that is world-granting territory, like the quartermaster verb);
it still never says what will hold, what to build, or where anything
should go. The demo should answer both questions without spending an
ask at all (UI handoff).

## 6. Handoff additions (on top of the two earlier lists)

10. The cost ticker: cents this ask, cents today, questions left on
    this problem — kid-visible by design.
11. Free "forest" and "library" browse in the kid UI, answered locally
    from the two GET routes, costing nothing.
