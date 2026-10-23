// The negotiators pack (docs/intuitive-negotiators-brief.md): hidden
// briefs with point schedules as honest ground truth, a trust meter that
// moves by fixed rules, a scripted counterpart, the predict gate, and
// the lens — the question-only cue layer for a live conversation.
export * from './brief.js';
export * from './trust.js';
export * from './counterpart.js';
export * from './prep.js';
export * from './lens.js';
export { OFFER_LETTER } from './scenarios/offer-letter.js';
