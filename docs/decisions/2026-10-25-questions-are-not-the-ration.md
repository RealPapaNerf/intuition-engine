# 2026-10-25 — Questions are not the ration

Fourth decision of the day, from the owner, rebalancing the coach
economy built this morning. Where this conflicts with
`2026-10-25-free-items-honest-physics.md` §4, **this file wins** (the
standing newest-first rule).

## 1. A kid is never refused a question

The morning's build made questions the rationed thing: `asked ≥ budget
→ jar-empty`. Wrong resource. Questions are the pedagogy — help, "why
did it break", asking for the problem to meet their skill — and a kid
must never fail because the help ran out. **The per-problem budget
stops being a wall and becomes a pacing meter.** The ask always goes
through. The kid still sees questionsLeft tick down (budgeting stays
curriculum), and going past it is visible, not fatal: the coach is
told `overBudget` and its posture shifts — questions that turn the kid
back toward what they already have (placing, testing, grabbing from
the library). Never scold, never refuse.

`budgetFor(librarySize)` keeps its shape (30 → floor 8 as the library
grows, REVISIT): it now decides when the posture shifts, never when
the coach stops.

## 2. The cents guard is the only wall — and it has a canned floor

Credits are the one genuinely finite thing (the owner's first ask:
don't blow through credits). The daily guard stays hard but rises
25¢ → 100¢ per kid (REVISIT — at roughly 2¢ a live ask that is ~50
asks, far past honest play). Two softenings:

- **A warning band at 80%** (REVISIT): the educator is flagged before
  the wall, not after it.
- **Past the wall the kid still gets a question.** The coach answers
  from a small canned deck — free, local, rotating so a resting coach
  is not a broken record — and grants pause until morning. The demo
  shows "the coach is resting", never a dead button. The deck is
  curated steering, not a model, and never an answer.

## 3. Stuff is guided, never walled

The kid's asks for *stuff* are the thing to watch — but behaviorally,
not with counters. `GRANT_BOUNDS` are solver-sanity caps only, kept
generous (fixturesMax 6 → 12, REVISIT upward as the solver proves
itself): crowding the riverbed with granted things until the sim
groans is protected play — "score the goal, never the method;
sim-breaking is a badge". A kid who stockpiles grants without placing
links gets a coach whose question points at building with what they
already hold (the prompt now says so). No grant counter refuses them.

## 4. Over-reliance flags the adult, not the kid

The coach reports every ask into the educator window (`noteAsk`).
The educator's view of a kid gains a `coach` block — asks, times over
budget, whether they neared the credit guard or hit it — and a
**coach-reliant** reading when asks outpace attempts (at least 12
asks and more than 2× the journal entries, REVISIT). Reliance raises
the adult alert exactly like the bored fingerprint does; the kid never
sees it (kid-visible vs adult-only, invariant 7). Asks are not journal
entries — they feed this signal and nothing else, so the feed-line
invariant is untouched.

## 5. Spoken mode: a preschooler can play

The game must work before reading does. The demo speaks back via the
browser's own speechSynthesis — on-device, free, zero dependencies.
The *listening* half is different, and this is a hard rule: **a kid's
voice never leaves the machine.** Chrome's built-in SpeechRecognition
uploads the recording to Google's servers, so it is never used. The
big mic button ships only together with a local listener: the
candidate is Cactus Compute's **Whistle** (16.9 MB speech-to-text,
CPU-only, Apache 2.0, English among seven languages), run server-side
behind a `POST /coach/hear` route so the audio goes one hop on
localhost and dies there. Installing it bends the zero-dependency
convention, so it takes its own decision file, install, and
hand-verification before it lands — a build session must not improvise
it. Until then, spoken mode is: intro and coach questions read aloud,
and input by tap-to-pick picture prompts (big buttons — creatures,
things, "why?", "what if?") that need no reading.

A per-kid **reader** toggle — the educator flips it once the kid reads
and writes — turns the spoken-first UI off. The engine side is done
here: the kid state carries `spoken`, and the coach rules bind it —
when the words will be read aloud to a pre-reader, the question is at
most twelve plain words.

## 6. The problem introduces itself

Every base level carries `intro`: canned words of ours — free,
honest, the same every time, never the model's. SPAN_GAP gets its
own. In spoken mode the demo reads it aloud when the level opens;
otherwise it shows as text. An intro sets the scene and the goal; it
never hints at a solution (that would be the coach answering).

## 7. Handoff additions (the UI list grows)

12. Spoken mode behind the reader toggle: questions and the intro read
    aloud (speechSynthesis only), input by tap-to-pick picture prompts.
    **No SpeechRecognition, ever** — the mic button waits for the
    local-listener decision (§5).
13. The intro card on every level.
14. The ticker's two new states: over budget (meter at zero, play
    continues, coach steers) and resting (canned question, grants
    wait for morning).
15. The reader toggle and the coach-reliance panel in
    `demo/educator.html`.
