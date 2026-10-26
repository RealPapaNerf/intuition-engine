// The solver: a system on the bench, run forward in model time. Every
// outcome in the systems pack comes from here — nothing in a system file
// says what happens when a part comes out (invariant 3: no canned
// outcomes).
//
// Each step, in order:
//
//   1. Which flows may run: the part that owns it is in and unbroken,
//      the stores it touches still exist, what it needs is there (a
//      part, or a level high or low enough), and every gate on it is
//      open. Decided on the levels at the start of the step.
//   2. Machines (react): each wants rate × the amounts of its helpers
//      (`by`). No machine may take more than a store holds, counting
//      what other machines put in this step, or put more into a store
//      than its max leaves room for; when they would, every machine
//      on that store is slowed by the same factor until none would.
//      What they take and make becomes each store's source for the
//      step.
//   3. Levels (conduct, oneway), one substance at a time, by backward
//      Euler: for every store and junction, capacity/dt × (new level −
//      old level) = what flows in at the new levels + the machines'
//      source. A junction has no capacity: what flows in flows out. It
//      is one small linear solve per connected network, exact at steady
//      state and stable at any step, however stiff the circuit. A
//      oneway flow is on or off, decided by solving and checking until
//      every oneway agrees with the levels it produced.
//   4. Ratings: a part pushed past its rating for longer than it can
//      take breaks, and stays broken (a burnt light stays burnt).
//   5. Gates read the new levels, with their band of hysteresis.
//   6. The goal's checks, the record, and the cascade's events.
//
// Nothing here reads a clock or rolls a die: a run is a pure function
// of the system and the bench, the same every time (the feed line,
// decisions 2026-10-19 §6 — and test/systems.test.js checks the source).

import { faulted, partState, isPresent, changes, withBroken, benchKey, instances, instanceOf, slotOf } from './system.js';
import { solveLinear } from './linear.js';

const STORE = 0;
const FIXED = 1;
const JUNCTION = 2;

