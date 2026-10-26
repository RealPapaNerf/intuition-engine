// The questions a change can be asked (decisions 2026-10-26 §4).
//
// The ask, from the owner: kids making connections — what happens when x
// comes out, when there are two of x, when y goes where x was, when x is
// blocked — with prediction questions "as infinite as the subjects
// covered." So no question is written in a system file. They are made
// from it — its parts, stores and flows, and what the kid just did — and
// every one is made from the system and the bench alone, before the run,
// so nothing in a question can give its answer away. Every answer is
// read off the run afterwards, by the solver; none is written down.
//
// The kinds, and what each leans on (the decision file cites the work):
//   works      Will it still do its job? — the function of the whole
//   direction  More, less, or about the same? — the sign of a change:
//              where reasoning about a system starts, and where the
//              stock-and-flow mistake lives (a stock does not follow the
//              shape of its flow)
//   first      Which part stops first? — the domino: an effect that
//              becomes a cause, the ripple young reasoners miss
//   keeps      Will that other part keep working? — a connection one
//              step away, or a spare doing the same job
//   job        What do you think this part does? — its function,
//              predicted before the run, shown by it (structure →
//              behavior → function)
//   reading    How much? — a band on the system's own instrument
//   when       When does it stop doing its job? — delays and buffers
// Feel depth asks the first five, measure depth the last two. Within a
// depth the kind rotates round by round: mixing kinds of problem beats
// practising one kind at a time (interleaving).

import { changes, instanceOf, instances, isPresent } from './system.js';
import { makeRng, shuffled } from './seed.js';

export const KINDS = Object.freeze({
  feel: Object.freeze(['works', 'direction', 'first', 'keeps', 'job']),
  measure: Object.freeze(['reading', 'when']),
});

// A change smaller than this share of the bigger value is "about the
// same" (REVISIT with Stage 0: what a kid calls the same).
export const SAME_WITHIN = 0.02;

const nodeOf = (system, id) => system.nodes.find((n) => n.id === id);
const subName = (system, nodeId) => system.substances.find((s) => s.id === nodeOf(system, nodeId).substance).name;
const and = (xs) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

export function partName(system, id) {
  const { part, copy } = instanceOf(system, id);
  return copy === null ? part.name : `${part.name} (${copy})`;
}

// What a part does, in the model's own terms: its machines, then what it
// moves, holds, opens and shuts, is needed for, uses up, has inside it.
// The author may say it in a kid's words instead (`job`); that is a
// claim an adult reads, like every other word in the file.
export function jobOf(system, part) {
  if (part.job) return part.job;
  const name = (id) => nodeOf(system, id).name;
  const clauses = [];
  for (const f of part.flows) {
    if (f.law === 'react') {
      const ins = Object.keys(f.inputs);
      const outs = Object.keys(f.outputs);
      if (!outs.length) continue; // a cost, not a job
      if (ins.length === 1 && outs.length === 1 && nodeOf(system, ins[0]).substance === nodeOf(system, outs[0]).substance) {
        clauses.push([1, `moves ${subName(system, ins[0])} from ${name(ins[0])} to ${name(outs[0])}`]);
      } else if (!ins.length) {
        clauses.push([0, `adds to ${and(outs.map(name))}`]);
      } else {
        clauses.push([0, `turns ${and(ins.map(name))} into ${and(outs.map(name))}`]);
      }
    } else {
      clauses.push([1, `lets ${subName(system, f.from)} flow from ${name(f.from)} to ${name(f.to)}${f.law === 'oneway' ? ', one way only' : ''}`]);
    }
  }
  if (part.holds.length) clauses.push([2, `holds ${and(part.holds.map(name))}`]);
  for (const g of part.gates) {
    const owner = system.parts.find((p) => p.flows.some((f) => f.id === g.flow));
    clauses.push([3, `opens and shuts ${owner.name}, going by ${name(g.by)}`]);
  }
  const needers = system.parts.filter((p) => p.flows.some((f) => f.needs.some((n) => n.part === part.id)));
  if (needers.length) clauses.push([4, `is needed by ${and(needers.map((p) => p.name))}`]);
  for (const f of part.flows) if (f.law === 'react' && !Object.keys(f.outputs).length) clauses.push([5, `uses up ${and(Object.keys(f.inputs).map(name))}`]);
  const inside = system.parts.filter((p) => p.within === part.id);
  if (inside.length) clauses.push([6, `has ${and(inside.map((p) => p.name))} inside it`]);
  clauses.sort((a, b) => a[0] - b[0]);
  return clauses.length ? clauses[0][1] : null;
}

