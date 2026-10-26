# 2026-10-26 — Pull it apart, break it, fix it: the systems pack

A third pack opens, from the owner, 2026-10-26. It runs in parallel to
the engineers' pack the way the lens does (2026-10-22): it does **not**
reorder that pack's build order — `the-setting-and-the-shelf` §8 is
still what comes next there. Where this file conflicts with the briefs,
this file wins (the standing newest-first rule).

What is decided by the owner is §1, in their words. Everything after it
is this build session's reading of those words — designed, built and
tested in `systems/` and `demo/` — and the owner may revise any of it in
a newer file.

## 1. The idea, in the owner's words

> *"Pull a system apart, break it, fix it. Learn how the system works and
> has interconnected pieces by pulling parts out or installing bad parts,
> then seeing what those parts do to the whole system, then replacing
> those parts. We could look at a whole car, or an RC car, an airplane, a
> logistics system, a computer or a tiny PCB. We could even look at
> medicine/biology like this. What does the kidney do? What is the
> function of cytoplasm? How does a virus replicate? What happens if we
> change this part of the system? I want to build the interface and
> engine that can handle putting a system in, then letting the kid play
> with it."*

And, while it was being built:

> *"I want the kids to make connections. What happened when x part is
> removed? What happens when two of x part is added? What happens if y
> part is added in x location? Predict what would happen when x is
> blocked. The variety of prediction and connection questions are as
> infinite as the subjects covered. If there is research for this I want
> to use research backed techniques for teaching."*

