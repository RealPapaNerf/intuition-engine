// The Consultant's side of the glass (decisions 2026-10-25 §4, the
// brief's "training kids to use AI without trusting it"; §7.2 of the
// handoff). The engine computes the honest truth and then, about one
// time in five, a curated wrongness — engine/consultant.js. This file
// is only the words and the choices.
//
// Two commitments, kept apart on purpose (2026-10-19 §4): the kid's own
// prediction, and their call on the advice. Trust it, doubt it, or
// verify it — "I can't judge this one, run it", which the journal
// counts as a valid call of one's own limit rather than a failure.
//
// The postmortem asks what KIND of wrong it was, because the taxonomy
// is the lesson: every planted error is catchable by reasoning against
// reality — a number ten times too big, a unit slipped, a load claimed
// for a bridge that isn't there, an answer to a different question —
// and never by tone. The options offered are the ones that mode can
// actually produce, so the kid is choosing between real possibilities.

// The claim, in the kid's own costume words.
export function claimWords(advice, { cargoName = 'the cargo' } = {}) {
  if (!advice) return '';
  if (advice.quantity === 'breaking-load') {
    return advice.claim > 0
      ? `🤖 The Consultant says: “That bridge carries about ${advice.claim} g.”`
      : `🤖 The Consultant says: “That bridge carries nothing at all.”`;
  }
  return advice.claim === 'holds'
    ? `🤖 The Consultant says: “It will hold ${cargoName}.”`
    : `🤖 The Consultant says: “It will break under ${cargoName}.”`;
}

// What kind of wrong, by the mode that can produce it. `none` is the
// honest option that it was right — a kid who picks it when it was
// wrong simply didn't catch it.
const MEASURE_KINDS = [
  { id: 'magnitude', label: 'Ten times too big' },
  { id: 'unit-slip', label: 'Ten times too small' },
  { id: 'limiting-case', label: 'A number for a bridge that carries nothing' },
];
const FEEL_KINDS = [
  { id: 'answered-different-question', label: 'It answered about a different one' },
  { id: 'confident-nonsense', label: 'Confident, and just wrong' },
];

export function wrongKinds(mode) {
  return [...(mode === 'measure' ? MEASURE_KINDS : FEEL_KINDS), { id: 'none', label: 'It was right' }];
}

// Did the kid name the error? The engine's own error type is the
// answer; anything else — including "it was right" about a wrong claim
// — is a miss. Returns the journal's `caught` value.
export function caughtBy(advice, pick, call) {
  if (!advice?.wrong) return null; // nothing was planted to catch
  if (call === 'doubted') return 'before'; // caught before the test ran
  return pick === advice.errorType ? 'postmortem' : 'never';
}

export function postmortemWords(advice, pick) {
  if (!advice) return '';
  if (!advice.wrong) {
    return '🤖 That one was true — the Consultant is right about four times in five.';
  }
  const truth =
    advice.quantity === 'breaking-load'
      ? `it really carries ${advice.truth} g`
      : `it really ${advice.truth === 'holds' ? 'holds' : 'breaks'}`;
  if (pick === advice.errorType) {
    return `✅ Caught it — ${truth}, and that is exactly the kind of wrong it was.`;
  }
  if (pick === 'none') {
    return `❌ It was wrong: ${truth}. Checking it against what you saw is the whole trick.`;
  }
  return `❌ Close — it was wrong, and ${truth}, but that is not the kind of wrong it was.`;
}

// The line that reports the kid's own call back to them, after the fact.
export function callWords(advice, call) {
  if (!advice || !call) return '';
  if (call === 'deferred') return 'You said you couldn’t judge it, and ran it. That is a real answer.';
  const right = (call === 'trusted') !== advice.wrong;
  if (call === 'trusted') {
    return right ? '👍 You trusted it, and it was right.' : '👍 You trusted it — and it was wrong.';
  }
  return right ? '🤨 You doubted it, and it was wrong. Good catch.' : '🤨 You doubted it, but it was right.';
}
