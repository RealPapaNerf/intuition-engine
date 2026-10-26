// The system file: what a system is, checked and frozen.
//
// The systems pack (docs/decisions/2026-10-26-pull-it-apart.md): pull a
// system apart, break it, fix it. A system is parts wired together —
// a flashlight, two kidneys, a cell a virus has landed on, a car — and
// the kid learns what each part does by pulling it out or swapping in a
// bad one and seeing what the whole does, having said first what it
// would do.
//
// Honest ground truth here is a small catalog of laws, and nothing
// else. Stuff sits in stocks (a battery's charge, the waste in the
// blood, the heat in an engine block) and moves between them by one of
// three laws (LAWS below): it flows downhill between levels (conduct),
// downhill one way only past a drop (oneway), or a machine turns inputs
// into outputs at its own rate (react). A system file chooses which
// laws, between which stocks, with which numbers — it may not write a
// law, and every outcome is the solver's (solve.js), never the file's.
// A file whose numbers are wrong about the real kidney is a wrong model,
// which is why a system names what it is a model of, says what it
// leaves out (`notes`), and is seen by an adult before a kid plays it.
//
// A system is frozen on validation, like a brief or a material: nothing
// downstream — the solver, the Consultant, the page — can move a number.
// What the kid changes is the bench (bottom of this file): which parts
// are in, which are out, which are bad ones, which broke.

import { deepFreeze } from '../engine/freeze.js';

// Model time. Every rate in a system is per one of these.
export const TIME_UNITS = deepFreeze({ s: 'second', min: 'minute', h: 'hour', day: 'day' });

// Sanity caps, not lessons (REVISIT): small enough that any run, and the
// workbench's answer key of every pull and every bad part, is instant in
// a browser.
export const LIMITS = deepFreeze({
  substances: 12,
  nodes: 64,
  parts: 32,
  flows: 96,
  faultsPerPart: 6,
  needsPerFlow: 6,
  gatesPerPart: 4,
  ratingsPerPart: 4,
  copies: 4, // more of one part the kid may add
  checks: 8,
  steps: 20000,
  notes: 12,
  text: { name: 40, line: 160, intro: 600, unit: 12, note: 300 },
});

// The laws: the systems pack's physics, and the only physics there is.
// Each is a formula in solve.js with a hand calculation in
// test/systems.test.js. `params` are the numbers a flow of that law
// carries, and the only ones a bad part may change.
export const LAWS = deepFreeze({
  conduct: {
    passive: true,
    params: ['g'],
    says: 'Flows from the higher level to the lower, faster the bigger the difference: flow = g × (from level − to level). A wire, a pipe, a filter, warmth through a wall.',
  },
  oneway: {
    passive: true,
    params: ['g', 'drop'],
    says: 'Like conduct, but one way only, and only once the push is bigger than its drop: flow = g × (from level − to level − drop), never below zero. A light-emitting diode, a check valve, a spillway.',
  },
  react: {
    passive: false,
    params: ['rate'],
    says: 'A machine: each run takes its inputs in fixed amounts and makes its outputs. It runs at rate × the amount of each helper it works with (`by`), and never faster than its inputs allow or its outputs have room for. A pump is a react with one input and one output.',
  },
});

const ID = /^[a-z][a-z0-9-]{0,39}$/;
const COLOR = /^#[0-9a-f]{6}$/i;
const isNum = Number.isFinite;
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

