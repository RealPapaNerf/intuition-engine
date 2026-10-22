// The trust meter: fixed, discoverable rules, and the replay's turning point.
//
// docs/intuitive-negotiators-brief.md: "a trust meter that moves by
// fixed, discoverable rules (interrupting drops it; labeling a feeling
// correctly raises it; a correct label of their hidden worry raises it a
// lot)." The rules are numbers here, frozen, and the counterpart
// (counterpart.js) may move the meter only through them. Nothing in this
// file reads a clock: the meter is a pure function of the moves made,
// in the order they were made (the feed line, decisions 2026-10-19 §6).
//
// Every number marked REVISIT is a placeholder awaiting kitchen-table
// data. Change them with observed play, and say so in the commit.

import { deepFreeze } from '../engine/freeze.js';

export const RULES = deepFreeze({
  start: 0, //                                                   REVISIT
  startBurned: -2, // next session after a manipulation            REVISIT
  walkAt: -3, // at or below this, they leave                     REVISIT
  mirror: 1, // a mirror opens them up (unit 2)                   REVISIT
  mirrorRepeatAt: 3, // the Nth mirror in a row annoys instead     REVISIT
  mirrorRepeat: -1, //                                            REVISIT
  labelRight: 3, // naming the hidden worry: "that's right"       REVISIT
  labelWrong: 0, // a wrong label costs little (Voss)             REVISIT
  question: 1, // a calibrated how/what question                  REVISIT
  audit: 2, // the accusation audit, first time only              REVISIT
  pitch: -1, // talking about yourself closes them (unit 2)       REVISIT
  insult: -1, // an offer far below their walk-away                REVISIT
  insultGap: 20, // ...this many points below it                   REVISIT
  ultimatum: -2, // "take it or leave it" they can't take          REVISIT
  ultimatumWalkBelow: 3, // ...and at trust under this, they go    REVISIT
  ultimatumAccept: -1, // one they can take, grudgingly            REVISIT
  pressureOnce: -1, // a fake deadline works once...               REVISIT
  pressureBurned: -3, // ...then poisons every later use           REVISIT
  marginAtZero: 10, // points above walk-away they want at trust 0 REVISIT
  marginPerTrust: 2, // each point of trust buys this much margin  REVISIT
  fillSilenceAt: 2, // trust needed before silence draws them out  REVISIT
  reveal: [3, 5, 7], // trust at which they volunteer: priority 1, priority 2, the interest  REVISIT
});

// How many points over their reservation the counterpart wants before
// saying yes. Trust buys flexibility; that is the discoverable rule.
export function margin(trust) {
  return Math.max(0, RULES.marginAtZero - RULES.marginPerTrust * trust);
}

export function makeMeter(start = RULES.start) {
  return { trust: start, trace: [{ turn: 0, trust: start, delta: 0, why: 'start' }] };
}

// Returns a new meter; meters are never mutated so a replay can hold any
// earlier state.
export function nudge(meter, delta, why, turn) {
  const trust = meter.trust + delta;
  return { trust, trace: [...meter.trace, { turn, trust, delta, why }] };
}

// The replay's "line where it turned" (the brief's social slow-motion
// break): the single largest move of the meter, with ties going to the
// earliest. For a conversation that ended below where it began, the
// largest drop; otherwise the largest rise.
export function turningPoint(meter) {
  const t = meter.trace;
  if (t.length < 2) return null;
  const fell = t[t.length - 1].trust < t[0].trust;
  let best = null;
  for (let i = 1; i < t.length; i++) {
    const d = fell ? -t[i].delta : t[i].delta;
    if (d > 0 && (best === null || d > (fell ? -t[best].delta : t[best].delta))) best = i;
  }
  return best === null ? null : t[best];
}
