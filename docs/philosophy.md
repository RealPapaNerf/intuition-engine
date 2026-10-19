# The philosophy: what this is actually for

Plan of record for the invariant layer. The ants, the frogs, the
bridges — demonstrations. This document is the thing being built.

## The mission, in one sentence

Train people who can think critically, verify anything, learn anything
quickly, and work *with* AI without surrendering judgment to it —
starting in childhood, through games they'd choose to play anyway.

## The bet on the world

- AI compresses education. The volume of detail that forced a century
  of narrowing — PhD, then postdoc, then a sliver of a field — no
  longer has to live in a human head. The 1800s polymath existed
  because there was less to know; the coming generalist can exist
  because the detail is on tap. What cannot be on tap is judgment:
  knowing roughly what the answer should be, noticing when it isn't,
  knowing which question to ask next.
- The skills worth front-loading therefore change. Spelling, formula
  derivation, query syntax, even coding: cheap on demand. Critical
  thinking, double-checking, calibrated prediction, reading people,
  hard conversations, intuition for how AI fails and when to employ
  it: priceless, and trainable only through years of practice.
- An education that doesn't change produces pencil-whippers: people
  who accept whatever the machine (or the feed) says, fluently.
- The civic stakes are the same skills at society scale. A person
  trained from age five to predict-then-verify does not accept social
  media as truth — digging in is their reflex. A person trained from
  age five to have hard conversations is not afraid of disagreement.
  Misinformation resistance and civil discourse are not units in this
  curriculum; they are what the curriculum *is*, worn as games.

## What we honestly don't know

Whether it works. That is stated here so it never gets lost: this is
a hypothesis with a test plan, not a doctrine. Specifically:

- **What transfers is contested.** The research record says domain
  intuition is mostly domain-bound — a chess master's pattern sense
  does not make them a good doctor. What plausibly *does* transfer is
  the meta-loop: predicting before testing, verifying, knowing what
  you don't know, iterating without fear. So the framework promises
  the meta-loop, hopes for broader intuition, and **measures both**
  instead of assuming either.
- **The claim, precisely** (refined 2026-10-19, see
  `decisions/2026-10-19-brainstorm.md`): the engine does *not* train
  kids to "smell" a wrong AI answer without knowing the subject —
  automation-bias and jagged-frontier studies cut against that, and
  textual tells of wrongness expire with every model generation. It
  trains kids to **know when they don't know, and know what check to
  run** — plus knowing what real understanding feels like from having
  built it deeply once, so they recognize its absence elsewhere. Near
  transfer (an ER doctor picking up an adjacent specialty) is real
  because the schema is shared; AI may widen what counts as "near,"
  and that is the sharper, testable form of the generalist bet.
- **Knowledge is not optional, it's a by-product.** "Kids don't need
  the formula" does not mean kids end up empty: intuition needs
  furniture in the head, and a kid who plays a season genuinely knows
  tension, compression, and load paths. The change is sequencing —
  knowledge arrives from play instead of being its prerequisite.

## The invariants

Any implementation of this philosophy, in any subject, with any
theming, must have all of these. They are the engine; everything else
is content.

