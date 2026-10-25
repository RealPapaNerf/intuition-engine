# 2026-10-25 — Grant freely, publish carefully

Fifth decision of the day, from the owner, after a side-session note
that the fixture library was per-computer (saved files, never pushed).
Where this conflicts with `2026-10-25-the-fixture-library.md`, this
file wins.

## 1. The library auto-publishes

A saved fixture is committed and pushed on its own, the moment it is
saved — flmap's Save is the precedent. The rules that keep this safe
in a many-session repo:

- The server commits **only the fixture file it just wrote** (`git
  add <file>` then `git commit -- <file>`), never the rest of a tree
  another session may have dirtied.
- Publishing is best-effort and asynchronous: a failed push stays a
  local commit and rides along with the next one; nothing in the
  publish path may ever block or fail the grant or the save.
- Receiving is still `git pull` / a server restart on the other
  machine (REVISIT: a periodic quiet pull once two machines really
  run at once).

## 2. Granting is private; publishing is adult business

The owner's worry, plainly: a kid asks the coach for something
inappropriate; the coach builds it; it must not end up on the shared,
now literally public-to-the-repo shelf. And the standing directive —
don't limit creativity — must survive.

The resolution is that **the grant was never the risk**. A granted
thing lives in one kid's scene, in that kid's level variant, visible
to that kid's educator. The library is *publication*. So the gate
moves to where the risk is:

- Every fresh build the coach composes carries **`share`** (new
  schema field): true means "any kid's shelf should offer this."
  When the coach doubts a thing belongs on the shared shelf, it sets
  share false — **the kid still gets the thing in their own scene.**
  The build is never refused over this.
- A share-false build lands in **`fixtures/pending/`**: never
  searched, never offered to coaches, never pushed (gitignored). The
  educator window lists pending builds; **approve** publishes it
  (saved, credited to the kid, pushed), **reject** deletes it. An
  adult stays in the loop — invariant 7 doing exactly its job.
- The kid-facing demo says nothing about any of this: moderation is
  adult-only, like every flag.

## 3. Creativity costs honestly, it is never refused

Nothing physics allows is said no to. An unpublished thing simply
never gets amortized: asked for again, it is composed again, and the
kid's own bill shows the compose. "It should cost each time" is the
existing economy doing its work — the library discount is the reward
for things an adult let onto the shelf.

## 4. The model is the backstop beneath the gate

A truly explicit ask meets the coach model's own refusal, which the
leash already handles: canned question, no grant, the game never
blocks. Scene-private names (a granted cargo's) stay scene-private
and charset-bounded. Shapes can only be judged by the coach and the
adult — which is who judges them now.

## 5. Handoff addition

16. The educator's pending shelf in `demo/educator.html`: list,
    approve, reject (`GET /educator/pending`, `POST
    /educator/approve`, `POST /educator/reject`).