// Build the run's working model from a system and a bench: faults
// applied; pulled parts gone, and the stores they held with them; each
// copy a part of its own, with stores of its own; two-ended parts moved
// into other parts' places, a new junction between two parts put in
// line; blocked flows marked.
function assemble(system, bench) {
  const insts = instances(system, bench).map((id) => ({ id, ...instanceOf(system, id), state: partState(system, bench, id) }));
  const instIx = new Map(insts.map((x, i) => [x.id, i]));
  const present = insts.map((x) => isPresent(system, bench, x.id));
  const broken = new Uint8Array(insts.length);

  // The node table: the system's own nodes, each copy's own stores, and
  // a junction for every part put in line with another.
  const nodes = system.nodes.map((n) => ({ ...n }));
  const holder = new Map();
  const rename = insts.map(() => new Map());
  insts.forEach((x, i) => {
    for (const nid of x.part.holds) {
      if (x.copy === null) {
        holder.set(nid, i);
        continue;
      }
      const base = system.nodes.find((n) => n.id === nid);
      const id = `${nid}#${x.copy}`;
      nodes.push({ ...base, id, name: `${base.name} (${x.copy})`, at: undefined });
      holder.set(id, i);
      rename[i].set(nid, id);
    }
  });
  const own = (i, nid) => rename[i].get(nid) ?? nid;

  // Where each moved two-ended flow runs. Beside a part: between its two
  // ends. In line with it: the part ends at a new junction, and each part
  // in line runs on to the next, in bench order.
  const ends = new Map();
  const chains = new Map();
  insts.forEach((x, i) => {
    const at = x.state.at;
    if (!at) return;
    const t = slotOf(system, at.part);
    if (at.how === 'beside') ends.set(i, [t.from, t.to]);
    else {
      if (!chains.has(at.part)) chains.set(at.part, []);
      chains.get(at.part).push(i);
      nodes.push({ id: `${x.id}~in`, substance: t.substance, name: `between ${instanceOf(system, at.part).part.name} and ${x.part.name}`, kind: 'junction' });
    }
  });
  for (const [targetId, chain] of chains) {
    const t = slotOf(system, targetId);
    const juncs = chain.map((i) => `${insts[i].id}~in`);
    if (instIx.has(targetId)) ends.set(instIx.get(targetId), [t.from, juncs[0]]);
    chain.forEach((i, k) => ends.set(i, [juncs[k], k + 1 < juncs.length ? juncs[k + 1] : t.to]));
  }

  const N = nodes.length;
  const nodeIx = new Map(nodes.map((n, i) => [n.id, i]));
  const subIx = new Map(system.substances.map((sub, i) => [sub.id, i]));
  const startScale = new Float64Array(N).fill(1);
  const blocked = new Set(bench?.blocked ?? []);
  // A need for a part is met by any of it: a spare pump is a pump.
  const ofPart = new Map();
  insts.forEach((x, i) => ofPart.set(x.part.id, [...(ofPart.get(x.part.id) ?? []), i]));
  const flows = [];
  const gates = [];
  const ratings = [];

  insts.forEach((x, i) => {
    const st = x.state;
    const made = faulted(x.part, st.as === 'bad' ? x.part.faults.find((f) => f.id === st.fault) : null);
    if (present[i] && (st.broken || made.broken)) broken[i] = 1;
    for (const [nid, k] of made.start) startScale[nodeIx.get(own(i, nid))] = k;
    const tag = x.copy === null ? '' : `#${x.copy}`;
    for (const f of made.flows) {
      const needs = f.needs.map((n) =>
        n.part !== undefined ? { part: ofPart.get(n.part), name: n.part } : { node: nodeIx.get(own(i, n.node)), atLeast: n.atLeast, atMost: n.atMost },
      );
      const base = { id: f.id + tag, part: i, needs, gates: [], blocked: blocked.has(f.id + tag) };
      if (f.law === 'react') {
        flows.push({
          ...base,
          passive: false,
          ins: Object.entries(f.inputs).map(([k, v]) => [nodeIx.get(own(i, k)), v]),
          outs: Object.entries(f.outputs).map(([k, v]) => [nodeIx.get(own(i, k)), v]),
          rate: f.rate,
          by: f.by.map((k) => nodeIx.get(own(i, k))),
        });
        continue;
      }
      let [from, to] = ends.get(i) ?? [own(i, f.from), own(i, f.to)];
      if (ends.has(i) && made.reversed.has(f.id)) [from, to] = [to, from]; // backwards wherever it goes
      flows.push({
        ...base,
        passive: true,
        oneway: f.law === 'oneway',
        a: nodeIx.get(from),
        b: nodeIx.get(to),
        g: f.g,
        d: f.law === 'oneway' ? f.drop : 0,
        sub: subIx.get(nodes[nodeIx.get(from)].substance),
      });
    }
    for (const g of x.part.gates) {
      gates.push({ flow: g.flow, by: nodeIx.get(own(i, g.by)), open: g.open, at: g.at, band: g.band, part: i, stuck: made.stuck.get(g.flow) ?? null });
    }
    for (const r of x.part.ratings) {
      ratings.push({ ...r, flow: r.flow === undefined ? undefined : r.flow + tag, node: r.node === undefined ? undefined : own(i, r.node), part: i });
    }
  });

  const flowIx = new Map(flows.map((f, i) => [f.id, i]));
  gates.forEach((g, gi) => flows[flowIx.get(g.flow)].gates.push(gi));
  for (const r of ratings) {
    r.flowIx = r.flow !== undefined ? flowIx.get(r.flow) : -1;
    r.nodeIx = r.node !== undefined ? nodeIx.get(r.node) : -1;
  }

  const kind = new Uint8Array(N);
  const capacity = new Float64Array(N);
  const max = new Float64Array(N).fill(Infinity);
  const here = new Uint8Array(N);
  const A = new Float64Array(N);
  const L = new Float64Array(N).fill(NaN);
  nodes.forEach((n, i) => {
    here[i] = !holder.has(n.id) || present[holder.get(n.id)] ? 1 : 0;
    kind[i] = n.kind === 'store' ? STORE : n.kind === 'fixed' ? FIXED : JUNCTION;
    if (kind[i] === STORE) {
      capacity[i] = n.capacity;
      if (n.max !== null) max[i] = n.max;
    }
    if (!here[i]) return;
    if (kind[i] === STORE) {
      A[i] = Math.min(n.start * startScale[i], max[i]);
      L[i] = A[i] / capacity[i];
    } else if (kind[i] === FIXED) {
      L[i] = n.level;
    }
  });

  // The networks the level solve runs over: per substance, its passive
  // flows and its stores and junctions.
  const nets = system.substances.map((sub, si) => ({
    flows: flows.map((f, fi) => (f.passive && f.sub === si ? fi : -1)).filter((fi) => fi >= 0),
    nodes: nodes.map((n, i) => (n.substance === sub.id && kind[i] !== FIXED ? i : -1)).filter((i) => i >= 0),
  }));
  const reacts = flows.map((f, fi) => (f.passive ? -1 : fi)).filter((fi) => fi >= 0);
  const consumers = Array.from({ length: N }, () => []);
  const producers = Array.from({ length: N }, () => []);
  for (const fi of reacts) {
    for (const [n] of flows[fi].ins) if (kind[n] === STORE) consumers[n].push(fi);
    for (const [n] of flows[fi].outs) if (kind[n] === STORE) producers[n].push(fi);
  }
  const rationed = nodes.map((_, i) => i).filter((i) => kind[i] === STORE && (consumers[i].length || producers[i].length));

  return { system, nodes, parts: insts, instIx, present, broken, flows, gates, ratings, kind, capacity, max, here, A, L, nets, reacts, consumers, producers, rationed, nodeIx, flowIx };
}