// The nodes a part touches, by the system's own wiring.
function touches(part) {
  const out = new Set(part.holds);
  for (const f of part.flows) {
    if (f.law === 'react') [...Object.keys(f.inputs), ...Object.keys(f.outputs), ...f.by].forEach((n) => out.add(n));
    else [f.from, f.to].forEach((n) => out.add(n));
  }
  for (const g of part.gates) out.add(g.by);
  return out;
}

const nodeHere = (system, bench, nodeId) => {
  const holder = system.parts.find((p) => p.holds.includes(nodeId));
  return !holder || isPresent(system, bench, holder.id);
};

// The gauges a direction question can be about: the stores the changed
// parts touch, then what the goal and the instrument read.
function gauges(system, bench, changed) {
  const out = [];
  const seen = new Set();
  const add = (g) => {
    const key = g.node ?? `flow:${g.flow}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push(g);
    }
  };
  const m = system.measure;
  // The instrument's own statistic for what it reads; otherwise a flow's
  // peak (a light that blazed and burnt out did get more) and a store's
  // mean over the run (a level a thermostat holds swings; its mean is
  // what it was held at).
  const statFor = (g) => {
    const isRead = m && !m.read.lasts && (g.node !== undefined ? m.read.node === g.node : m.read.flow === g.flow);
    if (isRead) return m.read.stat;
    return g.flow !== undefined ? 'max' : 'mean';
  };
  for (const id of changed) {
    for (const n of touches(instanceOf(system, id).part)) {
      const node = nodeOf(system, n);
      if (node.kind === 'store' && nodeHere(system, bench, n)) add({ node: n });
    }
  }
  for (const c of system.goal.checks) if (c.read) add({ ...c.read });
  if (m && !m.read.lasts) add(m.read.node !== undefined ? { node: m.read.node } : { flow: m.read.flow });
  return out
    .filter((g) => (g.node !== undefined ? nodeHere(system, bench, g.node) : true))
    .map((g) => ({ ...g, stat: statFor(g) }));
}

function gaugeName(system, g) {
  if (g.node !== undefined) return nodeOf(system, g.node).name;
  const owner = system.parts.find((p) => p.flows.some((f) => f.id === g.flow));
  const f = owner.flows.find((x) => x.id === g.flow);
  const node = f.law === 'react' ? Object.keys(f.outputs)[0] ?? Object.keys(f.inputs)[0] : f.from;
  return `the ${subName(system, node)} through ${owner.name}`;
}

// Parts that can stop: present, untouched by the kid, and doing something.
function bystanders(system, bench, changed) {
  return instances(system, bench).filter((id) => !changed.has(id) && isPresent(system, bench, id) && instanceOf(system, id).part.flows.length);
}

// A bystander one step from what the kid changed: it shares a store or a
// wire with it, needs it, is needed by it, or one gates the other.
function neighbours(system, bench, changed) {
  const near = new Set();
  for (const id of changed) {
    const p = instanceOf(system, id).part;
    const mine = touches(p);
    for (const other of bystanders(system, bench, changed)) {
      const q = instanceOf(system, other).part;
      const shares = [...touches(q)].some((n) => mine.has(n) && nodeOf(system, n).kind !== 'fixed');
      const needs = q.flows.some((f) => f.needs.some((n) => n.part === p.id)) || p.flows.some((f) => f.needs.some((n) => n.part === q.id));
      const gated = q.gates.some((g) => p.flows.some((f) => f.id === g.flow)) || p.gates.some((g) => q.flows.some((f) => f.id === g.flow));
      if (shares || needs || gated) near.add(other);
    }
  }
  return [...near];
}

// The kinds that make sense for this bench at this depth, in rotation
// order. `focus` is the part the kid just changed, if the page knows.
export function kindsFor(system, bench, mode, { focus = null } = {}) {
  const changed = new Set(changes(system, bench).map((c) => c.part));
  if (mode === 'measure') {
    return KINDS.measure.filter((k) => (k === 'reading' ? !!system.measure : system.goal.checks.some((c) => c.when !== 'end' || c.part !== undefined)));
  }
  return KINDS.feel.filter((k) => {
    if (k === 'direction') return gauges(system, bench, changed).length > 0;
    if (k === 'first') return bystanders(system, bench, changed).length > 1;
    if (k === 'keeps') return neighbours(system, bench, changed).length > 0;
    if (k === 'job') return [focus, ...changed].some((id) => id && jobOf(system, instanceOf(system, id).part));
    return true;
  });
}

const niceStep = (x) => {
  const p = 10 ** Math.floor(Math.log10(x));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= x - 1e-12) return m * p;
  return 10 * p;
};

// The question for one round.
//   mode   'feel' or 'measure'
//   round  which question in the rotation (the page counts rounds)
//   seed   for the choices inside it: which gauge, which part
//   kind   ask this kind, if it makes sense here, instead of the rotation
//   focus  the part the kid just changed
export function ask(system, bench, { mode = 'feel', round = 0, seed = '', kind = null, focus = null } = {}) {
  const kinds = kindsFor(system, bench, mode, { focus });
  const type = kind && kinds.includes(kind) ? kind : kinds.length ? kinds[round % kinds.length] : 'works';
  const rng = makeRng(`${seed}:${type}`);
  const changed = new Set(changes(system, bench).map((c) => c.part));

  if (type === 'direction') {
    const pool = gauges(system, bench, changed);
    const about = pool[Math.floor(rng() * pool.length)];
    return {
      type,
      kind: 'binary',
      about,
      asks: `What happens to ${gaugeName(system, about)}: more, less, or about the same?`,
      options: [
        { id: 'up', label: 'More', icon: '⬆️' },
        { id: 'same', label: 'About the same', icon: '↔️' },
        { id: 'down', label: 'Less', icon: '⬇️' },
      ],
    };
  }
  if (type === 'first') {
    // The whole system is the menu, so the menu says nothing about the run.
    const pool = bystanders(system, bench, changed);
    return {
      type,
      kind: 'binary',
      about: null,
      asks: 'Which part will be the first to stop?',
      options: [...pool.map((id) => ({ id, label: partName(system, id), icon: instanceOf(system, id).part.icon })), { id: 'nothing', label: 'Nothing else stops', icon: '🙅' }],
    };
  }
  if (type === 'keeps') {
    const pool = neighbours(system, bench, changed);
    const other = pool[Math.floor(rng() * pool.length)];
    return {
      type,
      kind: 'binary',
      about: { part: other },
      asks: `Will ${partName(system, other)} keep working?`,
      options: [
        { id: 'yes', label: 'Yes, it keeps going', icon: '👍' },
        { id: 'no', label: 'No, it stops', icon: '✋' },
      ],
    };
  }
  if (type === 'job') {
    const subject = [focus, ...changed].find((id) => id && jobOf(system, instanceOf(system, id).part));
    const part = instanceOf(system, subject).part;
    const right = jobOf(system, part);
    const others = [...new Set(system.parts.filter((p) => p.id !== part.id).map((p) => jobOf(system, p)).filter((j) => j && j !== right))];
    const options = shuffled([right, ...shuffled(others, rng).slice(0, 3)], rng).map((label, i) => ({ id: label === right ? 'right' : `other-${i}`, label }));
    return { type, kind: 'binary', about: { part: subject }, asks: `What do you think ${partName(system, subject)} does?`, options };
  }
  if (type === 'reading') {
    const m = system.measure;
    return { type, kind: 'band', about: { ...m.read }, asks: m.says, unit: m.unit, max: m.max, resolution: m.resolution };
  }
  if (type === 'when') {
    const resolution = niceStep(system.time.run / 20);
    const max = Number((Math.ceil(system.time.run / resolution - 1e-9) * resolution).toFixed(9));
    return {
      type,
      kind: 'band',
      about: null,
      asks: `When will it stop doing its job? (If you think it never will, go right to ${max} ${system.time.unit}.)`,
      unit: system.time.unit,
      max,
      resolution,
    };
  }
  return {
    type: 'works',
    kind: 'binary',
    about: null,
    asks: system.goal.asks,
    options: [
      { id: 'works', label: 'Yes, still', icon: '👍' },
      { id: 'fails', label: 'No', icon: '👎' },
    ],
  };
}

const onGrid = (v, res) => Math.abs(v / res - Math.round(v / res)) < 1e-9;

// The kid's answer, checked before the run and frozen.
export function commit(question, call) {
  if (question.kind === 'binary') {
    if (!question.options.some((o) => o.id === call)) throw new Error('pick one of the answers');
    return Object.freeze({ type: question.type, call });
  }
  const { lo, hi } = call ?? {};
  if (!(Number.isFinite(lo) && Number.isFinite(hi))) throw new Error('give a low and a high number');
  if (lo < 0 || hi > question.max) throw new Error(`stay between 0 and ${question.max} ${question.unit}`);
  if (hi < lo) throw new Error('the low number goes first');
  if (!onGrid(lo, question.resolution) || !onGrid(hi, question.resolution)) throw new Error(`use steps of ${question.resolution} ${question.unit}`);
  return Object.freeze({ type: question.type, call: Object.freeze({ lo, hi }) });
}

const firstStops = (result, changed) => {
  const stops = result.events.filter((e) => (e.kind === 'stopped' || e.kind === 'broke') && !changed.has(e.part));
  if (!stops.length) return ['nothing'];
  const t = Math.min(...stops.map((e) => e.t));
  return [...new Set(stops.filter((e) => e.t === t).map((e) => e.part))];
};

// What actually happened, for this question: read off the run (and, for
// a direction, the system as it ships). `set` lists every right answer
// when more than one is (parts that stop at the same moment).
export function truthOf(system, question, result, healthy, bench = {}) {
  const changed = new Set(changes(system, bench).map((c) => c.part));
  switch (question.type) {
    case 'direction': {
      const g = question.about;
      const pick = (r) => (g.node !== undefined ? r.stats.node[g.node]?.[g.stat] : r.stats.flow[g.flow]?.[g.stat]);
      const h = pick(healthy);
      const c = pick(result);
      const tol = SAME_WITHIN * Math.max(Math.abs(h), Math.abs(c)) + 1e-12;
      const value = c > h + tol ? 'up' : c < h - tol ? 'down' : 'same';
      return { value, set: [value], before: h, after: c };
    }
    case 'first': {
      const set = firstStops(result, changed);
      return { value: set[0], set };
    }
    case 'keeps': {
      const id = question.about.part;
      const value = result.events.some((e) => (e.kind === 'stopped' || e.kind === 'broke') && e.part === id) ? 'no' : 'yes';
      return { value, set: [value] };
    }
    case 'job':
      return { value: 'right', set: ['right'], job: jobOf(system, instanceOf(system, question.about.part).part) };
    case 'reading':
      return { value: result.reading.value, maxed: result.reading.maxed };
    case 'when': {
      const check = result.failure ? system.goal.checks[result.failure.check] : null;
      const at = check && (check.when !== 'end' || check.part !== undefined) ? result.failedAt : null;
      const value = at === null ? question.max : Math.min(question.max, Number((Math.round(at / question.resolution) * question.resolution).toFixed(9)));
      return { value, maxed: at === null };
    }
    default:
      return { value: result.verdict, set: [result.verdict] };
  }
}

// The journal entry for an answer and the run it was about
// (engine/journal.js: binary entries compare strings, band entries
// numbers). One reading this file makes and says plainly: the journal's
// `buildFailed` means a build that did not stand up. Pulling a part to
// see what happens is an experiment, and an experiment does not fail —
// only a prediction can. A run after the kid put a good part back is a
// repair, and a repair that leaves the system failing is a failed build;
// that is what lets the debrief ask what was different when the next
// repair holds (decisions 2026-10-25, the debrief §2).
export function score(system, question, commitment, result, healthy, { bench = {}, repair = false, consultant = null, level = `sys:${system.id}`, setup = null } = {}) {
  const truth = truthOf(system, question, result, healthy, bench);
  const base = { level, about: question.type, buildFailed: repair && result.verdict === 'fails', consultant, setup };
  if (question.about?.part) base.of = question.about.part;
  if (question.about?.node) base.of = question.about.node;
  if (question.about?.flow) base.of = question.about.flow;
  if (question.kind === 'binary') {
    const hit = truth.set.includes(commitment.call);
    // When several answers are right, the outcome is the one the kid
    // named if it was among them, so the journal's equality reads true.
    const entry = { ...base, kind: 'binary', prediction: commitment.call, outcome: hit ? commitment.call : truth.value };
    return { entry, hit, truth };
  }
  const { lo, hi } = commitment.call;
  const entry = { ...base, kind: 'band', prediction: { lo, hi }, range: question.max, outcome: truth.value };
  return { entry, hit: truth.value >= lo && truth.value <= hi, truth };
}
