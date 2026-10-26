// The debrief (decisions 2026-10-25, the debrief): when the exercise is
// done and before the kid moves on, the coach asks about the kid's own
// attempts. Three kinds, three questions:
//
//   resolved   it broke, then it held — what was different?
//   failed     §7's core question, unchanged: what were you trying to
//              find out with that build?
//   throwaway  the same question, because that is what separates the
//              rational experimenter from the disengaged kid
//
// Two rules the words here must keep. The coach never classifies the
// kid — these ask about attempts, never about the person. And the
// debrief must work with no coach at all: these canned questions are
// ours, free and local, so a keyless kitchen table still gets the
// question that matters. The live coach's version is better, because it
// can name what actually changed between two attempts.
//
// "I don't know" is always an option and costs nothing: §5 only works
// as a signal if saying so is free.

export const DEBRIEF_QUESTIONS = Object.freeze({
  resolved: 'It broke before, and this time it held. What was different about this one?',
  failed: 'What were you trying to find out with that build?',
  throwaway: 'What were you trying to find out with that build?',
});

const WHAT_CHANGED = [
  { icon: '🐜', label: 'more of them', said: 'I used more ants.' },
  { icon: '📐', label: 'a new shape', said: 'I built it a different shape.' },
  { icon: '🪵', label: 'something new to hold', said: 'I had something new to hold onto.' },
  { icon: '🤏', label: 'a lighter one', said: 'The one crossing was lighter.' },
  { icon: '🤷', label: 'not sure', said: "I don't know what was different." },
];

const WHAT_FOR = [
  { icon: '🎯', label: 'if it holds', said: 'I wanted to find out if it would hold.' },
  { icon: '🪶', label: 'how heavy', said: 'I wanted to find out how heavy it could go.' },
  { icon: '📐', label: 'if shape helps', said: 'I wanted to find out if the shape helps.' },
  { icon: '🧪', label: 'just trying it', said: 'I was just trying something out.' },
  { icon: '🤷', label: 'not sure', said: "I don't know what I was trying to find out." },
];

export function debriefQuestion(kind) {
  return DEBRIEF_QUESTIONS[kind] ?? null;
}

export function debriefChoices(kind) {
  return kind === 'resolved' ? WHAT_CHANGED : WHAT_FOR;
}

// What the coach is told about the kid's own attempts on this problem:
// what they said, what happened, how many links, how hard the hardest
// one worked. Every one of these the kid watched happen — and nothing
// adult travels with it (the whitelist is enforced again server-side).
export function attemptsFor(entries, level, n = 4) {
  return entries
    .filter((e) => e.level === level)
    .slice(-n)
    .map((e) => ({
      said: e.kind === 'band' ? `${e.prediction.lo}-${e.prediction.hi} g` : String(e.prediction ?? ''),
      happened: e.kind === 'band' ? `${e.outcome} g` : String(e.outcome ?? ''),
      links: Number.isInteger(e.ants) ? e.ants : null,
      hardestPct: Number.isFinite(e.hardestPct) ? e.hardestPct : null,
    }));
}

// What the adult reads later, and what the kid said in their own words.
export function debriefRecord(kind, said) {
  return { kind, said: said === null ? null : String(said).slice(0, 200) };
}