export function validateSystem(input) {
  const sys = isObj(input) ? input : {};
  const name = typeof sys.id === 'string' && ID.test(sys.id) ? sys.id : '?';
  const fail = (msg) => {
    throw new Error(`system ${name}: ${msg}`);
  };
  const words = (v, max, what) => {
    if (typeof v !== 'string' || !v.trim()) fail(`${what} must be words`);
    if (v.length > max) fail(`${what} is longer than ${max} characters`);
    return v;
  };
  const maybeWords = (v, max, what) => (v === undefined ? undefined : words(v, max, what));
  const id = (v, what) => {
    if (typeof v !== 'string' || !ID.test(v)) fail(`${what} needs an id of lowercase letters, digits and dashes, starting with a letter`);
    return v;
  };
  const num = (v, what, { min = -Infinity, above = null } = {}) => {
    if (!isNum(v) || v < min || (above !== null && v <= above)) {
      fail(`${what} must be a number${above !== null ? ` above ${above}` : min > -Infinity ? `, ${min} or more` : ''}`);
    }
    return v;
  };
  const list = (v, what, { min = 0, max = Infinity } = {}) => {
    if (v === undefined && min === 0) return [];
    if (!Array.isArray(v)) fail(`${what} must be a list`);
    if (v.length < min) fail(`${what} needs at least ${min}`);
    if (v.length > max) fail(`${what} may have at most ${max}`);
    return v;
  };
  const icon = (v, what) => {
    if (v === undefined) return undefined;
    if (typeof v !== 'string' || !v || [...v].length > 4) fail(`${what} must be a short picture (one emoji)`);
    return v;
  };
  const place = (v, what) => {
    if (v === undefined) return undefined;
    if (!Array.isArray(v) || v.length !== 2 || !v.every(isNum)) fail(`${what} must be [column, row]`);
    return [v[0], v[1]];
  };

  id(sys.id, 'the system');
  const T = LIMITS.text;
  const out = {
    id: sys.id,
    title: words(sys.title, T.name, 'title'),
    icon: icon(sys.icon, 'icon') ?? '⚙️',
    model: words(sys.model, T.line, 'model (what this is a model of)'),
    intro: words(sys.intro, T.intro, 'intro'),
  };

  // --- time ---------------------------------------------------------------
  const time = isObj(sys.time) ? sys.time : fail('time needs { unit, step, run }');
  if (!Object.hasOwn(TIME_UNITS, time.unit)) fail(`time unit must be one of ${Object.keys(TIME_UNITS).join(', ')}`);
  const step = num(time.step, 'time step', { above: 0 });
  const run = num(time.run, 'time run', { above: 0 });
  if (run / step > LIMITS.steps) fail(`a run of ${run} at steps of ${step} is more than ${LIMITS.steps} steps`);
  out.time = { unit: time.unit, step, run };

  // --- substances -----------------------------------------------------------
  const substances = list(sys.substances, 'substances', { min: 1, max: LIMITS.substances }).map((s, i) => {
    if (!isObj(s)) fail(`substance ${i + 1} must be an object`);
    const sid = id(s.id, `substance ${i + 1}`);
    const color = s.color === undefined ? undefined : COLOR.test(s.color) ? s.color : fail(`substance ${sid}: color must look like #a1b2c3`);
    return {
      id: sid,
      name: words(s.name, T.name, `substance ${sid}: name`),
      amount: words(s.amount, T.unit, `substance ${sid}: amount (its unit)`),
      level: words(s.level ?? s.amount, T.unit, `substance ${sid}: level (its unit)`),
      // what a flow of it is called, if not amount per time (mC/s is mA)
      flow: s.flow === undefined ? `${s.amount}/${time.unit}` : words(s.flow, T.unit, `substance ${sid}: flow (its unit)`),
      color: color ?? '#6b6354',
    };
  });
  unique(substances, 'substance', fail);
  const substance = new Map(substances.map((s) => [s.id, s]));
  out.substances = substances;

  // --- nodes: where stuff is ------------------------------------------------
  const nodes = list(sys.nodes, 'nodes', { min: 1, max: LIMITS.nodes }).map((n, i) => {
    if (!isObj(n)) fail(`node ${i + 1} must be an object`);
    const nid = id(n.id, `node ${i + 1}`);
    if (!substance.has(n.substance)) fail(`node ${nid}: substance must name one of the substances`);
    const base = {
      id: nid,
      substance: n.substance,
      name: maybeWords(n.name, T.name, `node ${nid}: name`) ?? nid,
      at: place(n.at, `node ${nid}: at`),
    };
    const kinds = ['store', 'fixed', 'junction'].filter((k) => n.kind === k);
    if (kinds.length !== 1) fail(`node ${nid}: kind must be store, fixed or junction`);
    if (n.kind === 'store') {
      const capacity = num(n.capacity, `node ${nid}: capacity`, { above: 0 });
      const start = num(n.start ?? 0, `node ${nid}: start`, { min: 0 });
      const max = n.max === undefined ? null : num(n.max, `node ${nid}: max`, { above: 0 });
      if (max !== null && start > max) fail(`node ${nid}: starts above its max`);
      return { ...base, kind: 'store', capacity, start, max };
    }
    if (n.kind === 'fixed') return { ...base, kind: 'fixed', level: num(n.level, `node ${nid}: level`) };
    return { ...base, kind: 'junction' };
  });
  unique(nodes, 'node', fail);
  const node = new Map(nodes.map((n) => [n.id, n]));
  out.nodes = nodes;
  const needNode = (v, what) => (node.has(v) ? v : fail(`${what} names no node "${v}"`));

  // --- parts, first pass: ids, so references can point anywhere -------------
  const rawParts = list(sys.parts, 'parts', { min: 1, max: LIMITS.parts });
  const partIds = rawParts.map((p, i) => (isObj(p) ? id(p.id, `part ${i + 1}`) : fail(`part ${i + 1} must be an object`)));
  if (new Set(partIds).size !== partIds.length) fail('two parts share an id');
  const partSet = new Set(partIds);
  const flowIds = new Set();
  const flowOwner = new Map();
  for (const p of rawParts) {
    for (const f of list(p.flows, `part ${p.id}: flows`)) {
      if (!isObj(f)) fail(`part ${p.id}: every flow must be an object`);
      id(f.id, `part ${p.id}: a flow`);
      if (flowIds.has(f.id)) fail(`two flows share the id ${f.id}`);
      flowIds.add(f.id);
      flowOwner.set(f.id, p.id);
    }
  }
  if (flowIds.size > LIMITS.flows) fail(`may have at most ${LIMITS.flows} flows`);

  const flowOf = (f, owner) => {
    const what = `part ${owner}, flow ${f.id}`;
    const needs = list(f.needs, `${what}: needs`, { max: LIMITS.needsPerFlow }).map((n) => {
      if (!isObj(n)) fail(`${what}: every need must be an object`);
      if (n.part !== undefined) {
        if (!partSet.has(n.part)) fail(`${what}: needs names no part "${n.part}"`);
        if (n.part === owner) fail(`${what}: a part cannot need itself`);
        return { part: n.part };
      }
      const nid = needNode(n.node, `${what}: a need`);
      const atLeast = n.atLeast === undefined ? null : num(n.atLeast, `${what}: needs atLeast`);
      const atMost = n.atMost === undefined ? null : num(n.atMost, `${what}: needs atMost`);
      if (atLeast === null && atMost === null) fail(`${what}: a need on a node needs atLeast or atMost`);
      return { node: nid, atLeast, atMost };
    });
    if (f.law === 'conduct' || f.law === 'oneway') {
      const from = needNode(f.from, `${what}: from`);
      const to = needNode(f.to, `${what}: to`);
      if (from === to) fail(`${what}: runs from a node to itself`);
      if (node.get(from).substance !== node.get(to).substance) fail(`${what}: joins ${from} and ${to}, which hold different substances`);
      if (node.get(from).kind === 'fixed' && node.get(to).kind === 'fixed') fail(`${what}: joins two fixed levels, so nothing in the system can feel it`);
      const flow = { id: f.id, law: f.law, from, to, g: num(f.g, `${what}: g`, { min: 0 }), needs };
      if (f.law === 'oneway') flow.drop = num(f.drop ?? 0, `${what}: drop`, { min: 0 });
      return flow;
    }
    let inputs;
    let outputs;
    if (f.law === 'pump') {
      if (f.from == null && f.to == null) fail(`${what}: a pump needs a from or a to`);
      inputs = f.from == null ? {} : { [f.from]: 1 };
      outputs = f.to == null ? {} : { [f.to]: 1 };
      if (f.from != null && f.to != null && f.from === f.to) fail(`${what}: pumps from a node to itself`);
      if (f.from != null && f.to != null && node.get(f.from)?.substance !== node.get(f.to)?.substance) {
        fail(`${what}: a pump moves one substance; ${f.from} and ${f.to} hold different ones`);
      }
    } else if (f.law === 'react') {
      inputs = f.inputs ?? {};
      outputs = f.outputs ?? {};
      if (!isObj(inputs) || !isObj(outputs)) fail(`${what}: inputs and outputs must be { node: amount }`);
    } else {
      fail(`${what}: law must be one of ${[...Object.keys(LAWS), 'pump'].join(', ')}`);
    }
    const side = (o, which) =>
      Object.fromEntries(
        Object.entries(o).map(([k, v]) => {
          needNode(k, `${what}: ${which}`);
          if (node.get(k).kind === 'junction') fail(`${what}: a machine cannot take from or give to a junction (${k})`);
          return [k, num(v, `${what}: ${which} amount for ${k}`, { above: 0 })];
        }),
      );
    const ins = side(inputs, 'inputs');
    const outs = side(outputs, 'outputs');
    if (!Object.keys(ins).length && !Object.keys(outs).length) fail(`${what}: needs inputs or outputs`);
    for (const k of Object.keys(ins)) if (Object.hasOwn(outs, k)) fail(`${what}: takes from and gives to the same node ${k}`);
    const by = list(f.by, `${what}: by`, { max: 4 }).map((k) => {
      needNode(k, `${what}: by`);
      if (node.get(k).kind !== 'store') fail(`${what}: works with helpers counted in a store, and ${k} is not one`);
      return k;
    });
    if (new Set(by).size !== by.length) fail(`${what}: names a helper twice`);
    return { id: f.id, law: 'react', inputs: ins, outputs: outs, rate: num(f.rate, `${what}: rate`, { min: 0 }), by, needs };
  };

  // --- parts, second pass -----------------------------------------------------
  const held = new Map();
  const parts = rawParts.map((p) => {
    const pid = p.id;
    const what = `part ${pid}`;
    const flows = list(p.flows, `${what}: flows`).map((f) => flowOf(f, pid));
    const holds = list(p.holds, `${what}: holds`).map((n) => {
      needNode(n, `${what}: holds`);
      if (held.has(n)) fail(`node ${n} is held by both ${held.get(n)} and ${pid}`);
      held.set(n, pid);
      return n;
    });
    if (p.within !== undefined && (!partSet.has(p.within) || p.within === pid)) fail(`${what}: within must name another part`);
    const gates = list(p.gates, `${what}: gates`, { max: LIMITS.gatesPerPart }).map((g) => {
      if (!isObj(g)) fail(`${what}: every gate must be an object`);
      if (!flowIds.has(g.flow)) fail(`${what}: a gate names no flow "${g.flow}"`);
      if (!['above', 'below'].includes(g.open)) fail(`${what}: gate on ${g.flow} must open 'above' or 'below'`);
      return {
        flow: g.flow,
        by: needNode(g.by, `${what}: gate on ${g.flow}`),
        open: g.open,
        at: num(g.at, `${what}: gate on ${g.flow}: at`),
        band: num(g.band ?? 0, `${what}: gate on ${g.flow}: band`, { min: 0 }),
      };
    });
    if (new Set(gates.map((g) => g.flow)).size !== gates.length) fail(`${what}: gates the same flow twice`);
    const ratings = list(p.ratings, `${what}: ratings`, { max: LIMITS.ratingsPerPart }).map((r) => {
      if (!isObj(r)) fail(`${what}: every rating must be an object`);
      const above = r.above === undefined ? null : num(r.above, `${what}: rating above`);
      const below = r.below === undefined ? null : num(r.below, `${what}: rating below`);
      const lasts = num(r.for ?? 0, `${what}: rating for`, { min: 0 });
      if (r.flow !== undefined) {
        if (!flows.some((f) => f.id === r.flow)) fail(`${what}: a flow rating must name one of its own flows`);
        if (above === null || below !== null) fail(`${what}: a flow rating takes only above (how much is too much)`);
        return { flow: r.flow, above, below: null, for: lasts };
      }
      needNode(r.node, `${what}: a rating`);
      if (above === null && below === null) fail(`${what}: a rating needs above or below`);
      return { node: r.node, above, below, for: lasts };
    });
    const faults = list(p.faults, `${what}: faults`, { max: LIMITS.faultsPerPart }).map((ft) => {
      if (!isObj(ft)) fail(`${what}: every fault must be an object`);
      const fid = id(ft.id, `${what}: a fault`);
      const fw = `${what}, fault ${fid}`;
      const changes = list(ft.changes, `${fw}: changes`, { min: 1, max: 8 }).map((c) => {
        if (!isObj(c)) fail(`${fw}: every change must be an object`);
        if (c.broken !== undefined) {
          if (c.broken !== true) fail(`${fw}: broken must be true`);
          return { broken: true };
        }
        if (c.gate !== undefined) {
          if (!gates.some((g) => g.flow === c.gate)) fail(`${fw}: names no gate of this part on "${c.gate}"`);
          if (!['open', 'shut'].includes(c.stuck)) fail(`${fw}: a gate gets stuck 'open' or 'shut'`);
          return { gate: c.gate, stuck: c.stuck };
        }
        if (c.node !== undefined) {
          if (!holds.includes(c.node) || node.get(c.node).kind !== 'store') fail(`${fw}: may only change the start of a store this part holds`);
          return { node: c.node, start: num(c.start, `${fw}: start (a multiplier)`, { min: 0 }) };
        }
        const f = flows.find((x) => x.id === c.flow);
        if (!f) fail(`${fw}: may only change this part's own flows`);
        const params = LAWS[f.law].params;
        const pick = (o, kind) =>
          Object.fromEntries(
            Object.entries(o).map(([k, v]) => {
              if (!params.includes(k)) fail(`${fw}: ${f.law} has no ${k} to ${kind}`);
              return [k, num(v, `${fw}: ${kind} ${k}`, { min: 0 })];
            }),
          );
        const change = { flow: c.flow };
        if (c.scale !== undefined) change.scale = isObj(c.scale) ? pick(c.scale, 'scale') : fail(`${fw}: scale must be { param: factor }`);
        if (c.set !== undefined) change.set = isObj(c.set) ? pick(c.set, 'set') : fail(`${fw}: set must be { param: value }`);
        if (c.reverse !== undefined) {
          if (c.reverse !== true || !LAWS[f.law].passive) fail(`${fw}: only a conduct or oneway flow can be put in backwards`);
          change.reverse = true;
        }
        if (Object.keys(change).length === 1) fail(`${fw}: a change to a flow must scale, set or reverse it`);
        return change;
      });
      return { id: fid, name: words(ft.name, T.name, `${fw}: name`), icon: icon(ft.icon, `${fw}: icon`), changes };
    });
    unique(faults, `${what}: fault`, fail);
    if (p.keep !== undefined && typeof p.keep !== 'boolean') fail(`${what}: keep must be true or false`);
    if (p.installed !== undefined && typeof p.installed !== 'boolean') fail(`${what}: installed must be true or false`);
    const copies = p.copies ?? 0;
    if (!Number.isInteger(copies) || copies < 0 || copies > LIMITS.copies) fail(`${what}: copies must be a whole number from 0 to ${LIMITS.copies}`);
    const at = place(p.at, `${what}: at`) ?? fail(`${what}: at must be [column, row]`);
    return {
      id: pid,
      name: words(p.name, T.name, `${what}: name`),
      icon: icon(p.icon, `${what}: icon`) ?? '⚙️',
      says: maybeWords(p.says, T.line, `${what}: says`) ?? '',
      // what it is for, in a kid's words (else the model says it: questions.js)
      job: maybeWords(p.job, T.line, `${what}: job`) ?? null,
      at,
      keep: p.keep === true,
      installed: p.installed !== false,
      copies,
      within: p.within ?? null,
      holds,
      flows,
      gates,
      ratings,
      faults,
    };
  });
  const partById = new Map(parts.map((p) => [p.id, p]));
  for (const p of parts) {
    // Nesting must bottom out: a part inside itself, however far down, is no part.
    const seen = new Set([p.id]);
    for (let up = p.within; up; up = partById.get(up).within) {
      if (seen.has(up)) fail(`part ${p.id} is inside itself`);
      seen.add(up);
    }
    if (p.keep && p.within && !partById.get(p.within).keep) fail(`part ${p.id} cannot be kept in while the part it sits in can come out`);
  }
  out.parts = parts;

  // --- the goal: what the system is for ----------------------------------------
  const goal = isObj(sys.goal) ? sys.goal : fail('goal needs { says, asks, checks }');
  const asks = words(goal.asks, T.line, 'goal asks');
  if (!asks.trim().endsWith('?')) fail('goal asks must be a question');
  const read = (r, what) => {
    if (!isObj(r)) fail(`${what}: read must be { node } or { flow }`);
    if (r.node !== undefined) return { node: needNode(r.node, what) };
    if (flowIds.has(r.flow)) return { flow: r.flow };
    return fail(`${what}: read names no node or flow`);
  };
  const checks = list(goal.checks, 'goal checks', { min: 1, max: LIMITS.checks }).map((c, i) => {
    const what = `goal check ${i + 1}`;
    if (!isObj(c)) fail(`${what} must be an object`);
    const fails = words(c.fails, T.line, `${what}: fails (what the kid is told when it fails)`);
    if (c.part !== undefined) {
      if (!partSet.has(c.part) || c.intact !== true) fail(`${what}: a part check is { part, intact: true }`);
      return { part: c.part, intact: true, fails };
    }
    const above = c.above === undefined ? null : num(c.above, `${what}: above`);
    const below = c.below === undefined ? null : num(c.below, `${what}: below`);
    if (above === null && below === null) fail(`${what}: needs above or below`);
    const when = c.when ?? 'always';
    if (!['always', 'end'].includes(when)) fail(`${what}: when must be 'always' or 'end'`);
    return { read: read(c.read, what), above, below, when, fails };
  });
  out.goal = { says: words(goal.says, T.line, 'goal says'), asks, checks };

  // --- the instrument: what a band prediction is judged against ----------------
  if (sys.measure === undefined || sys.measure === null) {
    out.measure = null;
  } else {
    const m = isObj(sys.measure) ? sys.measure : fail('measure must be an object');
    const says = words(m.says, T.line, 'measure says');
    if (!says.trim().endsWith('?')) fail('measure says must be a question');
    const max = num(m.max, 'measure max', { above: 0 });
    const resolution = num(m.resolution, 'measure resolution', { above: 0 });
    const ticks = max / resolution;
    if (Math.abs(ticks - Math.round(ticks)) > 1e-9 * ticks || ticks > 1000) fail('measure max must be a whole number of resolutions, at most 1000 of them');
    let mread;
    if (isObj(m.read) && m.read.lasts === true) {
      mread = { lasts: true };
    } else {
      mread = read(m.read, 'measure');
      const stat = m.read.stat ?? 'end';
      if (!['max', 'min', 'end'].includes(stat)) fail("measure stat must be 'max', 'min' or 'end'");
      mread.stat = stat;
    }
    out.measure = { says, read: mread, unit: words(m.unit ?? (mread.lasts ? out.time.unit : ''), T.unit, 'measure unit'), max, resolution };
  }

  out.notes = list(sys.notes, 'notes', { max: LIMITS.notes }).map((n, i) => words(n, T.note, `note ${i + 1}`));
  out.sources = list(sys.sources, 'sources', { max: LIMITS.notes }).map((n, i) => words(n, T.note, `source ${i + 1}`));

  // Every bad part must still be a legal part: a fault is a different
  // part, not a way around the laws.
  for (const p of parts) for (const ft of p.faults) faulted(p, ft);
  return deepFreeze(out);
}

