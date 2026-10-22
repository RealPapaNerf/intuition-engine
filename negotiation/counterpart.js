// The scripted counterpart: a character played by its hidden brief.
//
// docs/intuitive-negotiators-brief.md: "Scripted state machines first;
// later, an AI plays the character while the hidden brief and the trust
// rules stay authored." This is the state machine. It weighs offers with
// its own point schedule (brief.js), moves its trust by the fixed rules
// (trust.js), and gives information away by discoverable rules: a mirror
// draws out its position on the issue it just raised, a calibrated
// question draws out its next priority, trust past each threshold makes
// it volunteer more, and the correct label of its hidden worry gets the
// level's victory line, "that's right."
//
// Pure: `respond` returns a new state and never reads a clock, so the
// same moves in the same order always produce the same conversation
// (test/negotiation.test.js checks this). Nothing here is random.
//
// The manipulation guardrail (the brief's hard rule) lives here too: a
// pressure move — a deadline that isn't real — works exactly once, then
// poisons the meter for every later use and for the next session.

import { points, party, priorities, bestOption, violatesCap } from './brief.js';
import { RULES, margin, makeMeter, nudge } from './trust.js';

const issueOf = (brief, id) => brief.issues.find((i) => i.id === id);

function fill(template, brief, issueId, optionIndex) {
  const issue = issueId ? issueOf(brief, issueId) : null;
  return template
    .replace('{issue}', issue ? issue.name.toLowerCase() : '')
    .replace('{option}', issue && optionIndex != null ? issue.options[optionIndex] : '');
}

export function describeDeal(brief, deal) {
  return brief.issues.map((i) => `${i.name.toLowerCase()} ${i.options[deal[i.id]]}`).join(', ');
}

// What the user's move reads as in the transcript, when the UI gives no
// words of its own.
export function describeMove(brief, state, move) {
  switch (move.kind) {
    case 'mirror': {
      const last = [...state.transcript].reverse().find((t) => t.who === state.me)?.text ?? '';
      const words = last.replace(/[.?!:]+$/, '').split(/\s+/).slice(-4).join(' ');
      return `"${words}?"`;
    }
    case 'label':
      return `It sounds like ${brief.worries.find((w) => w.id === move.worry).text.replace(/^You/, 'you').replace(/^you're/i, "you're")}.`;
    case 'question':
      return move.text ?? brief.questions[0];
    case 'audit':
      return "You probably think I'm here to squeeze every dollar out of you before I've done a day's work.";
    case 'pitch':
      return 'Let me tell you what I would bring to this team.';
    case 'silence':
      return '(says nothing)';
    case 'offer':
      return `How about: ${describeDeal(brief, move.deal)}.`;
    case 'ultimatum':
      return `Final offer, take it or leave it: ${describeDeal(brief, move.deal)}.`;
    case 'pressure':
      return "I need an answer today. The other firm wants my decision by tonight.";
    case 'accept':
      return 'Deal.';
    case 'walk':
      return "I'm going to take the other offer.";
    default:
      throw new Error(`unknown move ${move.kind}`);
  }
}

export function makeCounterpart(brief, { memory = null } = {}) {
  const me = brief.counterpart;
  const burned = Boolean(memory?.burned);
  return {
    me,
    you: brief.user,
    meter: makeMeter(burned ? RULES.startBurned : RULES.start),
    turn: 0,
    revealed: [], // 'p1', 'p2', ... 'interest'
    mirrors: 0, // in a row
    auditDone: false,
    auditShield: false, // the first offer's distance costs nothing
    labeled: false, // "that's right" has happened
    pressured: false, // the one free pass, pending
    burned,
    topic: null, // the issue the counterpart last spoke about
    counter: null, // their deal on the table
    lastOffer: null, // the user's
    offers: 0,
    deal: null,
    done: null, // 'accepted' | 'closed' | 'walked'
    transcript: [{ who: me, text: burned ? brief.voice.openBurned : brief.voice.open }],
  };
}

// The season memory the next session starts from. Only the fact of a
// manipulation carries over; nothing about how the deal went.
export function remember(state) {
  return { burned: state.burned };
}

function nextPriority(brief, s) {
  const order = priorities(brief, s.me);
  for (let k = 0; k < order.length; k++) {
    if (!s.revealed.includes(`p${k + 1}`)) return { key: `p${k + 1}`, issue: order[k] };
  }
  return null;
}

