# 2026-10-25 — The setting, the shelf, and what the money is actually for

Eighth decision of the day, from the owner, from the kitchen table.
Where this conflicts with `2026-10-25-the-fixture-library.md` or
`2026-10-25-free-items-honest-physics.md` §4, **this one wins** (the
standing newest-first rule).

## 1. Level authoring is choosing the setting

Said plainly, because a build session got it wrong: **level authoring
is the educator putting the kid somewhere.** A forest, a bedroom, a
construction zone, a rainforest with army ants — whatever the educator
thinks will engage *this* kid. It is not handing out items. It is
choosing the world the kid wakes up in.

Once the setting is picked, **the kid explores it.** Everything after
that is the kid's: what to look for, what to ask for, what to build
with, what to try.

A setting is **either a named bundle the educator picks, or one
composed for this one child** — and the second is the point. The
owner: *"this is the strength of this program vs previous educational
programs. This provides a huge degree of flexibility vs a program
without AI. The game is supposed to be an engine. The educators or
parents layer subjects, lessons, skills on top of this."*

That is the mission sentence of this repo aimed at a single kid: the
engine is the product, and a setting is cheap because a model can
compose one. A pre-AI program shipped the settings it shipped. This
one composes the rainforest the child in front of you will chase.

What a setting is allowed to change, because the invariants still
bind. A different costume is a skin and touches no physics. **Army
ants are not a skin** — different creatures with different limits are
a different level, as 2026-10-22 §4 has always said. A setting
therefore names a level and a costume together, plus the vocabulary of
what can be found there.

## 2. The shelf comes first, and the kid may search it themselves

In a setting, the kid looks for things that could be found there — a
branch and a vine in the rainforest, a cushion and a bookshelf in the
bedroom, a plank and a cinder block on the site. Two ways in, and they
are equals:

- **The kid searches the library themselves.** Free, local, no model,
  no coach needed. This is the same shelf the coaches search, and
  looking was already free (free items §5).
- **The kid asks the coach to search it.** Also free of the build
  meter — asking is talking (§5).

If the thing is on the shelf, the kid takes it: **no building, no
cost.** The work was done once, by whoever first asked for it, and
that is the whole point of a shared shelf.

If it is not on the shelf, **the coach builds it** — and the new thing
goes two places at once: into **the kid's inventory**, and onto the
shelf for the next kid who looks for one.

## 3. A spaceship in the rainforest goes to the educator, never back at the kid

**The coach decides whether a thing could be found here.** Not a fixed
vocabulary: the judgement is the model's, because judging "is there a
vine in a rainforest?" is exactly the thing a model is for and a list
would be obsolete the moment an educator invents a setting nobody
anticipated.

When the ask does not belong in the setting — a spaceship in the
rainforest — **the coach asks the educator.** It does not refuse the
kid, does not lecture them about rainforests, and does not quietly
grant it either. The request waits for an adult, exactly like a build
the coach doubted waits on the pending shelf (grant freely §2), and
the adult says yes or no.

To the kid this is never a wall: the coach's reply is still a
question, they keep everything they already have, and the game carries
on. Nothing physics allows is refused (grant freely §3) — an adult
simply decides whether it belongs in *this* lesson.

## 4. Inventory: what the lesson gives, and what the kid goes and gets

A granted item lands in the kid's **inventory** rather than straight
into the world. Having a branch and placing a branch are two different
moments, and the second one is the kid's hands
(`2026-10-25-the-kid-places-it.md`, which this file assumes).

**A lesson starts the inventory nearly empty — one or two things, and
those things are the point of the lesson.** The owner: *"the lesson
will only have one or two things, the purpose of the lesson. The kid
provides the rest as they search the library or ask for things to be
built."* The educator's one or two items are the curriculum;
everything else in the scene is the kid's own doing.

## 5. What the money is actually for

The owner: *"The cost is to make the kid be wise about what they are
building, and so we don't have one kid spam the credits building
random items."*

So the kid-visible meter counts **building**, not conversation:

- **Taking from the shelf is free.** It is already built.
- **Searching, asking, debriefing, being asked a question — free.**
  None of it is the thing the budget is teaching.
- **Composing something new costs what it actually cost.** Not an
  abstract token: the API's own usage for the turn that built it,
  priced in cents, which the service already computes. *"A build
  costs how much it costs the AI to build. A twig and a tree should
  both be simple emojis, they cost the same. An animated space
  shuttle, that's going to cost more."*
- **So complexity pays for itself, honestly.** A forty-member tree
  costs more than a three-member twig because composing it really is
  more work — and a tree the kid can take apart for forty pieces of
  wood is worth more to them than a twig. The rule needs no tuning as
  items get richer: whatever the thing costs to make is what it costs.
- **The daily cents guard is unchanged**, and still counts every real
  call, because credits are real and talking is only free to the kid.
  It stays the one hard wall, with its warning band and its free
  canned question behind it (questions §2).

This replaces free items §4's "a library pick still costs an ask" and
its per-problem count of asks. It does not replace questions §1: a kid
is still never refused a question, and now has even less reason to be.

## 6. Taking a thing apart

Implied by the owner's own example and worth stating: **a kid can
disassemble a granted object** into the material it is made of, and
build with the pieces. Forty members of wood in a tree are forty
pieces of wood in a jar. Nothing new is needed from the physics — the
pieces were always ordinary members of a catalog material — and it is
the clearest answer yet to why a big object is worth more than a small
one.

## 7. What this does not change

Everything a granted thing has always had to be: catalog materials
only, no physics in the data, grid-step members, re-validated against
the live level at grant time, and `engine/grants.js` the only gate.
Stored shelf files are never trusted. A build the coach doubts still
waits for an adult before it reaches the shelf (grant freely §2) — the
kid still gets it in their own inventory. The coach still only asks,
never places the kid's bridge, and never classifies the kid.

## 8. The build order this implies

1. **The shelf the kid can take from** — a search on the kid's page,
   free and keyless, into the inventory. This one unblocks a kitchen
   table with no API key, so it goes first.
2. **Inventory and placing** (`the-kid-places-it.md`): pick up, move,
   size, and take apart.
3. **The build meter in cents**: builds charged at their real cost,
   talking free, the guard unchanged.
4. **The educator's question queue**: asks that do not belong in the
   setting, waiting for yes or no — the same shape as the pending
   shelf, and it can share its panel.
5. **Settings**: a named bundle (level + costume + what is found here),
   picked or composed, with the lesson's one or two starting items.
   Everything above is usable before settings exist; settings are what
   make it a curriculum instead of a sandbox.