function unique(items, what, fail) {
  const seen = new Set();
  for (const x of items) {
    if (seen.has(x.id)) fail(`two of ${what} share the id ${x.id}`);
    seen.add(x.id);
  }
}

// A part as a given fault makes it: its own flows with the fault's
// numbers, its gates stuck, its stores started low. Pure; the part as
// validated is untouched. `reversed` names the flows put in backwards,
// so a part moved to another place can still be backwards there.
export function faulted(part, fault) {
  const flows = part.flows.map((f) => ({ ...f, inputs: f.inputs && { ...f.inputs }, outputs: f.outputs && { ...f.outputs } }));
  const stuck = new Map();
  const start = new Map();
  const reversed = new Set();
  let broken = false;
  for (const c of fault?.changes ?? []) {
    if (c.broken) broken = true;
    else if (c.gate) stuck.set(c.gate, c.stuck);
    else if (c.node) start.set(c.node, c.start);
    else {
      const f = flows.find((x) => x.id === c.flow);
      for (const [k, v] of Object.entries(c.scale ?? {})) f[k] *= v;
      for (const [k, v] of Object.entries(c.set ?? {})) f[k] = v;
      if (c.reverse) {
        [f.from, f.to] = [f.to, f.from];
        reversed.add(f.id);
      }
      for (const k of LAWS[f.law].params) {
        if (!(Number.isFinite(f[k]) && f[k] >= 0)) throw new Error(`part ${part.id}, fault ${fault.id}: leaves ${f.id}'s ${k} at ${f[k]}`);
      }
    }
  }
  return { flows, stuck, start, broken, reversed };
}

