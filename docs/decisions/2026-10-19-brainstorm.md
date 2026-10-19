# Intuition Engine — decisions from brainstorm session, 2026-10-19

For the build session. These decisions refine the plan of record; where
they conflict with existing design briefs, these win. Read the
"Why" sections so the implementation serves the intent, not just the
letter.

## 1. The claim the engine makes (reframed)

**Old claim (retire it):** a kid with intuition for how AI thinks can
*smell* a wrong AI answer without knowing the subject.

**New claim (build to this):** the engine trains kids to **know when
they don't know, and know what check to run.** The transferable skill
is the meta-loop — predict, verify, calibrate, iterate — plus
*knowing what real understanding feels like* from having built it
deeply once, so they recognize its absence elsewhere.

**Why:** the research cuts against the old claim. Automation-bias and
"jagged frontier" studies show people with AI assistance do *worse*
outside the model's competence because they can't tell which side of
the frontier they're on. Domain-free detection of AI errors is a set of
checks you run, not a feel you have — and textual "tells" of wrongness
expire with every model generation. Near transfer (ER doc → another
specialty) is real because the schema is shared; AI may widen what
counts as "near," which is the sharper, testable version of the
generalist hypothesis.

**Wording changes to the philosophy doc:** replace "smell a wrong
answer" and "felt taxonomy of how confident wrongness looks" with
language about checks and calibration. Rename the "smell tests"
instrument to "planted-error catch rate."

## 2. Consultant error design

- Every Consultant error must be **catchable by reasoning against
  reality**, never by how the text sounds. Each curated error fails at
  least one of: units mismatch, wrong sign, wrong direction of scaling,
  a quantity that doesn't vanish in a limiting case (zero load → zero
  stress), order of magnitude off (~10×), or contradiction with a prior
  the kid has already calibrated in an earlier level.
- At K–2 ("feel it") depth the same rule is a claim against a feel
  they've built: "the thin stick holds more than the thick one."
- The Consultant's text must be fluent and confident. No tonal tells.
  If a tester can spot the error without running a check, redesign it.
- Every error is catchable by a kid at that depth who thinks hard
  enough. No errors that are only resolvable by running the build.

## 3. Scoring the catch

Per invariant 4 (score the goal, never the method), score **whether and
when** the error was caught, not how hard the kid thought:

| Outcome | Score |
|---|---|
| Caught before build | top tier |
| Build fails → postmortem → caught | next tier, still positive |
| Declared "I can't judge this one, run it" | scores as a valid catch of the kid's own limit |
| Used Consultant's number uncritically, build fails, never caught | zero, and feeds the disengagement log (§5) |

The existing "show your engineering" bonus still applies on top.

## 4. Separate commitments

The kid's own prediction and the Consultant's answer are **logged as
two separate commitments.** "I'll just use the Consultant's number" is
a visible, scorable trust choice, not a shortcut around predict-before-
test. Trust-calibration vs the Consultant is computed from this log.

## 5. Disengagement: detection

The "lazy path" (skip thinking, run the build) is a symptom with four
causes. Only one is disengagement:

| Cause | Log fingerprint |
|---|---|
| Bored | bands narrow, predictions right, fast, few attempts |
| Overwhelmed | bands wide, builds failing, attempts shortening or stalling |
| Rational experimenter | bands junk, but each build changes one variable and results improve |
| Different goal (breaking the sim, score-chasing) | extreme inputs, sim-breaking, score-pattern exploits — this is invariant 4's badge, not a problem |

**Detector:** throwaway predictions — bands that never narrow, bands
wide enough to always win, numbers that don't move between attempts.
**Not** build count. A kid with honest, narrowing bands may run as many
builds as they like.

Rational and different-goal look alike in the numbers; the coach's
debrief question separates them (§7).

## 6. Disengagement: automatic response ladder

Runs on the log alone, in this order, escalating only if the signal
persists:

1. **Raise the cost of the sim** — slower runs or a build budget — so
   thinking becomes the cheap path again (mirrors the kitchen-table
   tier, where spaghetti is expensive and prediction pays
   automatically).
2. Change skin.
3. Adjust depth (down for overwhelmed-pattern, up for bored-pattern).
4. Flag the adult.

**Hard constraint:** adaptation optimizes for **prediction quality
improving**, never for session length or time-on-task. Add a test or
assertion that no adaptation path is rewarded by engagement-time
metrics. This is the line between the engine and a feed.

## 7. Debriefs and diagnosis

- The coach **never classifies the kid.** No "you seem bored." Doing so
  breaks invariant 5 (the coach only asks) and will be gamed within a
  week — kids learn which answer ends the debrief.
- Debriefs run **after a failed build and after a throwaway-prediction
  streak**, not every level. A debrief after every level is a toll.
- Core debrief question: **"What were you trying to find out with that
  build?"** An experimenter has an answer; a disengaged kid doesn't.
- The kid's answer plus the calibration log go to the adult as a
  **flagged diagnosis with evidence attached**, e.g. "bands haven't
  narrowed in six levels; when asked, said 'I dunno.'" The adult
  decides (invariant 7).

## 8. Visibility

The disengagement flag and its evidence are **adult-only.** The kid
never sees "your bands haven't narrowed in six levels." The kid's
visible calibration stat stays what it was: the prestige score.

## Open items (not decided)

- When a postmortem still doesn't surface the error: does the coach
  narrow its questions, or does the level end unfound with an adult
  flag? Not settled.
- Exact thresholds for "throwaway" bands and for streak length. Pick
  something, instrument it, revisit with Stage 0 data.
