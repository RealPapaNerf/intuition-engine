// The systems pack (docs/decisions/2026-10-26-pull-it-apart.md): pull a
// system apart, break it, fix it. Honest ground truth is three laws and
// a solver (system.js, solve.js); a system is parts wired together with
// numbers that say what they are a model of; the kid's interventions are
// the bench; the questions are made from the system and answered by the
// run (questions.js); the Consultant answers and is sometimes wrong
// (consultant.js); and something can be secretly wrong (diagnose.js).
// Everything outcome-shaped is computed, never written down.
import { validateSystem } from './system.js';
import { LIBRARY_DATA } from './library/index.js';

export * from './system.js';
export { runSystem, reading, normalsOf } from './solve.js';
export { KINDS, SAME_WITHIN, kindsFor, ask, commit, truthOf, score, jobOf, partName } from './questions.js';
export { consult, WRONG_RATE, ANSWERS } from './consultant.js';
export { mysteries, pickMystery, mysteryBench, probe } from './diagnose.js';

// The built-in systems, checked and frozen: a bad one fails loudly, here.
export const LIBRARY = LIBRARY_DATA.map(validateSystem);
