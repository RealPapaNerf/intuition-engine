// The Offer Letter: the first authored hidden brief, adult depth.
//
// Original content, in the shape MBA negotiation simulations use: two
// confidential role sheets, five issues, a point schedule per side, a
// reservation value, and one side's budget cap on the headline issue.
// The user plays the candidate; the counterpart (scripted,
// counterpart.js) plays the hiring manager. The manager's hidden
// interest — the deadline behind the start-date position — is the
// "that's right" the level is built around. The schedule has the three
// classic shapes: a distributive issue (salary), a logroll (the manager
// cares about start date, the candidate about remote days), and a
// compatible issue (both sides want the senior title; a negotiator who
// assumes every issue is a fight will trade it away for nothing).

import { validateBrief } from '../brief.js';

export const OFFER_LETTER = validateBrief({
  id: 'offer-letter',
  title: 'The Offer Letter',
  user: 'candidate',
  counterpart: 'manager',
  headline: 'salary',
  parties: [
    {
      id: 'candidate',
      name: 'You (the candidate)',
      reservation: 55,
      brief: [
        'You have an offer in hand from another firm. It pays $100k, starts in ten weeks, and is fully in the office. It is fine. This one is the job you want.',
        'What you actually need: two or more days a week working from home (a long commute and a kid in daycare), and a real salary step. A later start would let you take the break you have not had in three years. The senior title would matter in two years, when you look again.',
        'Your points below are your own priorities, stated honestly. You walk away under 55: the other offer is worth about that to you.',
      ],
    },
    {
      id: 'manager',
      name: 'Priya (the hiring manager)',
      reservation: 50,
      position: 'We need you to start in two weeks, at $95k, in the office.',
      interest: 'A product launch is six weeks out and the team is two people short. If the role is not filled by quarter end, finance closes the headcount and it does not come back.',
      fear: 'Losing the headcount.',
      brief: [
        'Priya runs a product team with a launch six weeks out and two empty seats. Finance has told her that any requisition still open at quarter end is closed for good.',
        'Her budget band for the role tops out at $110k; she cannot approve a dollar more without a re-grade she will not get in time. Salary is painful but the start date is what keeps her up at night. Remote days bother her a little (optics with her own boss), the signing bonus comes from a one-time pool she barely cares about, and the senior title actually helps her: it justifies keeping the headcount in the senior band.',
      ],
    },
  ],
  issues: [
    {
      id: 'salary',
      name: 'Salary',
      options: ['$95k', '$100k', '$105k', '$110k', '$115k'],
      values: [95, 100, 105, 110, 115],
      points: { candidate: [0, 10, 20, 30, 40], manager: [40, 30, 20, 10, 0] },
      cap: { manager: 3 },
    },
    {
      id: 'start',
      name: 'Start date',
      options: ['in 2 weeks', 'in 4 weeks', 'in 8 weeks', 'in 12 weeks'],
      points: { candidate: [0, 10, 20, 25], manager: [45, 30, 10, 0] },
    },
    {
      id: 'remote',
      name: 'Remote days',
      options: ['none', '1 day a week', '2 days a week', '3 days a week'],
      points: { candidate: [0, 15, 30, 45], manager: [15, 12, 8, 0] },
    },
    {
      id: 'bonus',
      name: 'Signing bonus',
      options: ['none', '$5k', '$10k', '$15k'],
      points: { candidate: [0, 8, 14, 20], manager: [10, 7, 4, 0] },
    },
    {
      id: 'title',
      name: 'Title',
      options: ['Analyst', 'Senior Analyst'],
      points: { candidate: [0, 15], manager: [0, 12] },
    },
  ],
  // What the user may label as the manager's real worry. One is right.
  worries: [
    { id: 'money', text: "You're worried I'll walk if the salary isn't high enough" },
    { id: 'deadline', text: 'You need this seat filled before something closes the window on it', right: true },
    { id: 'seniority', text: "You don't think I'm senior enough for the title" },
    { id: 'office', text: 'You need people in the office to be sure the work gets done' },
  ],
  // What the user may ask. Calibrated questions: how and what, never why.
  questions: [
    'What about this role is hardest to fill right now?',
    'How does the timing look from your side?',
    'What would make this an easy yes for you?',
  ],
  // The manager's lines. {issue} and {option} are filled from the brief
  // by the counterpart; nothing else is ever substituted.
  voice: {
    open: "Thanks for coming in. I'll be straight with you: we'd like you to start in two weeks, the offer is $95k, and the team works from the office. What are you thinking?",
    openBurned: "Let's keep this short. You know where we landed last time, and I remember how we got there.",
    mirror: 'Right. On {issue}, {option} is really where I need to land.',
    mirrorFill: "I suppose what I keep coming back to is {issue}. That's the piece I can't be loose on.",
    mirrorNothing: "...Yes. That's what I said.",
    mirrorRepeat: 'Are you just repeating me?',
    thatsRight: "That's right. That's exactly it. If this seat is still open at quarter end, finance closes it, and I'm down a person for good.",
    notQuite: "No, that's not really it.",
    question: "Honestly? It's {issue}. That's what I'm up against.",
    questionDone: "I've told you what matters to me. Make me an offer.",
    audit: "...I appreciate you saying that. I'm not trying to squeeze you, I'm trying to fill a seat.",
    auditAgain: "You've said that. Let's talk about the offer.",
    pitch: "Mm-hm. I've read your resume. What do you need from this?",
    silenceFill: "...Look, {issue} is the real problem for me. If we can solve that, I have room elsewhere.",
    silenceEmpty: '...',
    accept: "I can do that. Let's write it up.",
    counter: "I can't take that back to finance as it is. Here's what I can do:",
    insult: "That's a long way from anything I could sign. Here's where I can get to:",
    cap: "I can't go above $110k. That's not me, that's the band. On the rest:",
    ultimatumAccept: "...Fine. I'll take it. I don't love how we got here.",
    ultimatumStay: "I don't respond well to that. I'm going to pretend you didn't say it, and this is my answer:",
    ultimatumWalk: "Then I think we're done. Good luck with the other offer.",
    pressureOnce: "A deadline. Okay. If that's real, I can stretch a little. This is as far as I can go:",
    pressureBurned: "You said that last time, too. I'm not going to move on a deadline I don't believe in:",
    walk: "I don't think this is going to work. Thank you for your time.",
    closed: 'Then we have a deal. Welcome aboard.',
    youWalk: 'I understand. Good luck with the other offer.',
    revealPriority: "I should say: {issue} matters to me more than you might think.",
    revealInterest: "I'll just tell you. There's a launch in six weeks, and if this seat isn't filled by quarter end finance closes it.",
  },
});
