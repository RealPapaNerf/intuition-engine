// The lens: what the coach is allowed to put in front of your eyes
// mid-conversation.
//
// Decisions 2026-10-22 (the lens). The glasses' model is an assistant
// that answers while you talk. Ours inverts it: in the lens the coach
// only asks (invariant 5), and the only answers pinned there are your
// own — the predictions you committed before the conversation began.
// This module therefore takes no brief, ever: it sees the public
// transcript (which move you made, how they reacted) and your own prep
// notes, and nothing else, so it cannot leak the other side's hidden
// state even by accident. test/lens.test.js checks the import list.

const CUES = {
  open: [
    'Before you say anything: what do you think they are afraid of?',
    'What would they need to hear from you before they can move?',
  ],
  'mirror:talk': ['What did they add that you did not have before?'],
  'mirror:annoyed': ['What did you want them to tell you, and is there a question that asks for it?'],
  'label:right': ['What can you ask now that you could not ask a minute ago?'],
  'label:wrong': ['What did they just rule out, and what is left?'],
  'question:talk': ['Which issue did they name first, and why that one?'],
  'question:done': ['They have told you what matters. What would an offer built around it look like?'],
  'audit:talk': ['Now that it is said out loud, what is the worst thing your first offer can do?'],
  'audit:again': ['Who is that reassurance for?'],
  'pitch:talk': ['Who did that last line help, you or them?'],
  'silence:talk': ['What did the silence get you that a question would not have?'],
  'silence:quiet': ['Why do you think they let the silence sit?'],
  'offer:accept': ['Would they have taken less? How would you know?'],
  'offer:counter': ['Which issue did they move on, and which did they refuse to touch? What does that tell you about what matters to them?'],
  'offer:insult': ['What did that offer tell them about how you see them?'],
  'offer:cap': ['Is that a wall or a position? How would you tell the difference?'],
  'ultimatum:accept': ['You got the deal. What did it cost you for the next one?'],
  'ultimatum:stay': ['What do you do if they had walked?'],
  'ultimatum:walk': ['Where was the last moment this could have gone another way?'],
  'pressure:once': ['If they find out that deadline is not real, what happens to the next deal?'],
  'pressure:burned': ['What are they protecting themselves from now?'],
  walked: ['Where was the last moment this could have gone another way?'],
  closed: ['Which of your predictions were you most sure of, and which did reality move?'],
  beforeOffer: ['How will they react to this, and what would make you change that call?'],
};

// The cue for a moment in the conversation. `moment` names the move and
// how they reacted — public facts only. Rotates through the variants by
// turn so a long session is not one sentence over and over.
export function cue(moment, turn = 0) {
  const key = moment.reaction ? `${moment.move}:${moment.reaction}` : moment.move;
  const list = CUES[key] ?? CUES.open;
  return list[turn % list.length];
}

export const ALL_CUES = Object.values(CUES).flat();

// The prep notes pinned in the lens: the user's own commitments, in the
// user's own words, with the display names the user already has in
// front of them (their own brief). The glasses call this Prep Notes; the
// difference is that here they are predictions, scored at the reveal.
export function pinnedNotes(prep, names) {
  if (!prep) return [];
  return [
    `They care most about: ${names.issue(prep.ranking[0])}`,
    `Then: ${prep.ranking.slice(1).map(names.issue).join(', ')}`,
    `Their wall on ${names.issue(prep.headline)}: ${names.value(prep.walkAway.lo)}–${names.value(prep.walkAway.hi)}`,
    `Their worry: ${names.worry(prep.worry)}`,
  ];
}