// Why a flow may not run right now, or null when it may. The reasons are
// the cascade's words: the solver says why, the page says it to the kid.
function whyNot(M, fi, gateOpen) {
  const f = M.flows[fi];
  if (!M.present[f.part]) return { out: M.parts[f.part].id };
  if (M.broken[f.part]) return { broken: M.parts[f.part].id };
  if (f.blocked) return { blocked: f.id };
  const touched = f.passive ? [f.a, f.b] : [...f.ins.map(([n]) => n), ...f.outs.map(([n]) => n), ...f.by];
  for (const n of touched) if (!M.here[n]) return { gone: M.nodes[n].id };
  for (const need of f.needs) {
    if (need.part !== undefined) {
      if (!(need.part ?? []).some((i) => M.present[i] && !M.broken[i])) return { missing: need.name };
      continue;
    }
    const id = M.nodes[need.node].id;
    if (!M.here[need.node]) return { gone: id };
    const v = M.L[need.node];
    if (need.atLeast !== null && !(v >= need.atLeast)) return { low: id, atLeast: need.atLeast };
    if (need.atMost !== null && !(v <= need.atMost)) return { high: id, atMost: need.atMost };
  }
  for (const gi of f.gates) {
    const g = M.gates[gi];
    if (!M.present[g.part]) continue; // a pulled gate holds nothing back
    if (M.broken[g.part] || g.stuck === 'shut' || (g.stuck !== 'open' && !gateOpen[gi])) return { gate: M.parts[g.part].id };
  }
  return null;
}

// Step 2: the machines, rationed. Returns nothing; fills rate[], bind[]
// and the per-node source s[] (amount per time).
function ration(M, why, dt, rate, bind, s) {
  const { flows, A, kind, max } = M;
  s.fill(0);
  const want = new Map();
  const x = new Map();
  for (const fi of M.reacts) {
    rate[fi] = 0;
    bind[fi] = null;
    if (why[fi] !== null) continue;
    let r = flows[fi].rate;
    for (const n of flows[fi].by) r *= A[n];
    if (!(r > 0)) {
      // nothing to work on: the helper it counts is empty
      const empty = flows[fi].by.find((n) => !(A[n] > 0));
      bind[fi] = { idle: empty === undefined ? true : empty };
      continue;
    }
    want.set(fi, r);
    x.set(fi, 1);
  }
  const inflow = new Float64Array(A.length);
  const outflow = new Float64Array(A.length);
  for (let iter = 0; iter < 64; iter++) {
    inflow.fill(0);
    outflow.fill(0);
    for (const [fi, r0] of want) {
      const r = r0 * x.get(fi);
      for (const [n, k] of flows[fi].ins) outflow[n] += r * k;
      for (const [n, k] of flows[fi].outs) inflow[n] += r * k;
    }
    // Per store, the factor its machines must slow by; each machine
    // takes the smallest factor of any store it touches.
    const cut = new Map();
    const cutBy = new Map();
    const tighten = (fi, k, why) => {
      if (k < (cut.get(fi) ?? 1)) {
        cut.set(fi, k);
        cutBy.set(fi, why);
      }
    };
    for (const n of M.rationed) {
      if (kind[n] !== STORE || !M.here[n]) continue;
      const need = dt * outflow[n];
      const avail = A[n] + dt * inflow[n];
      if (need > avail * (1 + 1e-12) + 1e-300) {
        const k = Math.max(0, avail / need);
        for (const fi of M.consumers[n]) if (want.has(fi)) tighten(fi, k, { dry: n });
      }
      const supply = dt * inflow[n];
      const room = max[n] - A[n] + dt * outflow[n];
      if (supply > Math.max(0, room) * (1 + 1e-12) + 1e-300) {
        const k = Math.max(0, room) / supply;
        for (const fi of M.producers[n]) if (want.has(fi)) tighten(fi, k, { full: n });
      }
    }
    if (cut.size === 0) break;
    for (const [fi, k] of cut) {
      x.set(fi, x.get(fi) * k);
      bind[fi] = cutBy.get(fi);
    }
  }
  for (const [fi, r0] of want) {
    const r = r0 * x.get(fi);
    rate[fi] = r;
    for (const [n, k] of flows[fi].ins) s[n] -= r * k;
    for (const [n, k] of flows[fi].outs) s[n] += r * k;
  }
}