This is the domain-pack contract (philosophy, "the domain pack
contract") applied to systems themselves: the subject is how parts make
a whole — what a part is for, what depends on what, spares, buffers,
feedback, bottlenecks, cascades, root causes — and the worlds it is
learned in are cars, kidneys, circuits and cells. The philosophy already
names emergency medicine's ground truth as "a simplified but consistent
physiology model (predict what the vitals do before you intervene)";
this engine is that model's engine, and the anatomy and medicine packs
can stand on it.

## 2. Ground truth: three laws and a solver

*No ground truth, no pack.* A system that told the kid what happens when
the kidney comes out would be a canned outcome (invariant 3). So the
pack's physics is a small catalog of laws (`systems/system.js` `LAWS`),
each a formula in `systems/solve.js` with a hand calculation in
`test/systems.test.js`:

- **conduct** — stuff flows from the higher level to the lower, faster
  the bigger the difference: a wire, a pipe, a filter, warmth through a
  wall. (Ohm's law; clearance; Newton's cooling.)
- **oneway** — the same, one way only, past a drop: a diode, an LED, a
  check valve, a spillway.
- **react** — a machine: inputs to outputs in fixed amounts, at its own
  rate times the amount of each helper it works with, never faster than
  its inputs allow or its outputs have room for. A pump is a react with
  one input and one output; a recipe that helps copy itself grows.

Stuff sits in **stores** (a battery's charge, the waste in the blood,
the heat in an engine block; level = amount ÷ capacity), at **fixed**
levels (the air, the ground, the toilet), or passes through
**junctions** (wires meeting). A flow may **need** a part or a level, a
part may **gate** a flow (a thermostat), and a part may have **ratings**
it breaks past (an LED's 30 mA, an engine's 125 °C). That is the whole
physics.

The solver is backward-Euler nodal analysis per substance — exact at
steady state, stable however stiff the circuit, oneways settled by
iteration — with machines rationed so no store goes below empty or over
full, and an event for every flow that stops, every part that breaks,
and the moment the goal fails. **No clock, no dice:** a run is a pure
function of the system and the bench, and a test reads the pack's source
to keep it so (the feed line, 2026-10-19 §6).

**What a system file may do: choose laws, wiring and numbers. What it
may not: write a law.** It is validated and frozen like a brief or a
material, and refused, in plain words, for anything else — including two
things the solver could only fake: a fixed level below zero (a store
can't hold less than nothing, so it would drain one past empty and make
stuff from nowhere: count from a zero below everything in the model),
and a store with a `max` on a level flow (a level flow fills to its
level whatever the max says; if it overflows, the overflow is a flow —
a oneway out at the brim).

**Honest has two halves here, and the engine can only promise one.**
The engine guarantees the model is *consistent* — computed, conserved,
the same every time. Whether the model is *true of the real kidney* is a
property of its numbers, which is content. So every system says what it
is a model of (`model`), where its numbers come from (`sources`), and
what it leaves out (`notes`, shown to the kid at model depth under
"About this model"); and a grown-up reads its answer key before any kid
plays it (§8). A kid at model depth who says "a real kidney would grow
stronger" has found the edge of the model — which is invariant 4's
sim-breaking badge, in a new form.

## 3. Every question is an intervention: the bench

Children learn what causes what by intervening (Gopnik and colleagues,
2004, §5). So every kind of question the owner asked for is a change the
kid makes to the system, recorded on the **bench** (`systems/system.js`):

| The kid's question | The change |
|---|---|
| What happens when x is removed? | **take it out** — and the stores it holds go with it; a part inside it (the ribosomes in the cytoplasm) goes too |
| What does a bad x do? | **put in a bad one** — the part's own faults: weak, clogged, backwards, flat, burnt; a fault is a different part within the laws, never a way around them |
| Does fixing that fix it? | **put a good one in** |
| What happens when two of x are added? | **add another** — for parts the system allows `copies` of: a copy with its own stores, beside the first |
| What happens if y goes in x's place? | **put it somewhere** — a two-ended part (one conduct or oneway flow, holding nothing: a resistor, a light, a switch, a hose) goes **beside** another part's spot (side by side, in parallel) or **in line** with it (one after the other, in series); beside a part that has been pulled is instead of it |
| What happens when x is blocked? | **block it** — one flow, without removing its part: a clamp on a hose, a stone in a kidney's tube, an antibody on the virus's door, no drinking |

**What a run breaks stays broken** until a good one goes in. That is
how the flashlight teaches the difference between fixing what blew and
fixing why it blew: swap the resistor for a plain wire and the LED burns
out; put a new LED in without fixing the wire and the new one burns too.

**Copies are offered only where a copy would really connect** the way a
real extra one would. A copy of the car's battery would hold its own
charge that nothing draws on — a modelling artifact, not physics — so
the car's battery has no copies; the Workbench flags a copy that takes
over nothing when the first is pulled (§8). The flashlight's minus
spring belongs to the case, not to the batteries, so a second pack
beside the first takes over when the first comes out.

**A spare is a part.** A need for a part is met by any copy of it (a
spare pump is a pump), and the goal and the instrument read every copy
the same way: "the light glows" holds if any light does, "under its
limit" only if every one is, and the instrument reads the most of them.
A copy of a part that gates its own flow gates its copy of that flow; a
copy taken out takes its clamp with it, and a part put in its place goes
back to its own. Beside a part that has another in line with it is
across that part's own two ends, not the whole line.

Pinned by hand calculation (`test/systems.questions.test.js`): two
resistors side by side halve R; in line they double it; two red LEDs in
line need 3.6 V and two cells make 3.0, so nothing lights; two switches
side by side are OR and in line are AND; a third kidney clears to
G/(1.5K); a second hose past the thermostat runs the engine cool;
blocking the drinking dries the body out in about four days.

## 4. The questions are made, never written

The owner: *"the variety of prediction and connection questions are as
infinite as the subjects covered."* So no question lives in a system
file. `systems/questions.js` makes them from the system's parts, stores
and flows and what the kid just did — **from the bench alone, before the
run**, so nothing in a question can give its answer away — and every
answer is **read off the run** by the solver:

| Kind | The question | Depth |
|---|---|---|
| works | Will it still do its job? | feel |
| direction | What happens to *this* — more, less, or about the same? | feel |
| first | Which part will be the first to stop? (the whole system is the menu) | feel |
| keeps | Will *that* part keep working? (a part one connection away) | feel |
| job | What do you think *this* part does? (its job against three others') | feel |
| reading | How much? — a band on the system's own instrument | measure |
| when | When will it stop doing its job? — a band in time, "never" at the top; a goal that also has a check judged only at the end asks about its other checks by name ("How long until this happens: 'The engine overheated and seized.'"), and a goal judged only at the end has no such question | measure |

The kinds **rotate round by round** (interleaving, §5), and "ask me
something else" skips to the next. A question about a part that stopped
counts any of the parts that stopped together as right, and its menu
holds every part that could stop or break, so the right answer is always
on it. "The same" is
within 2% (REVISIT with Stage 0). A setup the kid has run once cannot be
called again unchanged (2026-10-24 §4's rule) — with one exception the
troubleshooting needs: **a repair after a failure is always callable**,
even one that puts the system back exactly as it ships, and it asks the
troubleshooter's own question, *will it work now?* Without it, the kid
who mends the resistor and then the burnt LED could never call the fix
that the whole cascade was teaching.

A flow has **stopped** when it falls under 1% of what it carries in the
system as shipped — an open loop, a light with too little push, a
machine with nothing to work on — or when it cannot run at all (what it
needs is gone, a level is too low). That definition is the cascade's,
and the cascade is said to the kid as it happens. The questions ask
something sharper — what stopped *because of the change* — so their
answers compare the two runs: a part has stopped when it goes quiet for
good (none of its flows carrying even 1% of what it carries as shipped,
from then to the end) for longer than it ever rests as shipped,
measured step by step. A radiator idling while the engine warms, or
hoses resting each time the thermostat shuts, rest as shipped too; they
have not stopped because of anything the kid did. Hoses that never
carry a drop without the water pump, or a virus's door that runs out of
virus sooner with a second door, have. A part that breaks when it
doesn't as shipped stops then.

## 5. What the research says, and what was built from it

The owner asked for research-backed technique. These are the findings
this design leans on, checked at the source or its abstract, with the
caveats that came with them. None of it tested this game; the Stage 0
instruments (calibration curves, trust calibration, the planted-error
catch rate) are how we find out whether it works here.

| Finding | Built as |
|---|---|
| **Predicting before seeing boosts learning, through surprise.** Prediction beat evaluating after the fact, and the size of the surprise tracked what was learned (Brod, Hasselhorn & Bunge, 2018, *Learning and Instruction* 55). Unsuccessful attempts before study help later learning (Richland, Kornell & Kao, 2009, *J. Exp. Psych.: Applied* 15). Predict–observe–explain (White & Gunstone, 1992, *Probing Understanding*). | The gate on every change (invariant 2, as everywhere); the answer shown against the call. |
| **But children learn from being wrong only with the capacity to use the surprise**: in 9–12-year-olds, only those with stronger executive function learned from wrong predictions (Brod, Breitwieser, Hasselhorn & Bunge, 2020, *Developmental Science* 23(3)). | Scaffold the explain step instead of trusting surprise to do it: the cascade said in words as it happens, slow motion as it goes wrong, the before/after chart, and a "why do you think?" after a miss. |
| **Children learn causal structure by intervening** — preschoolers build causal maps from interventions (Gopnik, Glymour, Sobel, Schulz, Kushnir & Danks, 2004, *Psychological Review* 111). | The bench (§3): every question is a do(x). |
| **Novices see parts, not behaviour, and miss what is invisible.** Experts reason about structure, behaviour and function; novices mostly name visible structures and rarely mention invisible components (Hmelo-Silver, Marathe & Liu, 2007, *J. Learning Sciences* 16). | The invisible is drawn: waste in the blood, charge, heat, building blocks, all as jars and moving lines. A part's card says what it is and what it is wired to — structure and behaviour — and not what it is for; the job question asks function, and the run shows it. |
| **Kids default to simple linear causality and miss indirect effects**; teaching domino, cyclic and relational patterns explicitly helped 8–9-year-olds (Grotzer, *Understandings of Consequence*, Harvard Project Zero; Grotzer & Basca, 2003, *J. Biological Education*; Perkins & Grotzer, 2005, *Studies in Science Education*). | "Which stops first?" (the domino), "will *that* one keep working?" (one connection away), the thermostat and the virus (loops), the bathtub and the kidneys (balance: in = out). Naming the patterns waits for model depth (§12). |
| **Everyone, grown-ups included, gets stocks and flows wrong**, assuming a stock follows the shape of its flow — the correlation heuristic (Sweeney & Sterman, 2000, *System Dynamics Review*; Cronin, Gonzalez & Sterman, 2009, *OBHDP*); training reduces it (Sterman, 2010). | The bathtub; direction, reading and when questions on stores; and two of the Consultant's errors are that heuristic (§6). |
| **Comparing two cases side by side beats studying them apart**, and prepares learners for what comes next (Schwartz & Bransford, 1998, *Cognition and Instruction* 16; Gentner, Loewenstein & Thompson, 2003, *J. Educational Psychology* 95). | Every answer charts the system as it ships beside the system after the change. Comparing two systems with the same structure waits (§12). |
| **Unassisted discovery underperforms; discovery with feedback, scaffolding and elicited explanations does well** (Alfieri, Brooks, Aldrich & Tenenbaum, 2011, *J. Educational Psychology* 103, a meta-analysis of 164 studies). | Not a sandbox: every change is gated by a prediction, answered at once with the cascade, and followed by one elicited explanation. |
| **Prompting self-explanation improves understanding** (Chi, de Leeuw, Chiu & LaVancher, 1994, *Cognitive Science* 18; a later reanalysis credited prior knowledge more, so this is "moderate"). | "Why do you think it happened?" after a surprise: tap-to-pick kinds of reason or the kid's own words, free to skip, unscored, read by the grown-up. |
| **Mixing kinds of problem beats practising one kind at a time** (Rohrer & Taylor, 2007, *Instructional Science* 35; Kornell & Bjork, 2008). Practice testing and spacing rate highest of ten techniques; interleaving and self-explanation moderate (Dunlosky et al., 2013, *Psych. Science in the Public Interest*). | The question kinds rotate. Spaced revisits wait (§12). |
| **The control-of-variables strategy needs explicit teaching**: probe questions alone did not teach 7–10-year-olds; instruction plus probes did, and transferred (Chen & Klahr, 1999, *Child Development* 70). | The debrief's "what were you trying to find out?" is the probe. The instruction belongs at the kitchen table, with a grown-up (the brief's "fair test" card). |
| **Attempting before being taught helps conceptual understanding**, with weaker effects for younger students (Sinha & Kapur, 2021, *Review of Educational Research*, productive failure). | Never name a part's function before the kid has felt it: the job is revealed after the knockout, not on the card. |

Not built here, and waiting for a decision: high-confidence errors are
corrected more often than low-confidence ones (Butterfield & Metcalfe,
2001, the hypercorrection effect) — a "how sure?" on feel calls would
use it, at the cost of one more tap.

## 6. The Consultant, for systems

Same contract as ever (invariant 5; 2026-10-19 §2): never a live model,
right about four times in five, seeded so the same setup gets the same
advice, wrong only in ways a kid can catch by reasoning against the
system in front of them, never by tone. It answers three kinds — will it
work, which way, how much (`systems/consultant.js`) — and its errors are
checks a mechanic, a doctor or an engineer actually runs:

| Error | Caught by asking |
|---|---|
| ignored-spare | Is another part doing the same job? (the other kidney, a second pump) |
| buffer-forever | What is it running on, and does that empty? (it fails late: the battery, the heat building) |
| wrong-direction | Which way does stuff move through that part? |
| no-effect | That part is wired straight to this gauge — how could nothing change? |
| no-way-out | Nothing takes it out any more: can a stock with an inflow and no outflow settle? (the correlation heuristic, §5) |
| limiting-case | A virus with no door makes no copies — so why a number? |
| magnitude / unit-slip | Ten times, or a tenth: rough it out |
| confident-nonsense | Sure of itself, and simply wrong |

The kid's trust / doubt / run-it call is the journal's separate
`consultant` commitment, and the postmortem asks what kind of wrong it
was among the kinds that question can carry.

## 7. Something's wrong

The plainest form of the repo's claim — *know when you don't know, and
know what check to run* (2026-10-19 §1) — is troubleshooting, the
mechanic's and the doctor's whole job. A system arrives with a part
secretly bad, chosen so the symptom shows (`systems/diagnose.js`; a
system with a spare for everything hides two). The symptom plays first.
The kid gets **three checks** (REVISIT): a meter's honest reading of a
part at the symptom, beside a healthy one's, the way a service manual
says what a healthy one should read. Then they swap parts for good ones,
calling each time whether it will fix it. Damage stays: a fault that
burnt something is a two-part fix.

## 8. Putting a system in: the Workbench

The owner asked for an engine and an interface "that can handle putting
a system in." The engine half is §2's format. The interface is
`demo/workbench.html`, for the grown-up:

- Start from a built-in or the bathtub template; edit the JSON; **check
  it** with the game's own `validateSystem`, refused in plain words.
- See it drawn and running, and **read the answer key** — every pull,
  bad part, copy (and, if asked, every block), run — against what you
  know of the real thing. The page warns when the system fails its own
  goal as shipped, when a part breaks as shipped (the kid's next run
  would start from a broken one), when a change does nothing at all,
  when a copy takes over nothing when the first is pulled, and when the
  solver had to hold a store at empty — a machine and a level flow both
  draining it faster than one step can see, which a shorter step fixes.
- **Tick** that the answer key matches the real thing, or that the notes
  say where it doesn't — then save it to this device's shelf. Nothing
  saves without the tick (the costume portal's precedent). Pull It Apart
  checks every shelf entry again and skips a bad one.
- **Draft one in an AI chat**: the page builds a prompt from the laws
  and limits themselves (so it never drifts from what the check accepts)
  and the bathtub as a worked example. Paste the answer back and check
  it.

**The gate sits before the kid, not before publication — stricter than
the fixture library's, on purpose.** A fixture is a shape the honest
solver judges, so a granted branch could reach the kid at once and only
publication waited for an adult (2026-10-25, grant freely). A *system*
is a model: one that obeys every law can still teach a kid the wrong
kidney. So any system — and above all one a model composed — is read by
an adult before any kid plays it. The coach composing systems from a
sentence ("an RC car") behind this gate is the natural next verb, and
takes its own decision: what it costs, and whether its drafts land on
the Workbench for review the way doubted fixtures land on the pending
shelf.

## 9. The kid's page: Pull It Apart

`demo/apart.html`. Pick a world — the flashlight, the kidneys, a flu
virus in a cell, the car, the bathtub, or one from the shelf (invariant
1: the kid picks the world). See it working: parts are cards to tap,
stores are jars that fill and empty, flows are lines in their
substance's colour whose dots move as fast as the stuff does compared
with as shipped. Tap a part to change it (§3); tap a line to find what
it belongs to and block it. Every change opens the gate (§4), with the
Consultant before the question when it is on (it starts on in measure
mode and a button pins it either way, as on Will It Break). Then the run
plays, the cascade said as it happens, slowing as it goes wrong; then
the answer and the before/after chart; then **one follow-up at a time,
never a toll**: the postmortem if the Consultant spoke; "why do you
think?" after a miss; or, instead of that, the debrief when one is due.

Spoken mode, the reader toggle and the educator's log work as on the
other playables; a pre-reader answers everything by tapping pictures.

## 10. What the journal hears

- `level` is `sys:<system>` (a mystery's is `sys:<system>:mystery:<n>`),
  `about` names the question kind, `of` the gauge or part it was about,
  and `setup` the bench, so seen setups and the debrief's "same problem"
  are honest.
- **`buildFailed` means a repair that did not hold.** Pulling a part to
  see what happens is an experiment, and an experiment does not fail —
  only a prediction can. A run after the kid put a good part back, put a
  part back in its own spot or unblocked a flow is a repair, and a
  repair that leaves the system failing is a failed build. That is what
  makes the debrief's three triggers mean the right things here,
  including "what was different about the one that worked?" when the
  next repair holds.
- The explain answer rides on the entry for the grown-up, like the
  debrief's. The kid sees only their calls, their streak and their trust
  calibration.

## 11. What this does not change

The engineers' build order, the coach's economy, settings, the shelf
and the debrief all stand as decided. Zero runtime dependencies: the
pack is plain ES modules reaching only itself and `engine/freeze.js`,
and a system file is data that imports nothing (both checked by
`test/boundaries.test.js`). No model call anywhere in the pack, no new
server route, no speech recognition. The journal takes no new input
that could reward time on task; the duration-invariance test keeps
passing. Skins are untouched; a system's names and icons are its own
content, reviewed with its numbers.

## 12. What waits

- **Couplings between substances**: a motor turning current into motion,
  Joule heat, an LED's light as its own substance. RC cars, computers
  and a real car's electrics wait for them, with hand calculations.
- **Square laws**: drag and lift go with speed squared, a drain with the
  square root of depth. An airplane waits for them.
- **More worlds**: an RC car, an airplane, a computer, a logistics line
  (stores, trucks and a factory are expressible today), the heart and
  lungs, a pond.
- **Compare questions** (this change or that one?) and **cross-system
  analogies** (which part of the car does the kidney's job?) — analogical
  encoding (§5) — once there is a way to say two parts play the same role
  that is honest about where the analogy breaks.
- **Naming the causal patterns** at model depth — domino, loop, spare,
  buffer, bottleneck — after they have been felt.
- **Confidence on feel calls** (hypercorrection), and **spaced revisits**
  of systems seen before.
- **The coach composing systems** (§8), and **settings** (2026-10-25)
  for this pack: a system plus the lesson's focus ("today: spares").
- Every REVISIT number: 2% for "the same", 1% for "stopped", three
  checks per mystery, the exemplars' numbers, the copy limits.

## 13. Built in this step

`systems/` (the laws, the validator and the bench; the solver and its
wiring; the questions; the Consultant; the mysteries), five systems in
`systems/library/` each pinned to its hand calculations, Pull It Apart
and the Workbench in `demo/`, the long-range brief
(`docs/intuitive-systems-thinkers-brief.md`), and the tests:
`systems.test.js`, `systems.library.test.js`,
`systems.questions.test.js`, `apart-words.test.js`, and the pack's
boundary in `boundaries.test.js`.