// Step the deal toward what the counterpart wants until it clears
// `need`. At each step she asks on the issue with the most still to gain
// for her — what she values most and hasn't got — so a counter reads as
// a signal: the issue she moved is the issue that matters. Then, if a
// concession is owed, she gives back one step where it costs her least,
// never past a cap and never under her walk-away.
function buildCounter(brief, s, from, need, concede) {
  const me = s.me;
  const deal = { ...from };
  const capOf = (issue) => issue.cap?.[me];
  const inCap = (issue, idx) => {
    const cap = capOf(issue);
    if (cap == null) return true;
    return bestOption(issue, me) <= cap ? idx <= cap : idx >= cap;
  };
  for (const issue of brief.issues) {
    if (!inCap(issue, deal[issue.id])) deal[issue.id] = capOf(issue);
  }
  const step = (issue, dir) => (deal[issue.id] += dir);
  while (points(brief, me, deal) < need) {
    let pick = null;
    for (const issue of brief.issues) {
      const cur = deal[issue.id];
      const best = bestOption(issue, me);
      if (cur === best) continue;
      const left = issue.points[me][best] - issue.points[me][cur];
      if (left > 0 && (!pick || left > pick.left)) pick = { issue, dir: best > cur ? 1 : -1, left };
    }
    if (!pick) break;
    step(pick.issue, pick.dir);
  }
  if (concede) {
    const floor = party(brief, me).reservation;
    let pick = null;
    for (const issue of brief.issues) {
      const cur = deal[issue.id];
      const theirBest = bestOption(issue, s.you);
      if (cur === theirBest) continue;
      const dir = theirBest > cur ? 1 : -1;
      if (!inCap(issue, cur + dir)) continue;
      const cost = issue.points[me][cur] - issue.points[me][cur + dir];
      if (!pick || cost < pick.cost) pick = { issue, dir, cost };
    }
    if (pick && points(brief, me, deal) - pick.cost >= floor) step(pick.issue, pick.dir);
  }
  return deal;
}

function movedMost(brief, me, from, to) {
  let pick = null;
  for (const issue of brief.issues) {
    const gain = issue.points[me][to[issue.id]] - issue.points[me][from[issue.id]];
    if (gain > 0 && (!pick || gain > pick.gain)) pick = { id: issue.id, gain };
  }
  return pick?.id ?? null;
}