// Step 3: the levels of one substance's network. With storesKnown the
// stores hold their levels and only junctions are solved — how the run
// finds its junctions' levels before the first step.
function solveNet(M, net, why, on, dt, s, storesKnown, value, diag) {
  const { flows, kind, capacity, here, L } = M;
  if (net.flows.length === 0) {
    // Nothing conducts in this substance: each store just takes its
    // machines' source (the same answer the solve below would give).
    if (storesKnown) return;
    for (const n of net.nodes) {
      if (!here[n]) continue;
      if (kind[n] === JUNCTION) {
        L[n] = NaN;
        continue;
      }
      let a = M.A[n] + dt * s[n];
      if (a < 0) {
        diag.clamped += -a;
        a = 0;
      }
      M.A[n] = a;
      L[n] = a / capacity[n];
    }
    return;
  }
  const unknown = net.nodes.filter((n) => here[n] && (!storesKnown || kind[n] === JUNCTION));
  const local = new Map(unknown.map((n, i) => [n, i]));
  const oneways = net.flows.filter((fi) => flows[fi].oneway && why[fi] === null && flows[fi].g > 0);
  const tried = new Set();
  let level = null;
  const maxIter = 4 + 2 * oneways.length;
  for (let iter = 0; ; iter++) {
    const links = net.flows.filter((fi) => why[fi] === null && flows[fi].g > 0 && (!flows[fi].oneway || on[fi]));
    level = solveLevels(M, unknown, local, links, dt, s, storesKnown);
    let changed = false;
    for (const fi of oneways) {
      const f = flows[fi];
      const va = level.get(f.a) ?? L[f.a];
      const vb = level.get(f.b) ?? L[f.b];
      const tol = 1e-9 * Math.max(1, Math.abs(va), Math.abs(vb), f.d);
      if (on[fi]) {
        if (Number.isFinite(va) && Number.isFinite(vb) && va - vb - f.d < -tol) {
          on[fi] = 0;
          changed = true;
        }
      } else if (!Number.isFinite(va) || !Number.isFinite(vb)) {
        // A floating end has no level to judge by: try it on, once.
        if (!tried.has(fi)) {
          tried.add(fi);
          on[fi] = 1;
          changed = true;
        }
      } else if (va - vb - f.d > tol) {
        on[fi] = 1;
        changed = true;
      }
    }
    if (!changed) break;
    if (iter >= maxIter) {
      diag.unsettled++;
      break;
    }
  }
  for (const n of unknown) {
    let v = level.get(n);
    if (kind[n] === STORE) {
      if (v < 0) {
        diag.clamped += -v * capacity[n];
        v = 0;
      }
      M.A[n] = v * capacity[n];
    }
    L[n] = v;
  }
  for (const fi of net.flows) {
    const f = flows[fi];
    if (why[fi] !== null || !(f.g > 0) || (f.oneway && !on[fi])) {
      value[fi] = 0;
      continue;
    }
    const q = f.g * (L[f.a] - L[f.b] - f.d);
    value[fi] = Number.isFinite(q) ? (f.oneway ? Math.max(0, q) : q) : 0;
  }
}