// --- The bench: what the kid has done to the system ----------------------------
//
// Every question the kid can ask of a system is an intervention on it,
// and the bench is the record of them (decisions 2026-10-26 §3):
//
//   pull it out          what was it doing?
//   swap in a bad one    what does a weak / blocked / backwards one do?
//   put a good one in    does fixing that fix it?
//   add another          what do two of them do? (parts with `copies`)
//   put it somewhere     what does it do beside that part, or in line
//                        with it? (two-ended parts: one conduct or oneway
//                        flow and nothing held — a resistor, a light, a
//                        switch, a hose)
//   block it             what if this one flow could not get through?
//
// A bench is { parts, blocked }. `parts` maps a part — or a copy of one,
// `id#2`, `id#3` — to { as, fault, broken, at } wherever it differs from
// how the system ships:
//   as      'ok' (a good one is in) · 'out' (pulled) · 'bad' (a bad one)
//   fault   the bad one's fault id
//   broken  true once a run broke it — it stays broken until a good one
//           goes in, which is how a kid learns that fixing what blew is
//           not the same as fixing why it blew
//   at      { part, how }: this one sits in another part's place,
//           'beside' it (both between the same two points: side by side,
//           in parallel) or 'inline' with it (one after the other, in
//           series)
// `blocked` lists the flows the kid has blocked: a clamp on a hose, a
// stone in a tube, a medicine on a door. Benches are never mutated;
// every change returns a new one.

