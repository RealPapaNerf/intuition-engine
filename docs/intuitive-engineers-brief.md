# Intuitive Engineers: a game framework for teaching kids engineering

A plan for an educational game (really: a family of games on one engine
and one syllabus) that grows engineering intuition in kids, starting at
kindergarten. The kind of intuition Kelly Johnson had: look at a thing,
feel where the load goes, estimate the answer before anyone computes it,
and know when a computed answer smells wrong.

This expands a one-line seed from in-finite-analysis's
`topopt-brief.md` ("a kids' version where a solid block erodes into a
bone shape and they see where the load flows") into the full framework.
It now lives here, in the framework's own repo, next to the engine that
implements it. See the README for the framework thesis: the engine and
the pedagogy are the durable product; scenarios and theming are cheap
and generated per kid.

## Why

- AI will answer any formula question a kid can type. If kids are not
  trained to predict and sanity-check, they will pencil-whip whatever
  the machine says. The scarce skill in an AI world is not computing
  the answer; it is knowing what the answer should roughly be, and
  noticing when it isn't.
- Current education frames understanding as a struggle. The struggle is
  real but the framing is wrong: the productive struggle of iterating
  on a design you care about doesn't feel like struggle. An applied
  physics class — strongest-lightest bridge, fastest boat, boat that
  holds the most — is the proof: no one studies for that class, and
  everyone thinks about it all the time. Kids who "hate math" discover
  they love it the moment math is the tool that wins the contest.
- Education should be a game, enjoyable, and tailored to the person.
  Games already solve tailoring: a good game holds every player at the
  edge of their ability.

## Who it's for

Kindergarten through about 8th grade, one spiral syllabus. The same
games replay every year at a deeper level, so a kid meets tension and
compression as "stretch and squish" at 5, as a measured number at 9,
and as σ = F/A at 13 — and at 13 it isn't a new idea, it's the name of
something they've felt for eight years.

Built first for my own kids and me at the kitchen table; designed so a
classroom could run it as a season of contests.

## The one non-negotiable principle

**Predict before you test, every time.** The game never lets you run
the experiment until you've committed to a guess. The score rewards
calibrated prediction more than lucky success. This is the entire
anti-pencil-whip mechanic, and it is also exactly how an intuitive
engineer's head works: guess, test, compare, adjust the gut.

This is the same predict-solve-explain pattern as the FEA trainer's
teaching layer — this project is that pattern turned into a game for
people who can't read yet.

## Design principles

1. **The formula is the scoreboard, not the lesson.** Every game's
   score is secretly the real physical quantity (stress, moment,
   displaced volume, drag). Kids optimize the real quantity for years
   before anyone shows them its symbol. When the formula is finally
   revealed, the reaction should be "oh, that's the rule I already
   know," never "here is new material."
2. **Never name the concept before the kid has felt it.** Play first,
   vocabulary later, formula last.
3. **Constraints make the game.** Limited wood, limited ants, a budget,
   a deadline. Unlimited resources make a sandbox; constraints make an
   engineer. Every level is an optimization problem whether the kid
   knows the word or not.
4. **Breaking things is content.** Failure is the fun part (crocodiles
   eat the frog) and the informative part (the branch always breaks at
   the trunk — why there?). Show the failure in slow motion, show where
   it started, let them replay it.
5. **Honest physics behind the cartoon.** Same rule as the rest of
   FEA-lite: don't write fake physics. The frog on the branch is a real
   beam-bending model; the ant bridge is a real truss/catenary solve;
   the boat floats on real displaced volume. A kid's intuition is only
   worth building if it's calibrated against reality. Cartoon front
   end, real solver behind it.
6. **Spiral, not sequence.** Each game has three depths (see the ladder
   below). Next year's version of the same game adds measurement; the
   year after adds the model. Nothing is ever "finished and left
   behind."
7. **Hands touch real things.** Every unit has a physical companion
   build from craft sticks, paper, straws, tape, pennies. Intuition
   transfers through fingers. The screen's job is fast iteration and
   honest measurement; the table's job is making it real. The contests
   (strongest-lightest bridge) are physical, like the class that
   inspired this.
8. **Tailored by design.** Difficulty adapts to the kid, not the grade
   label. A kindergartner who's ready for numbers gets numbers.
9. **Score the goal, not the method.** Levels state what must be true
   (the rabbit gets across), never how. Any honest path to the goal
   earns full base points; engineering rigor and invention earn more on
   top (see "the superintendent rule" below). The game must never
   punish a solution for being unorthodox.

## The core loop

Every game, every level, every age:

1. **Look** — here's the situation (frog approaching the branch).
2. **Predict** — commit: holds or breaks? how many ants? how fast?
   Older kids predict a number and an error band ("between 6 and 9
   pennies").
3. **Test** — run it. Physics decides, not the designer.
4. **See why** — the game shows where the load went: color the branch
   red where it's stretched hardest, replay the break in slow motion,
   draw the load path through the ant bridge.
5. **Iterate under constraint** — you have this much wood/this many
   ants/this much budget. Make it survive the bigger frog.

Scoring: points for surviving, more points for predicting correctly,
most points for predicting correctly *with less material*. A running
**calibration score** (how often reality lands inside your predicted
band) is the prestige stat — it is the measurable version of
"intuition."

## The age ladder (one game, three depths)

| Band | Mode | What the kid does | What's secretly happening |
|---|---|---|---|
| K–2 | **Feel it** | Qualitative calls: holds/breaks, more/less, bigger/smaller. Counting is the only math (count the ants). | Comparative reasoning; load paths seen as color; cause → effect |
| 3–5 | **Measure it** | The scoreboard shows numbers with units. Kids read bars, keep a lab notebook of attempts, predict quantities, compute ratios (strength per stick). | Measurement, units, ratio and proportion, graphs, strength-to-weight |
| 6–8 | **Model it** | The game asks the kid to find the rule ("double the branch length — what happens to the biggest frog it holds?"). Kid discovers the pattern; game then reveals the formula as confirmation. Kid starts predicting with arithmetic and beating the kids who guess. | σ = F/A, M = F·L, buoyancy, drag ∝ v², levers, energy — each arriving as a named, already-familiar pattern |

The reveal moment matters: the formula is presented as *"here is the
rule you've been using"*, with the kid's own play history re-scored
against it as evidence.

## The syllabus: one year, nine units

Concepts ordered so each builds on the last. Each unit = one game +
one physical build + one hidden formula. A year is two passes for
younger kids (feel), one deeper pass for older kids.

| # | Unit | Game | Physical build | Hidden math |
|---|---|---|---|---|
| 1 | Push and pull (tension & compression) | **Will It Break: Frog on a Branch** — frog crosses a branch over a crocodile river; bigger and bigger frogs; limited wood to grow/thicken the branch | Stretch a rubber band, squish a marshmallow; build a craft-stick cantilever off the table edge, hang washers | Tension vs compression; a bent beam is stretched on top and squished underneath |
| 2 | Where things break (leverage) | Frog game, long levels: same wood, longer branch. Why does it always snap at the trunk? Where should the thick part go? | Break spaghetti at different lengths; seesaw with unequal arms | Bending moment M = F·L; material belongs where the moment is |
| 3 | Spanning the gap (load paths) | **Will It Break: Army Ants** — bridge a gap by placing ants; limited ants; then march cargo across: a beetle? a frog? a rabbit? Triangle formations hold; squares fold | Straw-and-pin bridge: squares vs triangles | Trusses, triangulation, load paths; forces split and recombine |
| 4 | Strong shapes | Same gap, new pieces: flat strip vs tube vs T-shape, same amount of material | Roll paper into a tube column; stand books on it. Fold paper into an I-beam | Cross-section geometry; stiffness comes from shape, not just material; σ = F/A |
| 5 | Strong **and** light | Season contest: strongest-lightest bridge. Score = load held ÷ weight of bridge | The real bridge contest, craft sticks and glue, crushed on a scale | Strength-to-weight ratio; the ratio as a score is the first merit function |
| 6 | Floating and carrying | Boat that holds the most pennies; hull shapes; where you stack the cargo matters | Foil boats in the sink, pennies until swamped | Buoyancy = weight of displaced water; stability (wide beats tall) |
| 7 | Moving through water and air | Fastest boat down a channel; then paper gliders: longest flight. Skinny beats blunt; smooth beats rough | Rubber-band paddle boat; paper airplane ladder | Drag grows with v² and frontal area; lift; thrust–drag balance sets top speed |
| 8 | Energy in, motion out | Rubber-band car: fixed winds of the band — how far? Gearing: far-and-slow vs fast-and-short | The actual rubber-band car | Stored energy, work, friction as the thief; trade force for distance |
| 9 | **Everything is an optimization** (capstone) | **The Shop**: build missions with a budget, a deadline, and a spec. Fast → it's small. Big and fast → it's expensive. Big, fast, *and* cheap → it's late, and still not that cheap. Pick two is the house rule; the master move is knowing *which* two the mission needs | Team contest: fixed budget of materials priced in play money; client card states the mission | Multi-objective trade-offs, Pareto thinking, merit functions — the engineer's actual job |

Unit 9 is the one that makes the rest cohere: every earlier game
retroactively turns out to have been The Shop with one constraint.

After the capstone, the **bone game** from in-finite-analysis's
`topopt-brief.md` — a solid block erodes under load into a bone shape
while the kid watches where the load flows — is the graduation level,
running on the real topology-optimization engine. Unit 16 is its
in-world rehearsal: shedding lazy ants from a bridge *is* topology
optimization, done member by member where the kid can see each decision.
A kid who has played units 1–9 and watched the colony shed looks at the
eroded bone shape and recognizes every feature: there's the tension
chord, there's the compression strut, that's why it's a triangle.

## The bestiary: materials are animals

The world's materials are creatures, and each creature is an honest
material primitive with real parameters — not a skin, a physics
behavior. (The creatures themselves *are* a skin — the reference skin,
built from my own interests. A kid who loves excavators or dragons gets
the same primitives wearing their world; see the README. What is
authored and fixed is the physics under the costume.)

| Creature | What it really is | Honest properties | What nature uses it for | The off-label move (the hook) |
|---|---|---|---|---|
| Ants | Tension-only links (cable, chain) | Strong in tension, zero in compression, each ant has a crush limit | Living bridges, rafts | Carry heavy cargo — single ants get squished, so… |
| Sticks & planks | Struts and beams | Good in compression and bending, heavy, stiff | — (the kid's stock material) | …team with ants: wood takes the squish, ants take the stretch. That's a truss, and it's the logic of reinforced concrete |
| Spider silk | Elastomer / damper | Stretchy, absurd strength-to-weight, absorbs energy | Webs, cocoons, draglines | Catch a falling boulder; a bungee bridge that *gives* under a dynamic load that would snap a stiff one |
| Swift mud | Adhesive / mortar | Bonds anything, needs cure time, brittle when dry | Nests glued to cliffs | Glue joints, cantilevered houses, masonry mortar |
| Termites + a compliant tree | Masonry, HVAC, and foundations | Mound: thick walls, chimney draft, armor. Tree: roots grown exactly where load needs them | Temperature-regulated fortress | The team-up: the tree grows roots under the mound and it can go taller, hollower, cooler |
| The antlion | The adversary | Granular physics: angle of repose, friction, impact | A sand trap | Turns test engineer: it bombards *your* structure, and escape from its pit teaches why sand walls have a maximum steepness |

Every creature follows the same three-beat arc, and the arc is the
curriculum:

1. **Imitate** — do what the animal does (spin the web, span the gap
   with ants, raise the mound). The tutorial; it teaches the material's
   nature by use.
2. **Misuse** — take the material somewhere nature never did. This is
   the beat that grabs kids, and it is also literally what biomimicry
   engineers do for a living.
3. **Combine** — composite structures: ants + planks (truss), silk +
   sticks (damped structure), termites + tree (superstructure +
   foundation), mud + anything (joints). Every combination is a real
   engineering concept wearing a costume.

The linker tool the kid uses to connect ants, sticks and silk — nodes,
members, constraints — *is* a baby CAD. It should share its bones with
CAD-lite so the graduation from "place ants" to "sketch and constrain"
is a ramp, not a cliff.

The bestiary also extends the syllabus into a second season:

| # | Unit | Game | Hidden math |
|---|---|---|---|
| 10 | Dynamic loads | The silk net catches the falling boulder; soldiers march in step across the ant bridge and it starts to swing | Impact energy, damping, resonance; stiff is not always strong |
| 11 | Sand and friction | Escape the antlion pit; why its walls can't be steeper | Angle of repose, friction, granular flow |
| 12 | Hardening | The antlion bombards your bridge; armor it with what you have | Impact, spreading a point load, sacrificial layers |
| 13 | Glue and joints | Swift-mud construction; everything breaks at the joint | Adhesion, joint design, cure time as a schedule constraint |
| 14 | Heat and air | Keep the termite nursery cool through a desert day without moving parts | Stack effect, passive ventilation, insulation |
| 15 | Foundations | The compliant tree grows roots under the growing mound | Anchorage, settlement, load into the ground |
| 16 | The lazy colony (topology optimization) | The bridge stands — then, one by one, the laziest ants let go. It still stands. Every freed ant goes back in your jar for the next build | Load paths are the structure; the rest is dead weight. Structural efficiency; this is real evolutionary topology optimization (remove the least-stressed member, verify, repeat) |

## Open-ended by architecture

The requirement that a kid can invent a solution nobody has seen is an
*architecture* requirement, not a content requirement. Scripted levels
can only contain their author's ideas. The way out:

- **One compositional sim.** Every object in the world — ant, plank,
  silk strand, boulder, frog — is simulated by the same rules, with no
  scripted outcomes anywhere. Surprise solutions exist because physics
  doesn't know what the level is "about."
- **Goal-based win conditions.** The level checks what is true (cargo
  reached the far bank, nothing died, the nursery stayed under 35°C),
  never the method.
- **The world is richer than the lesson.** Levels include things with
  no assigned purpose — a pelican, a rock, a current in the river, a
  character who wants something. If the lesson is bridges and the kid
  pays the pelican to fly the frog across, the world should let that
  happen. This is deliberate slack, budgeted per level, not sloppiness.

## Scoring: the superintendent rule

Named for the physics-exam legend: asked to find a building's height
with a stopwatch and a ball, the intended answer is to drop the ball
and time it — but trading the superintendent the stopwatch for the
blueprints is *also* a correct answer, and in real life often the
better one. The scoring must protect that kid while still pulling
everyone toward the engineering:

1. **Solved it** — full base points. Any honest path: the pelican
   trade counts. Unorthodox is never penalized.
2. **Solved it like an engineer** — bonus on top: predicted the
   numbers before the test, can point at the load path, can answer
   "why did it hold?" This is the existing predict gate doing the work.
3. **Solved it a way nobody has** — the jackpot: the solution isn't in
   the level's archive of known solution classes. It gets a "first"
   credit under the kid's name and a permanent entry in the level's
   **Museum of Solutions**, which other kids can browse only after
   solving the level themselves.

**The program flags; a person judges.** Novelty detection is a tripwire,
not a verdict. When a winning solution looks structurally unlike
everything in the archive, the program flags it for the adult in the
loop — the parent at home, the teacher in a classroom — with a
side-by-side against the nearest known solution ("closest existing
solve, 64% similar — is this new?"). The adult confirms or declines;
confirmed solutions enter the Museum and the jackpot points land
retroactively. This is deliberate: an adult is already reviewing the
kid's work in this framework (the physical builds, the dinner-table
games), judging novelty is a judgment call a teacher is better at than
a classifier, and points arriving a day later, from a person, are worth
more to a kid than points from an algorithm.

Three guards that keep this honest:

- **Untaken bonuses stay visible.** The pelican kid sees the engineer
  bonus sitting there unclaimed. Pull, never push: the game invites
  the second solve, it doesn't demand it.
- **Exploits are findings, not cheating.** If a solution works only
  because the sim is wrong, the kid gets a "you broke the sim" badge
  and the patch note carries their name. Finding the limits of a model
  is real engineering; punishing it would teach kids to hide anomalies.
- **Novelty is celebrated, never required.** The rubric rewards the
  first kid to invent something without penalizing the thousandth kid
  to reinvent it honestly — reinventing a truss from nothing is the
  whole point of the game.

## The AI's role (and its leash)

The AI is the coach, and the coach only asks questions. It never gives
the answer, never predicts for the kid, never builds for the kid.

- Before the test: "Why do you think it will hold?"
- After a break: "It snapped at the trunk again. What's different about
  the trunk?"
- After a win: "Could it have held with one stick less?"
- Calibration nudges: "You've guessed 'breaks' five times in a row and
  it held. What would make you guess 'holds'?"

The AI also does the tailoring: it watches the prediction history and
moves the kid up or down the feel/measure/model ladder per concept, not
per grade. That is the "tailored to the person" requirement, and it's
the thing a classroom of thirty can't do by hand.

Hard rules: the AI can be muted entirely (the game must work without
it); it never blocks play; conversations are not stored beyond what the
difficulty ladder needs.

## The Consultant: training kids to use AI without trusting it

The coach never answers. A second character does: **the Consultant**, a
cartoon advisor who gives direct recommendations — and is deliberately,
curatedly fallible. This is the mechanic that teaches critical AI use,
and it only works because the games have ground truth: the kid can
always test the advice against real physics.

How it plays:

- From unit 3 onward, the Consultant offers advice before the predict
  gate: "Ten ants is enough for the rabbit." The kid must commit to one
  of three calls before testing: **trust it**, **doubt it**, or
  **verify it** (spend a cheap test first).
- The Consultant is right about 4 times in 5. That ratio is the whole
  design. Always-wrong teaches the cheap heuristic "never trust the
  robot"; always-right teaches pencil-whipping. Around 80% right makes
  *checking* the skill — exactly the posture kids will need with real
  AI.
- A **trust calibration** stat sits next to the prediction calibration
  stat: points for trusting when it was right *and* for doubting when
  it was wrong; the expensive failure is swallowing a wrong answer
  whole.

Why scripted wrongness beats a live low-power model: with canned
responses we control the error — one flaw per puzzle, of a known type,
findable at the kid's level, deterministic, testable, offline, and
never inappropriate. A real weak model is wrong in unplannable ways and
right when we need it wrong. The Consultant is a curriculum pretending
to be an AI.

The errors follow a taxonomy the kid gradually learns to name:

| Error type | Example |
|---|---|
| Right method, wrong number | Counts 8 ants where 10 are needed |
| Right answer, wrong reason | "It holds because ants are strong" (it holds because of the triangle) |
| Confident nonsense | Fluent, authoritative, and unrelated to this bridge |
| Answered a different question | Asked about the rabbit, answered for the frog |
| Unit slip | Grams where it meant kilograms |
| Untested assumption | "Wood is wood" — ignores the wet branch |

**Error design rules** (decided 2026-10-19, see
`decisions/2026-10-19-brainstorm.md`): every curated error must be
catchable by **reasoning against reality**, never by how the text
sounds — each one fails at least one of: units mismatch, wrong sign,
wrong direction of scaling, a limiting case that doesn't vanish (zero
load should mean zero stress), order of magnitude (~10×), or
contradiction with a prior the kid calibrated in an earlier level. At
K–2 depth the same rule is a claim against a feel they've built ("the
thin stick holds more than the thick one"). The Consultant's prose is
always fluent and confident — no tonal tells; if a tester can spot the
error without running a check, the error gets redesigned. And every
error is catchable, at that depth, by a kid who thinks hard enough —
none resolvable only by running the build.

**Two separate commitments.** The kid's own prediction and their call
on the Consultant's answer are logged separately: "I'll just use the
Consultant's number" is a visible, scorable trust choice, not a
shortcut around the predict gate. Trust calibration is computed from
this log.

**Scoring the catch** (goal, never method — how hard they thought is
not scored):

| Outcome | Score |
|---|---|
| Caught before the build | top tier |
| Build fails → postmortem → caught | next tier, still positive |
| "I can't judge this one — run it" | a valid catch of the kid's own limit |
| Used the number uncritically, build fails, never caught | zero, and feeds the disengagement log |

The "show your engineering" bonus still applies on top.

Ladder: K–2 gets a "silly robot" whose mistakes are obvious and
delightful to catch. 3–5 gets subtle quantitative errors that must be
verified by test or hand-check. 6–8 gets reasoning chains with one
flawed step to find and correct — and the kid must *say what kind* of
wrong it was. Graduation: the Consultant is replaced by a real AI, and
nothing changes about the kid's behavior, because the habit is set:
**an answer is a hypothesis until tested.**

## What "intuition" means here, measurably

- **Calibration**: predictions land inside the kid's own stated band,
  and the bands narrow over time.
- **Transfer**: a kid who trained on the frog branch predicts correctly
  on the ant bridge the first time they see it.
- **Planted-error catch rate**: show a wrong answer (a bridge the game
  claims holds 10× too much) — is it caught, and caught earlier, by
  running the right check? This is the direct anti-pencil-whip
  measurement.
- **Trust calibration**: the kid trusts the Consultant when it's right
  and doubts it when it's wrong, at better than chance and improving.
- **Invention**: solutions that land in the Museum — honest, goal-met,
  flagged by the program as unfamiliar, and confirmed new by the adult
  in the loop.
- **Table proof**: the physical contest results track the kid's
  in-game scores.

## Build plan

Phase 0 — prove the loop, no code:
- Run Frog on a Branch as a paper/kitchen-table game with real spaghetti
  and washers. If predict-test-see-why doesn't grip a 5-year-old at the
  table, no engine will save it.

Phase 1 — one honest game:
- Frog on a Branch as a small web game (same stack habits as CAD-lite:
  runs in a browser, offline-capable, no accounts).
- Built on the one engine the whole bestiary will share: a 2D
  node-and-member sim (mass–spring / position-based dynamics) with
  honest material parameters — stiffness, tension and compression
  limits, damping, break thresholds. One compositional engine gives
  statics *and* dynamic loads, and the frog branch is just its first
  level; open-endedness cannot be retrofitted onto scripted levels
  later. The FEA discipline carries: validate it against hand
  calculations; never canned outcomes. (Started: `engine/` in this
  repo, validated by `test/`, with unit 16's ant-shedding working in
  `demo/`.)
- The predict gate and the slow-motion break with stress coloring.
- Feel-mode only (K–2).

Phase 2 — the second game and the scoreboard:
- Army Ants (truss placement), sharing the engine.
- Measure mode: units on screen, the lab notebook, the calibration
  score.

Phase 3 — the ladder and the coach:
- Model mode with the formula-reveal moments.
- AI coach behind the question-only leash; per-concept adaptive
  difficulty.

Phase 4 — the season:
- The Shop capstone, contest mode for a family or classroom, printable
  physical-build sheets per unit.
- The bone game on the real topopt engine as the finale.

Each phase ships something a kid can play that week. No phase depends
on a later one.

## Open questions

- Platform floor: cheapest school Chromebook? A specific tablet? (The
  honest-physics rule is cheap in 2D; it only bites if we go 3D.)
- How much reading can level 1 assume? K kids may need a fully
  narrated/iconic UI.
- Season structure: calendar-paced like a sports season, or fully
  self-paced?
- Where the syllabus should map onto NGSS engineering standards
  (K-2-ETS1, 3-5-ETS1, MS-ETS1) — useful for classroom adoption, but
  the standards must never drive the design.
- ~~Whether this lives long-term as its own repo~~ — resolved: it does,
  and this is it. in-finite-analysis keeps the FEA trainer and the bone
  game's solver.
- The structural fingerprint for the novelty tripwire: what features of
  a solution to compare (member graph shape, tension/compression
  pattern, mechanism class), and how far from the archive is "flag it."
  The adult makes the call either way, so the tripwire only needs to be
  usefully sensitive, not correct.

## Done means

- A kindergartner asks to play again without being asked to learn.
- A kid who has played a season looks at a loaded thing in the real
  world — a shelf, a bridge, a tree branch — and says where it would
  break, and is usually right.
- An 8th grader meets σ = F/A in school and says "I know that one."