// One backward-Euler solve over the given conducting links. Returns
// node → new level for the unknowns; a network with nothing to hold its
// level (junctions joined only to each other) floats, and reads NaN.
function solveLevels(M, unknown, local, links, dt, s, storesKnown) {
  const { flows, kind, capacity, L } = M;
  const parent = unknown.map((_, i) => i);
  const root = (i) => {
    while (parent[i] !== i) i = parent[i] = parent[parent[i]];
    return i;
  };
  const anchored = new Uint8Array(unknown.length);
  for (const fi of links) {
    const f = flows[fi];
    const ia = local.get(f.a);
    const ib = local.get(f.b);
    if (ia !== undefined && ib !== undefined) parent[root(ia)] = root(ib);
  }
  unknown.forEach((n, i) => {
    if (!storesKnown && kind[n] === STORE) anchored[root(i)] = 1;
  });
  for (const fi of links) {
    const f = flows[fi];
    const ia = local.get(f.a);
    const ib = local.get(f.b);
    if (ia !== undefined && ib === undefined) anchored[root(ia)] = 1;
    if (ib !== undefined && ia === undefined) anchored[root(ib)] = 1;
  }
  const groups = new Map();
  unknown.forEach((n, i) => {
    const r = root(i);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r).push(n);
  });
  const out = new Map();
  for (const [r, members] of groups) {
    if (!anchored[r]) {
      for (const n of members) out.set(n, NaN);
      continue;
    }
    const at = new Map(members.map((n, i) => [n, i]));
    const m = members.length;
    const Mx = Array.from({ length: m }, () => new Float64Array(m));
    const b = new Float64Array(m);
    members.forEach((n, i) => {
      if (!storesKnown && kind[n] === STORE) {
        const c = capacity[n] / dt;
        Mx[i][i] += c;
        b[i] += c * L[n];
      }
      b[i] += s[n];
    });
    for (const fi of links) {
      const f = flows[fi];
      const ia = at.has(f.a) ? at.get(f.a) : -1;
      const ib = at.has(f.b) ? at.get(f.b) : -1;
      if (ia < 0 && ib < 0) continue;
      // flow a→b = g·(La − Lb − d); each row is −(what flows in).
      if (ia >= 0) {
        Mx[ia][ia] += f.g;
        if (ib >= 0) Mx[ia][ib] -= f.g;
        else b[ia] += f.g * L[f.b];
        b[ia] += f.g * f.d;
      }
      if (ib >= 0) {
        Mx[ib][ib] += f.g;
        if (ia >= 0) Mx[ib][ia] -= f.g;
        else b[ib] += f.g * L[f.a];
        b[ib] -= f.g * f.d;
      }
    }
    const xs = solveLinear(Mx, b);
    members.forEach((n, i) => out.set(n, xs ? xs[i] : NaN));
  }
  return out;
}

// A goal check against the run as it stands.
function checkPasses(M, check, value) {
  if (check.part !== undefined) {
    const pi = M.instIx.get(check.part);
    return M.present[pi] && !M.broken[pi];
  }
  const v = check.read.node !== undefined ? M.L[M.nodeIx.get(check.read.node)] : Math.abs(value[M.flowIx.get(check.read.flow)]);
  return (check.above === null || v > check.above) && (check.below === null || v < check.below);
}

function checkValue(M, check, value) {
  if (check.part !== undefined) return null;
  return check.read.node !== undefined ? M.L[M.nodeIx.get(check.read.node)] : Math.abs(value[M.flowIx.get(check.read.flow)]);
}

const STOP_REASONS = ['missing', 'gone', 'low', 'high', 'dry'];
const stopReason = (why, bind) => {
  for (const k of STOP_REASONS) if (why && k in why) return why;
  if (bind && 'dry' in bind) return bind;
  return null;
};