const COPY = /^([a-z][a-z0-9-]{0,39})#(\d{1,2})$/;
const entries = (bench) => bench?.parts ?? {};

function tidy(bench) {
  const out = {};
  if (bench.parts && Object.keys(bench.parts).length) out.parts = bench.parts;
  if (bench.blocked?.length) out.blocked = bench.blocked;
  return out;
}

// A part or a copy of one: which part it is, and which copy (or null).
export function instanceOf(system, id) {
  const m = COPY.exec(String(id));
  const part = system.parts.find((p) => p.id === (m ? m[1] : id));
  const n = m ? Number(m[2]) : null;
  if (!part || (n !== null && !(n >= 2 && n <= part.copies + 1))) throw new Error(`no part ${id} in system ${system.id}`);
  return { part, copy: n };
}

export function copiesOf(system, bench, partId) {
  return Object.keys(entries(bench))
    .filter((id) => COPY.exec(id)?.[1] === partId)
    .sort((a, b) => Number(a.split('#')[1]) - Number(b.split('#')[1]));
}

// Every part on the bench, each copy right after its part.
export function instances(system, bench) {
  const out = [];
  for (const p of system.parts) out.push(p.id, ...copiesOf(system, bench, p.id));
  return out;
}

export function partState(system, bench, id) {
  const { part, copy } = instanceOf(system, id);
  const s = entries(bench)[id];
  if (!s) return { as: copy || !part.installed ? 'out' : 'ok', fault: null, broken: false, at: null };
  return {
    as: s.as,
    fault: s.as === 'bad' ? s.fault : null,
    broken: s.as !== 'out' && s.broken === true,
    at: s.as !== 'out' && s.at ? { ...s.at } : null,
  };
}

