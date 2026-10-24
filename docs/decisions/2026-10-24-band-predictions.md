# 2026-10-24 — Band predictions: the scale, the ladder, and measure mode

The 2026-10-22 build order (§8: placement → strain language and skins →
the import portal) is complete and merged to main. This file decides
what comes next, per the standing rule that the next step takes a new
decision file.

**Decided (by the owner, 2026-10-24): band predictions — measure mode —
is the next step.** The Consultant and the AI coach stay queued behind
it. Everything below is the design that binds the build.

## 1. What a band prediction is here

The brief's own example ("between 6 and 9 pennies") is a breaking load,
and that is the first measured quantity: **the heaviest cargo, in
grams, that crosses the kid's bridge and arrives dry.** It reuses the
crossing unchanged — outcome `holds` means carried; `snapped` and
`dunked` both mean not carried, because the goal is the goal (the cargo
gets across dry), never the method of failing.

The journal already speaks band (`kind: 'band'`, `prediction: {lo,
hi}`, `range`, a numeric `outcome`); nothing in `engine/journal.js`
changes. What was missing is the honest number the band is judged
against, and this file decides how it is produced.

## 2. The scale is part of the archetype

A level that can be measured carries a frozen `measure` block — the
instrument, with the same standing as the material:

```js
measure: { quantity: 'breaking-load', max: 0.5, resolution: 0.005 } // kg
```

- `max` is the top of the scale; `resolution` is the finest reading.
  Both are REVISIT: 0–500 g at 5 g was picked so a strong 30-ant bridge
  fits under the top and the bisection stays under ten runs; Stage 0
  data moves them, taste doesn't.
- The scale is frozen with the archetype, so every skin of a level
  measures on the same instrument and every kid's bands are judged
  against the same range. A different scale is a different level.
- `range` in the journal entry is the scale's span (`max`, in grams),
  so band-width ratios — the throwaway detector's food — mean the same
  thing on every entry from this level.

## 3. The ladder: how the number is measured

`engine/measure.js` finds the breaking load by **bisection over full
crossings of the kid's own bridge** — a fresh model per probe, the same
`runCrossing` the feel-mode verdict uses. No new physics, no formula on
the side: the measurement is a stack of real experiments.

- First probe at the top of the scale; then binary search on the
  resolution grid. At most `1 + ceil(log2(max/resolution + 1))` runs
  (eight, on the 0–500 g × 5 g scale).
- The measured value is the heaviest grid mass that carried the cargo
  across. If the top of the scale holds, the reading is the top and
  says so ("more than the scale goes") — like a real scale pinned at
  its stop. The journal records the clamped number; a band whose `hi`
  reaches the top scores a hit against it. REVISIT if kids learn to
  park `hi` at the stop; the fix is a taller scale, not a cleverer
  rule.
- If even the lightest reading fails — the bridge cannot carry the
  smallest grid mass, or itself — the reading is 0 and the entry's
  `buildFailed` is true.
- Bisection leans on quasi-static monotonicity: heavier is never
  easier. That is how the crossing already loads (the lever rule, only
  equilibria judged), and the hand-calc test pins the measured value to
  the V-bridge's analytic critical cargo `W = 2·T·sinθ`, within one
  resolution step.

## 4. The gate, unchanged in spirit

No ladder runs until the kid commits `lo` and `hi` (grams, on the
resolution grid, `0 ≤ lo ≤ hi ≤ max`). The seen-setup rule carries
over: a bridge measured once cannot be band-called again unchanged —
measure-mode setups are keyed apart from feel-mode ones (same bridge,
different question). One journal holds both kinds of entry;
calibration stays the one kid-visible prestige stat, and the width
detectors keep feeding the adult-only flags.

## 5. What the kid sees

Measure mode is a toggle next to Feel it, per the age ladder's "one
game, three depths" — in the demo it is the kid's choice; tying modes
to an educator profile is future work, not this step. During the
ladder the scale narrates each probe ("450 g — SNAP. 225 g — held…"),
because watching the interval shrink *is* the lesson in measurement.
Then the heaviest load that held walks the bridge on screen — the same
physics, now as theater — and the verdict reads the scale against the
band, in grams, units always on.

## 6. Out of scope for this step

The lab notebook (plots of attempts), ratio stats (strength per link),
band predictions of other quantities (sag depth is the natural second),
and the Consultant. Also untouched: the portal's license allowlist and
credit format still await their own ratifying decision file — noted
2026-10-22, still open.