// Run the system on the bench for the system's run length.
//   samples  how many points of the record to keep for drawing (the
//            stats and the measure use every step regardless)
//   normal   flow id → what it carries as shipped (normalsOf), so the
//            cascade can say which flows stopped
// Returns the verdict, when and how it failed, what broke, the cascade's
// events, the record, the measure's reading, and the bench as the run
// left it (broken parts stay broken).
export function runSystem(system, bench = {}, { samples = 240, normal = null } = {}) {
  const M = assemble(system, bench);
  const { flows, gates, ratings, nodes } = M;
  const F = flows.length;
  const N = nodes.length;
  const dt = system.time.step;
  const steps = Math.max(1, Math.ceil(system.time.run / dt - 1e-9));
  const why = new Array(F).fill(null);
  const on = new Uint8Array(F).fill(1);
  const rate = new Float64Array(F);
  const bind = new Array(F).fill(null);
  const value = new Float64Array(F);
  const s = new Float64Array(N);
  const overload = new Float64Array(ratings.length);
  const gateOpen = new Uint8Array(gates.length);
  const diag = { clamped: 0, unsettled: 0 };
  const events = changes(system, bench).map((c) => ({ t: 0, kind: 'changed', ...c }));
  const stopped = new Uint8Array(F);
  const running = new Uint8Array(F);
  const broke = [];

  const updateGates = (fresh) => {
    gates.forEach((g, gi) => {
      const v = M.L[g.by];
      if (!Number.isFinite(v)) gateOpen[gi] = 0;
      else if (g.open === 'above') gateOpen[gi] = !fresh && gateOpen[gi] ? (v >= g.at - g.band ? 1 : 0) : v > g.at ? 1 : 0;
      else gateOpen[gi] = !fresh && gateOpen[gi] ? (v <= g.at + g.band ? 1 : 0) : v < g.at ? 1 : 0;
    });
  };

  // The junctions' levels before the first step, with every store as it
  // starts, so needs and gates can read them from the first moment.
  gateOpen.fill(1);
  for (let fi = 0; fi < F; fi++) why[fi] = whyNot(M, fi, gateOpen);
  s.fill(0);
  for (const net of M.nets) solveNet(M, net, why, on, dt, s, true, value, diag);
  updateGates(true);

  // The record: every node's level and every flow's value, sampled.
  const every = Math.max(1, Math.ceil(steps / samples));
  const trace = { t: [0], nodes: {}, flows: {} };
  nodes.forEach((n, i) => (trace.nodes[n.id] = [M.L[i]]));
  flows.forEach((f) => (trace.flows[f.id] = [0]));
  const stat = (v) => ({ min: v, max: v, end: v, sum: 0, n: 0 });
  const nodeStats = nodes.map((_, i) => stat(M.L[i]));
  const flowStats = flows.map(() => null);
  const fold = (st, v) => {
    if (!Number.isFinite(v)) return st;
    if (!st || !Number.isFinite(st.min)) st = stat(v);
    st.min = Math.min(st.min, v);
    st.max = Math.max(st.max, v);
    st.end = v;
    st.sum += v;
    st.n += 1;
    return st;
  };

  let failedAt = null;
  let failure = null;
  const checks = system.goal.checks;

  for (let k = 0; k < steps; k++) {
    // Model time on a clean grid: 0.1 × 81 is 8.1, not 8.100000000000001.
    const t = Number(((k + 1) * dt).toFixed(9));
    for (let fi = 0; fi < F; fi++) why[fi] = whyNot(M, fi, gateOpen);
    ration(M, why, dt, rate, bind, s);
    // Every store sits in its substance's network, so a store no flow
    // conducts to is a network of one and simply takes its source.
    for (const net of M.nets) solveNet(M, net, why, on, dt, s, false, value, diag);
    for (const fi of M.reacts) value[fi] = rate[fi];

    // The cascade: a flow that stops, said once, with its reason. Given
    // what each flow carries in the system as shipped (`normal`), a flow
    // has stopped when it falls under 1% of that — an open loop, a light
    // with too little push, a machine with nothing to work on. Without
    // it, only a flow with a reason it cannot run counts.
    for (let fi = 0; fi < F; fi++) {
      const f = flows[fi];
      const w = why[fi];
      const ref = normal?.[f.id] ?? 0;
      const now = ref > 0 ? Math.abs(value[fi]) >= 0.01 * ref : f.passive ? w === null : rate[fi] > 1e-12;
      const said = w && ('out' in w || 'broken' in w || 'blocked' in w || 'gate' in w); // the change, the break, or a valve doing its job
      if (!stopped[fi] && !now && !said && M.present[f.part]) {
        let reason = stopReason(w, f.passive ? null : bind[fi]);
        if (!reason && ref > 0) reason = !f.passive && bind[fi]?.idle ? { idle: bind[fi].idle } : f.passive ? { open: true } : { slow: true };
        if (reason && (running[fi] || k === 0) && (ref > 0 || !('dry' in reason) || running[fi])) {
          stopped[fi] = 1;
          // It was judged at the start of this step: that is when it stopped.
          events.push({ t: Number((t - dt).toFixed(9)), kind: 'stopped', flow: f.id, part: M.parts[f.part].id, why: named(M, reason) });
        }
      }
      running[fi] = now ? 1 : 0;
    }

    // Ratings: pushed too far for too long, and it breaks.
    ratings.forEach((r, ri) => {
      const pi = r.part;
      if (!M.present[pi] || M.broken[pi]) return;
      const v = r.flowIx >= 0 ? Math.abs(value[r.flowIx]) : M.L[r.nodeIx];
      if (!Number.isFinite(v)) return;
      const over = (r.above !== null && v > r.above) || (r.below !== null && v < r.below);
      overload[ri] = over ? overload[ri] + dt : 0;
      if (over && overload[ri] > r.for) {
        M.broken[pi] = 1;
        broke.push({ part: M.parts[pi].id, t });
        events.push({ t, kind: 'broke', part: M.parts[pi].id, rating: r.flow !== undefined ? { flow: r.flow, above: r.above } : { node: r.node, above: r.above, below: r.below }, value: v });
      }
    });

    updateGates(false);

    for (let i = 0; i < N; i++) fold(nodeStats[i], M.L[i]);
    for (let fi = 0; fi < F; fi++) flowStats[fi] = fold(flowStats[fi], Math.abs(value[fi]));

    if (failedAt === null) {
      for (let c = 0; c < checks.length; c++) {
        const check = checks[c];
        if (check.when === 'end' && k < steps - 1) continue;
        if (!checkPasses(M, check, value)) {
          failedAt = t;
          failure = { check: c, value: checkValue(M, check, value) };
          events.push({ t, kind: 'goal', check: c, value: failure.value });
          break;
        }
      }
    }

    if (k === 0) flows.forEach((f, fi) => (trace.flows[f.id][0] = value[fi]));
    if ((k + 1) % every === 0 || k === steps - 1) {
      trace.t.push(t);
      nodes.forEach((n, i) => trace.nodes[n.id].push(M.L[i]));
      flows.forEach((f, fi) => trace.flows[f.id].push(value[fi]));
    }
  }

  // min, max, end, and the mean over every step (a level held by a
  // thermostat swings; its mean is what it was held at)
  const out = (st) => (st ? { min: st.min, max: st.max, end: st.end, mean: st.n ? st.sum / st.n : st.end } : { min: 0, max: 0, end: 0, mean: 0 });
  const statsOut = { node: {}, flow: {} };
  nodes.forEach((n, i) => (statsOut.node[n.id] = out(nodeStats[i])));
  flows.forEach((f, fi) => (statsOut.flow[f.id] = out(flowStats[fi])));
  events.sort((a, b) => a.t - b.t);
  return {
    system: system.id,
    bench: benchKey(system, bench),
    verdict: failedAt === null ? 'works' : 'fails',
    failedAt,
    failure,
    broke,
    events: events.slice(0, 60),
    stats: statsOut,
    reading: reading(system, statsOut, failedAt, steps * dt),
    trace,
    after: withBroken(system, bench, broke.map((b) => b.part)),
    time: { dt, steps, end: steps * dt },
    diag,
  };
}