// In the system right now: put in, and so is everything it sits inside.
export function isPresent(system, bench, id) {
  const { part } = instanceOf(system, id);
  if (partState(system, bench, id).as === 'out') return false;
  return part.within ? isPresent(system, bench, part.within) : true;
}

function setPart(system, bench, id, state) {
  const { part, copy } = instanceOf(system, id);
  const parts = { ...entries(bench) };
  const shipped = copy ? 'out' : part.installed ? 'ok' : 'out';
  if (state.as === 'out' && copy) delete parts[id]; // a copy taken out is simply gone
  else if (state.as === shipped && !state.broken && !state.at) delete parts[id];
  else {
    parts[id] = { as: state.as };
    if (state.as === 'bad') parts[id].fault = state.fault;
    if (state.broken) parts[id].broken = true;
    if (state.at && state.as !== 'out') parts[id].at = { part: state.at.part, how: state.at.how };
  }
  return tidy({ ...bench, parts });
}

export function pull(system, bench, id) {
  const { part } = instanceOf(system, id);
  if (part.keep) throw new Error(`${part.name} stays in: it is the stage the rest stands on`);
  return setPart(system, bench, id, { as: 'out' });
}

export function swapBad(system, bench, id, faultId) {
  const { part } = instanceOf(system, id);
  if (!part.faults.some((f) => f.id === faultId)) throw new Error(`${part.name} has no bad version "${faultId}"`);
  return setPart(system, bench, id, { as: 'bad', fault: faultId, at: partState(system, bench, id).at });
}

