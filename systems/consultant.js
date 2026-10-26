// The Consultant, for systems: the AI that answers, and is deliberately,
// curatedly fallible (invariant 5; decisions 2026-10-19 §2). Never a
// live model. It runs the system honestly first — the truth is the
// solver's — then a seeded draw makes it wrong about 1 time in 5, in a
// way a kid can catch by reasoning against the system in front of them,
// never by tone. Same seed, same advice: no reroll-fishing.
//
// It answers three of the questions (questions.js): will it still work,
// which way a gauge goes, and how much. The systems taxonomy — each one
// a check a mechanic, a doctor or an engineer actually runs:
//
//   ignored-spare      "it fails" or "it changes" — when another part
//                      does the same job (the other kidney, a second pump)
//   buffer-forever     "it keeps going" — when it fails late, waiting on
//                      a store to empty or fill: it does keep going, for
//                      a while, and then it doesn't (the battery, the
//                      waste in the blood, the heat in an engine)
//   wrong-direction    "more" when it is less, "less" when it is more
//   no-effect          "about the same" — about a gauge the change is
//                      wired straight into
//   no-way-out         a stock "settles where it always does" when
//                      nothing takes it out any more; with an inflow and
//                      no outflow a stock can only climb (the correlation
//                      heuristic: assuming a stock follows its flow)
//   limiting-case      a confident amount from something that can make
//                      none — a virus with no door makes no copies
//   magnitude          ten times the truth
//   unit-slip          a tenth of it
//   confident-nonsense the opposite verdict, said with confidence
//
// It returns the claim, the error type and the truth (for the
// postmortem); the kid's trust / doubt / run-it call is the journal's
// separate `consultant` commitment (2026-10-19 §4).

import { runSystem } from './solve.js';
import { isPresent, partState, instances, instanceOf } from './system.js';
import { truthOf } from './questions.js';
import { makeRng } from './seed.js';

export const WRONG_RATE = 0.2; // right about 4 times in 5   REVISIT (with the engine's)

// The question kinds it answers.
export const ANSWERS = Object.freeze(['works', 'direction', 'reading']);

// The same job: a flow of the same law between the same places.
const jobKey = (f) => (f.law === 'react' ? `react:${Object.keys(f.inputs).sort()}>${Object.keys(f.outputs).sort()}` : `${f.law}:${f.from}>${f.to}`);

// Parts the kid took out, swapped or blocked that another working part
// still does the job of: the spare a hurried answer forgets.
function sparesCovering(system, bench) {
  const working = (id) => isPresent(system, bench, id) && partState(system, bench, id).as === 'ok' && !partState(system, bench, id).broken;
  const blocked = new Set(bench?.blocked ?? []);
  const covered = [];
  for (const id of instances(system, bench)) {
    const { part, copy } = instanceOf(system, id);
    const s = partState(system, bench, id);
    const changed = s.as === 'bad' || (s.as === 'out' && part.installed && copy === null) || part.flows.some((f) => blocked.has(f.id));
    if (!changed || !part.flows.length) continue;
    const jobs = new Set(part.flows.map(jobKey));
    const others = instances(system, bench).filter((o) => o !== id && working(o));
    if (others.some((o) => instanceOf(system, o).part.flows.some((f) => jobs.has(jobKey(f)) && !blocked.has(f.id)))) covered.push(id);
  }
  return covered;
}

// Does anything that could run still take stuff out of this node? Read
// from the parts on the bench, the way a kid reads the diagram.
function hasWayOut(system, bench, nodeId) {
  const blocked = new Set(bench?.blocked ?? []);
  for (const id of instances(system, bench)) {
    if (!isPresent(system, bench, id) || partState(system, bench, id).broken) continue;
    const { part, copy } = instanceOf(system, id);
    for (const f of part.flows) {
      if (blocked.has(copy === null ? f.id : `${f.id}#${copy}`)) continue;
      const out = f.law === 'react' ? Object.hasOwn(f.inputs, nodeId) : f.from === nodeId;
      if (!out) continue;
      if (f.needs.some((n) => n.part !== undefined && !instances(system, bench).some((o) => instanceOf(system, o).part.id === n.part && isPresent(system, bench, o) && !partState(system, bench, o).broken))) continue;
      return true;
    }
  }
  return false;
}

const onGrid = (v, q) => Number((Math.round(Math.min(Math.max(v, 0), q.max) / q.resolution) * q.resolution).toFixed(9));

// The Consultant's advice for one question, or null for a kind it does
// not answer.
//   system, bench  the system and what the kid has done to it
//   question       from questions.js ask()
//   seed           the round's key — same seed, same advice, always
//   result, healthy the runs, if the caller already has them
export function consult({ system, bench = {}, question, seed, result = null, healthy = null }) {
  if (!ANSWERS.includes(question.type)) return null;
  const run = result ?? runSystem(system, bench);
  const ships = healthy ?? runSystem(system, {});
  const truth = truthOf(system, question, run, ships, bench);
  const rng = makeRng(String(seed));
  const wrong = rng() < WRONG_RATE;
  const advice = (claim, errorType = null, extra = {}) => ({ type: question.type, claim, wrong: errorType !== null, errorType, truth: truth.value, ...extra });
  if (!wrong) return advice(truth.value);

  if (question.type === 'works') {
    if (truth.value === 'works') {
      const spares = sparesCovering(system, bench);
      return spares.length ? advice('fails', 'ignored-spare', { about: spares[0] }) : advice('fails', 'confident-nonsense');
    }
    // A failure that comes late — past the first twentieth of the run —
    // waited on a store emptying or filling: the delay a hurried answer
    // mistakes for "fine".
    const check = run.failure ? system.goal.checks[run.failure.check] : null;
    const late = run.failedAt !== null && run.failedAt > 0.05 * system.time.run && check && check.when !== 'end';
    return advice('works', late ? 'buffer-forever' : 'confident-nonsense');
  }

  if (question.type === 'direction') {
    if (truth.value === 'same') {
      const spares = sparesCovering(system, bench);
      const claim = rng() < 0.5 ? 'up' : 'down';
      return spares.length ? advice(claim, 'ignored-spare', { about: spares[0] }) : advice(claim, 'confident-nonsense');
    }
    const flipped = truth.value === 'up' ? 'down' : 'up';
    return rng() < 0.5 ? advice(flipped, 'wrong-direction') : advice('same', 'no-effect');
  }

  // A reading.
  const value = truth.value;
  const ok = ships.reading?.value ?? 0;
  if (value === 0) return advice(ok > 0 ? ok : onGrid(question.max / 2, question), 'limiting-case');
  const candidates = [];
  if (!truth.maxed && value * 10 <= question.max) candidates.push([onGrid(value * 10, question), 'magnitude']);
  const slipped = onGrid(value / 10, question);
  if (slipped > 0 && slipped !== value) candidates.push([slipped, 'unit-slip']);
  const read = question.about;
  if (read?.node !== undefined && read.stat !== 'min' && ok !== value && !hasWayOut(system, bench, read.node) && hasWayOut(system, {}, read.node)) {
    candidates.push([ok, 'no-way-out']);
  }
  const usable = candidates.filter(([claim]) => claim !== value);
  if (!usable.length) {
    // Nowhere honest to slip to: a step off is still wrong, and still checkable.
    const claim = value + question.resolution <= question.max ? onGrid(value + question.resolution, question) : onGrid(value - question.resolution, question);
    return advice(claim, 'magnitude');
  }
  const [claim, errorType] = usable[Math.floor(rng() * usable.length)];
  return advice(claim, errorType);
}