// Reasons carry node indexes inside the solver; outside they are ids.
function named(M, reason) {
  if ('dry' in reason && typeof reason.dry === 'number') return { dry: M.nodes[reason.dry].id };
  if ('idle' in reason && typeof reason.idle === 'number') return { idle: M.nodes[reason.idle].id };
  return reason;
}

// What each flow carries in a run, at most: the `normal` a run on a
// changed bench measures its stops against.
export function normalsOf(result) {
  return Object.fromEntries(Object.entries(result.stats.flow).map(([id, st]) => [id, st.max]));
}

// The instrument's reading of a finished run, on its own grid: clamped
// to the scale, and pinned at the top when the truth is past it, like a
// real scale at its stop (decisions 2026-10-24 §3, the same rule).
export function reading(system, stats, failedAt, end) {
  const m = system.measure;
  if (!m) return null;
  let raw;
  if (m.read.lasts) raw = failedAt ?? end;
  else raw = (m.read.node !== undefined ? stats.node[m.read.node] : stats.flow[m.read.flow])[m.read.stat];
  if (!Number.isFinite(raw)) raw = 0;
  const maxed = m.read.lasts ? failedAt === null : raw > m.max;
  const clamped = Math.min(Math.max(raw, 0), m.max);
  const value = Number((Math.round(clamped / m.resolution) * m.resolution).toFixed(9));
  return { value, raw, maxed };
}