// A good one goes in: fresh, unbroken, no fault — where the old one was.
export function putGood(system, bench, id) {
  return setPart(system, bench, id, { as: 'ok', at: partState(system, bench, id).at });
}

// One more of a part the system lets you double up: in beside the first.
export function addCopy(system, bench, partId) {
  const { part, copy } = instanceOf(system, partId);
  if (copy) throw new Error('add another of the part itself, not of a copy');
  const have = copiesOf(system, bench, partId);
  if (have.length >= part.copies) {
    throw new Error(part.copies ? `there is room for only ${part.copies + 1} of ${part.name}` : `there is no room for another ${part.name}`);
  }
  let n = 2;
  while (have.includes(`${partId}#${n}`)) n++;
  return setPart(system, bench, `${partId}#${n}`, { as: 'ok' });
}

// Where a two-ended part connects: its one level flow's two ends. Null
// for anything else — a machine, or a part that holds its own stores,
// has no single place it could be swapped into.
export function slotOf(system, id) {
  const { part } = instanceOf(system, id);
  if (part.flows.length !== 1 || part.holds.length || !LAWS[part.flows[0].law].passive) return null;
  const f = part.flows[0];
  return { from: f.from, to: f.to, substance: system.nodes.find((n) => n.id === f.from).substance };
}