1. **An educator sets the goal; the kid picks the world.** The goal
   (what must become true) is authored; the skin (ants, steel, human
   hair, Build-A-Bears, the kid's actual obsession) is generated per
   kid. Engagement comes from the kid's interests; rigor comes from
   the goal.
2. **Predict before test, every time.** No experiment runs until the
   kid commits to a guess. Calibration — predictions landing inside
   the kid's own stated bands, bands narrowing over the years — is the
   prestige stat.
3. **Honest ground truth.** There is always something real and cheap
   to test against. The AI may skin the world; it may never invent its
   physics.
4. **Score the goal, never the method** — the superintendent rule.
   Full points for any honest solve, a bonus for showing the
   principle, a human-confirmed jackpot for a way nobody has tried.
   Game-breaking is a finding, not cheating. Right answers, rigorous
   answers, unique answers, and broken games are all rewarded —
   because that is the complete portrait of a good engineer, and of a
   good citizen.
5. **The coach asks; the Consultant errs.** The trustworthy AI never
   answers, only questions. The answering AI is deliberately fallible
   at a calibrated rate, so verification stays the skill. This is how
   a kid builds intuition *for AI itself*: what kinds of errors it
   makes, when to trust it, how to check it cheaply, how to employ it
   on purpose. That intuition is as much the curriculum as the subject
   matter.
6. **Spiral, don't sequence.** Feel it, then measure it, then model
   it — the same games deepening for years, so nothing is ever
   finished and left behind, and formulas arrive as names for old
   friends.
7. **An adult stays in the loop.** A parent or teacher reviews the
   work, judges novelty, runs the physical builds, and is the other
   half of the hard conversations. The program flags; a person
   decides.
8. **Hard things are practiced early and often.** Failure is content.
   Hard conversations are rehearsed from kindergarten. Struggle
   reframed as iteration on something you care about stops being
   struggle.
9. **It must work with zero technology first.** Every track starts at
   a kitchen table. If the loop can't grip a five-year-old with
   spaghetti and washers, no engine will save it.

## The domain pack contract

Subjects are plugins. Engineering is pack #1 and negotiation is
pack #2 only because they're what I'm learning now; anatomy, emergency
medicine, comedy, or anything else joins by supplying five things:

1. **Ground truth** the kid can cheaply test against: a simulation
   with honest rules, a consistent hidden-state model (people), or a
   physical experiment. *No ground truth, no pack* — a subject where
   nothing can be checked would train the exact credulity this
   framework exists to prevent.
2. **A concept ladder**: what builds on what, with a feel / measure /
   model depth for each rung.
3. **Goal archetypes**: level skeletons stated as outcomes, skinnable
   per kid, comparable across kids.
4. **An error taxonomy** for the Consultant: the characteristic ways
   confident answers go wrong in this domain.
5. **A real-world companion**: something to build, run, or say at the
   table, because intuition transfers through hands and voices.

Worked examples: engineering's ground truth is the physics engine in
this repo; negotiation's is hidden-brief characters with fixed trust
rules; emergency medicine's would be a simplified but consistent
physiology model (predict what the vitals do before you intervene);
comedy's — the hardest, maybe a later one — an audience model honest
enough to be worth predicting.

## Adaptation and its leash

(Decided 2026-10-19.) The "lazy path" — skip thinking, just run the
build — is a symptom with four causes, and only one is disengagement:
**bored** (bands narrow, predictions right, few attempts),
**overwhelmed** (bands wide, builds failing, attempts stalling), the
**rational experimenter** (bands junk, but each build changes one
variable and results improve), and a **different goal** (sim-breaking,
score-chasing — which is invariant 4's badge, not a problem).

- **The detector is throwaway predictions, never build count**: bands
  that never narrow, bands wide enough to always win, numbers that
  don't move between attempts. A kid with honest, narrowing bands may
  run as many builds as they like.
- **The automatic response ladder**, escalating only while the signal
  persists: raise the cost of the sim (slower runs or a build budget,
  so thinking becomes the cheap path again, as at the kitchen table
  where spaghetti is expensive); change skin; adjust depth (down for
  the overwhelmed pattern, up for the bored one); flag the adult.
- **The hard constraint — the line between this engine and a feed:**
  adaptation optimizes for *prediction quality improving*, never for
  session length or time-on-task. The adaptation code takes no
  engagement-time input, and a test asserts its outputs are invariant
  to session duration.
- **Debriefs**: run after a failed build or a throwaway streak, never
  after every level (a toll). The core question is *"what were you
  trying to find out with that build?"* — an experimenter has an
  answer; a disengaged kid doesn't. The coach **never classifies the
  kid** ("you seem bored" breaks invariant 5 and gets gamed within a
  week); the kid's answer plus the calibration evidence go to the
  adult as a flagged diagnosis, and the adult decides.
- **Visibility**: the flag and its evidence are adult-only. The kid's
  visible calibration stat stays what it was — the prestige score —
  and the kid never sees "your bands haven't narrowed in six levels."

## How we'd know it's working

The framework is instrumented by design — the scoring stats *are* the
research instruments:

- **Calibration curves** per concept, over months: do the bands narrow?
- **Trust calibration**: does the kid beat chance at knowing when the
  Consultant is wrong, and improve?
- **Planted-error catch rate**: planted wrong answers, delivered
  confidently — are they caught, and caught earlier, by running the
  right check?
- **Invention rate**: Museum entries confirmed by the adult.
- **Transfer probes** — the test of the whole generalist bet: after a
  season in pack A, does a kid learn pack B's first units faster than
  a matched kid who starts cold? Does bridge intuition show up at a
  real bookshelf?

Staged honestly: stage 0 is my own kids at the kitchen table; stage 1
is one classroom with a willing teacher; each stage states up front
what result would count as failure. And failure criteria, so this
stays a hypothesis: flat calibration curves after a full season, no
transfer advantage, or kids who need the game removed to keep working.
If those happen, the philosophy is wrong somewhere, and the data will
say where.

## What success looks like, one generation out

People who are specialists in judgment and generalists in everything
else. Who treat every answer — from an AI, a feed, an authority, or
their own gut — as a hypothesis until tested, out of habit rather than
cynicism. Who invent, and expect invention to be rewarded. Who can sit
down across a disagreement without fear, because they have done it ten
thousand times, starting with a sibling and an orange.