export function respond(brief, state, move) {
  if (state.done) throw new Error('the conversation is over');
  const v = brief.voice;
  const me = state.me;
  const s = {
    ...state,
    turn: state.turn + 1,
    revealed: [...state.revealed],
    transcript: [...state.transcript, { who: state.you, text: move.text ?? describeMove(brief, state, move), move: move.kind }],
  };
  s.mirrors = move.kind === 'mirror' ? s.mirrors + 1 : 0;
  const lines = [];
  let reaction = 'talk';
  let delta = 0;
  const bump = (d, why) => {
    if (d === 0) return;
    delta += d;
    s.meter = nudge(s.meter, d, why, s.turn);
  };
  const reveal = (p) => {
    s.revealed.push(p.key);
    s.topic = p.issue;
  };
  const putCounter = (from, need, concede) => {
    s.counter = buildCounter(brief, s, from, need, concede);
    s.topic = movedMost(brief, me, from, s.counter) ?? s.topic;
    lines.push(describeDeal(brief, s.counter) + '.');
  };

  switch (move.kind) {
    case 'mirror': {
      if (s.mirrors >= RULES.mirrorRepeatAt) {
        bump(RULES.mirrorRepeat, 'mirror-repeat');
        lines.push(v.mirrorRepeat);
        reaction = 'annoyed';
        break;
      }
      bump(RULES.mirror, 'mirror');
      const p = nextPriority(brief, s);
      if (s.topic) {
        lines.push(fill(v.mirror, brief, s.topic, bestOption(issueOf(brief, s.topic), me)));
      } else if (p && s.meter.trust >= RULES.fillSilenceAt) {
        reveal(p);
        lines.push(fill(v.mirrorFill, brief, p.issue));
      } else {
        lines.push(v.mirrorNothing);
      }
      break;
    }
    case 'label': {
      const worry = brief.worries.find((w) => w.id === move.worry);
      if (!worry) throw new Error(`unknown worry ${move.worry}`);
      if (worry.right) {
        if (!s.labeled) {
          bump(RULES.labelRight, 'label-right');
          s.labeled = true;
          s.revealed.push('interest');
        }
        lines.push(v.thatsRight);
        reaction = 'right';
      } else {
        bump(RULES.labelWrong, 'label-wrong');
        lines.push(v.notQuite);
        reaction = 'wrong';
      }
      break;
    }
    case 'question': {
      bump(RULES.question, 'question');
      const p = nextPriority(brief, s);
      if (p) {
        reveal(p);
        lines.push(fill(v.question, brief, p.issue));
      } else {
        lines.push(v.questionDone);
        reaction = 'done';
      }
      break;
    }
    case 'audit': {
      if (!s.auditDone) {
        bump(RULES.audit, 'audit');
        s.auditDone = true;
        s.auditShield = true;
        lines.push(v.audit);
      } else {
        lines.push(v.auditAgain);
        reaction = 'again';
      }
      break;
    }
    case 'pitch': {
      bump(RULES.pitch, 'pitch');
      lines.push(v.pitch);
      break;
    }
    case 'silence': {
      const p = nextPriority(brief, s);
      if (p && s.meter.trust >= RULES.fillSilenceAt) {
        reveal(p);
        lines.push(fill(v.silenceFill, brief, p.issue));
      } else {
        lines.push(v.silenceEmpty);
        reaction = 'quiet';
      }
      break;
    }
    case 'pressure': {
      if (!s.burned) {
        bump(RULES.pressureOnce, 'pressure-once');
        s.burned = true;
        s.pressured = true;
        lines.push(v.pressureOnce);
        reaction = 'once';
        if (s.lastOffer) {
          s.pressured = false;
          putCounter(s.lastOffer, party(brief, me).reservation, true);
        }
      } else {
        bump(RULES.pressureBurned, 'pressure-burned');
        lines.push(v.pressureBurned);
        reaction = 'burned';
        if (s.counter) lines.push(describeDeal(brief, s.counter) + '.');
      }
      break;
    }
    case 'offer':
    case 'ultimatum': {
      const deal = move.deal;
      const ultimatum = move.kind === 'ultimatum';
      s.offers++;
      s.lastOffer = deal;
      const mine = points(brief, me, deal);
      const res = party(brief, me).reservation;
      const capped = violatesCap(brief, me, deal);
      const shield = s.auditShield;
      s.auditShield = false;
      if (capped) {
        lines.push(v.cap);
        reaction = 'cap';
        if (ultimatum) bump(RULES.ultimatum, 'ultimatum');
        putCounter(deal, res + (ultimatum || s.pressured ? 0 : margin(s.meter.trust)), s.pressured);
        s.pressured = false;
        break;
      }
      const need = res + (ultimatum || s.pressured ? 0 : margin(s.meter.trust));
      if (mine >= need) {
        if (ultimatum) bump(RULES.ultimatumAccept, 'ultimatum-accepted');
        lines.push(ultimatum ? v.ultimatumAccept : v.accept);
        reaction = 'accept';
        s.deal = deal;
        s.counter = null;
        s.done = 'accepted';
        s.pressured = false;
        break;
      }
      if (ultimatum) {
        // Judged on the goodwill she had before it was said.
        const goodwill = s.meter.trust;
        bump(RULES.ultimatum, 'ultimatum');
        if (goodwill < RULES.ultimatumWalkBelow) {
          lines.push(v.ultimatumWalk);
          reaction = 'walk';
          s.done = 'walked';
          break;
        }
        lines.push(v.ultimatumStay);
        reaction = 'stay';
        putCounter(deal, res, false);
        break;
      }
      const insult = mine < res - RULES.insultGap;
      if (insult && !shield) {
        bump(RULES.insult, 'insult');
        lines.push(v.insult);
        reaction = 'insult';
      } else {
        lines.push(v.counter);
        reaction = 'counter';
      }
      putCounter(deal, need, s.pressured);
      s.pressured = false;
      break;
    }
    case 'accept': {
      if (!s.counter) throw new Error('nothing on the table to accept');
      s.deal = s.counter;
      s.done = 'closed';
      lines.push(v.closed);
      reaction = 'closed';
      break;
    }
    case 'walk': {
      s.done = 'walked';
      lines.push(v.youWalk);
      reaction = 'walk';
      break;
    }
    default:
      throw new Error(`unknown move ${move.kind}`);
  }

  if (!s.done && s.meter.trust <= RULES.walkAt) {
    lines.push(v.walk);
    reaction = 'walk';
    s.done = 'walked';
  }

  // Trust past a threshold: they volunteer. Priorities first, then the
  // interest itself, unless the user already named it.
  if (!s.done) {
    const order = priorities(brief, me);
    const ladder = [
      { at: RULES.reveal[0], key: 'p1', say: () => fill(v.revealPriority, brief, order[0]) },
      { at: RULES.reveal[1], key: 'p2', say: () => fill(v.revealPriority, brief, order[1]) },
      { at: RULES.reveal[2], key: 'interest', say: () => v.revealInterest },
    ];
    for (const rung of ladder) {
      if (s.meter.trust >= rung.at && !s.revealed.includes(rung.key)) {
        s.revealed.push(rung.key);
        lines.push(rung.say());
      }
    }
  }

  const text = lines.join(' ');
  s.transcript.push({ who: me, text, reaction });
  return { state: s, reply: { text, reaction, delta } };
}

// The reaction a user's offer got, in the three words the predict gate
// uses.
export function reactionClass(reaction) {
  if (reaction === 'accept') return 'accept';
  if (reaction === 'walk') return 'walk';
  return 'counter';
}