// Put a two-ended part in another's place: beside it, or in line with it.
// Beside a part that has been pulled is instead of it.
export function place(system, bench, id, targetId, how) {
  if (how !== 'beside' && how !== 'inline') throw new Error("a part goes 'beside' another or 'inline' with it");
  const { part } = instanceOf(system, id);
  const target = instanceOf(system, targetId).part;
  if (part.keep) throw new Error(`${part.name} stays where it is`);
  if (id === targetId) throw new Error('a part cannot go beside itself');
  const mine = slotOf(system, id);
  const theirs = slotOf(system, targetId);
  if (!mine) throw new Error(`${part.name} does not have two ends to connect somewhere else`);
  if (!theirs) throw new Error(`${target.name} is not a spot a two-ended part fits`);
  if (mine.substance !== theirs.substance) throw new Error(`${part.name} carries a different thing than ${target.name}’s spot does`);
  if (partState(system, bench, targetId).at) throw new Error(`${target.name} has been moved itself`);
  if (instances(system, bench).some((x) => partState(system, bench, x).at?.part === id)) throw new Error(`something is connected to ${part.name}’s spot`);
  const s = partState(system, bench, id);
  return setPart(system, bench, id, { as: s.as === 'out' ? 'ok' : s.as, fault: s.fault, broken: s.broken, at: { part: targetId, how } });
}

// Back to its own place.
export function unplace(system, bench, id) {
  return setPart(system, bench, id, { ...partState(system, bench, id), at: null });
}

// The part (or copy) a flow id belongs to: `flow` or a copy's `flow#n`.
export function flowOwner(system, flowId) {
  const m = COPY.exec(String(flowId));
  const base = m ? m[1] : flowId;
  const part = system.parts.find((p) => p.flows.some((f) => f.id === base));
  if (!part) throw new Error(`no flow ${flowId} in system ${system.id}`);
  const owner = m ? `${part.id}#${m[2]}` : part.id;
  instanceOf(system, owner);
  return owner;
}

export function block(system, bench, flowId) {
  flowOwner(system, flowId);
  return tidy({ ...bench, blocked: [...new Set([...(bench?.blocked ?? []), flowId])].sort() });
}

export function unblock(system, bench, flowId) {
  return tidy({ ...bench, blocked: (bench?.blocked ?? []).filter((f) => f !== flowId) });
}

export const isBlocked = (bench, flowId) => (bench?.blocked ?? []).includes(flowId);

// What a run leaves behind: the parts it broke stay broken.
export function withBroken(system, bench, ids) {
  let next = bench;
  for (const id of ids) {
    const s = partState(system, next, id);
    if (s.as !== 'out') next = setPart(system, next, id, { ...s, broken: true });
  }
  return next;
}

// The differences from the system as it ships, in system order: what
// the kid did, said back to them, and the first lines of every cascade.
export function changes(system, bench) {
  const out = [];
  for (const id of instances(system, bench)) {
    const { part, copy } = instanceOf(system, id);
    const s = partState(system, bench, id);
    const shipped = copy ? 'out' : part.installed ? 'ok' : 'out';
    if (s.as === shipped && !s.broken && !s.at) continue;
    out.push({ part: id, as: s.as, fault: s.fault, broken: s.broken, at: s.at, copy: copy !== null });
  }
  for (const flow of bench?.blocked ?? []) out.push({ flow, blocked: true, part: flowOwner(system, flow) });
  return out;
}

// The bench in one canonical string: same bench, same key, always — so a
// setup the kid has already seen can be recognized, and every journal
// entry names exactly what was on the bench.
export function benchKey(system, bench) {
  return changes(system, bench)
    .map((c) =>
      c.blocked
        ? `block:${c.flow}`
        : `${c.part}=${c.as === 'bad' ? `bad:${c.fault}` : c.as}${c.at ? `@${c.at.how}:${c.at.part}` : ''}${c.broken ? '!' : ''}`,
    )
    .join(',');
}
