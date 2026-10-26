# 2026-10-25 — The debrief the kid actually gets, and the one Stage 0 asked for

Seventh decision of the day, from the owner, from the kitchen table.
Where this conflicts with `2026-10-19-brainstorm.md` §7, **this one
wins** (the standing newest-first rule).

## 1. What Stage 0 found

The owner, playing: *"I had a bridge that was straight across, the
bridge couldn't hold a 110 gram frog. I gave the bridge more ants, the
bridge sagged but held. The hardest working ant held up to 97%. When
the exercise is done and before the kid moves on, the AI coach should
debrief with the kid. What was different about some of these
successful/unsuccessful attempts? What did you learn?"*

Two things are true at once. The debrief was decided on 2026-10-19 §7
and **the kid has never once been asked one** — `needsDebrief()` is
computed, flagged to the adult, and never surfaced in the game. And
§7's triggers miss the moment the owner is describing: a problem the
kid *got right after getting it wrong*, where the contrast between
their own two attempts is the whole lesson.

## 2. A third trigger: the problem the kid resolved

Debriefs run, as before, after a failed build and after a
throwaway-prediction streak — and now also **when a build holds on a
problem an earlier attempt failed**. Same level, same question, a
different result the kid caused.

This is still not "after every level", which §7 rightly calls a toll:
it fires only where there is a real contrast to point at, and a kid
who sails through a problem first time is never stopped.

`needsDebrief()` keeps its meaning and gains the case. `debriefKind()`
names which of the three it is, because the question differs.

## 3. The questions, and what they may not do

- **resolved** — *"What was different about the one that held?"* and
  *"What did you learn?"*
- **failed** — §7's core question, unchanged: *"What were you trying
  to find out with that build?"*
- **throwaway** — the same question, because that is exactly what
  separates the rational experimenter from the disengaged kid (§5).

The coach never classifies the kid: no "you seem bored", no "you have
been guessing". It asks about the kid's own attempts and nothing else.
When the live coach is in, it is told the kid's recent attempts on this
problem — what they said, what happened, how many links, how hard the
hardest one worked — because those are the kid's own actions and the
kid can see every one of them. **Adult-only flags still never reach
the coach**, whatever the client posts: the whitelist stands.

## 4. It must work with no coach at all

Stage 0 ran keyless, and a debrief that only exists when
`ANTHROPIC_API_KEY` is set is a debrief that mostly does not exist. So
the debrief **opens with a canned question of ours** — free, instant,
honest, the same every time — and the kid's **answer** is what the live
coach then responds to, with another question, about what they said.

**The debrief spends nothing.** It asks a canned question of ours and
records the answer, with no model behind it — no question off the
meter, no cents on the ticker, and the same debrief whether or not
there is a coach today. The owner's rule, 2026-10-25: *"don't make the
debrief cost money. The cost is to make the kid be wise about what
they are building, and so we don't have one kid spam the credits
building random items."* Money is for building things, not for talking
about what already happened.

An ask the kid *chooses* to make while a debrief is open carries what
just happened, so the coach's question is about their own attempts —
that one is theirs to spend, like any other.

## 5. Answering without reading, and without a penalty

The answer is tap-to-pick picture options in the kid's own words
("more ants", "a different shape", "something new to hold onto", "a
lighter one"), plus typing for a kid who reads. **"I don't know" is
always one of the options, and costs nothing** — §5 says an
experimenter has an answer and a disengaged kid doesn't, which only
works as a signal if saying so is free.

"I'd rather build" is always available too. The debrief is shown where
the eye is and never blocks the next build: a toll is exactly what §7
said not to build. A skip is recorded as a skip, not a failure.

## 6. The answer goes to the adult, with the evidence

Where it was always meant to go: `adultFlag(journal, debriefAnswer)`
has taken that argument since 2026-10-19 §7 and has never been handed
one. The answer rides on the journal entry it belongs to, travels with
it to the educator's window, and shows up there as what it is — "bands
haven't narrowed in six levels; when asked, said 'I dunno'". The kid
never sees a diagnosis.

## 7. What this does not change

The debrief adds no engagement-time signal and no new adaptation
input: the answer is evidence for an adult, not a knob. The
duration-invariance test keeps passing. The coach still only asks.
