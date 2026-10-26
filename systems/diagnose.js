// "Something's wrong": troubleshooting, the mechanic's and the doctor's
// whole job, and the plainest form of the claim this repo makes — know
// when you don't know, and know what check to run (2026-10-19 §1).
//
// The system arrives with a part secretly bad: one fault, chosen so the
// symptom shows (the goal fails). The kid reads gauges — a probe is the
// honest reading of the run, part by part, next to what that part reads
// when the system is healthy, the way a service manual says what a
// healthy one should read — then swaps parts for good ones, calling
// before each swap whether it will fix it. A fault that broke something
// on its way (a wire for a resistor burns the light) stays a two-part
// fix: replace the light alone and the new one burns too.

import { runSystem } from './solve.js';
import { swapBad, instanceOf } from './system.js';
import { makeRng } from './seed.js';

// Every hidden fault with a symptom: one bad part that makes the system
// as shipped fail its goal. A system with a spare for everything has
// none, so then pairs of bad parts — which is its own lesson.
export function mysteries(system) {
  const fails = (bench) => runSystem(system, bench, { samples: 2 }).verdict === 'fails';
  const all = system.parts.flatMap((p) => p.faults.map((f) => ({ part: p.id, fault: f.id })));
  const singles = all.filter((m) => fails(swapBad(system, {}, m.part, m.fault))).map((m) => [m]);
  if (singles.length) return singles;
  const pairs = [];
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      if (all[i].part === all[j].part) continue;
      if (fails(swapBad(system, swapBad(system, {}, all[i].part, all[i].fault), all[j].part, all[j].fault))) pairs.push([all[i], all[j]]);
    }
  }
  return pairs;
}

// One mystery, the seed's: same seed, same mystery.
export function pickMystery(system, seed, pool = mysteries(system)) {
  if (!pool.length) return null;
  return pool[Math.floor(makeRng(`mystery:${seed}`)() * pool.length)];
}

export function mysteryBench(system, mystery) {
  return mystery.reduce((b, m) => swapBad(system, b, m.part, m.fault), {});
}

const nearest = (ts, t) => {
  let best = 0;
  for (let i = 1; i < ts.length; i++) if (Math.abs(ts[i] - t) < Math.abs(ts[best] - t)) best = i;
  return best;
};

// A probe: everything a meter on this part reads at time t (by default
// the moment the symptom showed, or the end), beside what it reads in
// the healthy system at the same moment.
export function probe(system, result, healthy, id, { at = null } = {}) {
  const { part, copy } = instanceOf(system, id);
  const tag = copy === null ? '' : `#${copy}`;
  const t = at ?? result.failedAt ?? result.time.end;
  const i = nearest(result.trace.t, t);
  const h = nearest(healthy.trace.t, t);
  const readings = [];
  for (const f of part.flows) {
    readings.push({ kind: 'flow', id: f.id + tag, value: result.trace.flows[f.id + tag]?.[i] ?? 0, normal: healthy.trace.flows[f.id]?.[h] ?? 0 });
  }
  const nodes = new Set(part.holds);
  for (const f of part.flows) {
    if (f.law === 'react') [...Object.keys(f.inputs), ...Object.keys(f.outputs)].forEach((n) => nodes.add(n));
    else [f.from, f.to].forEach((n) => nodes.add(n));
  }
  for (const n of nodes) {
    const mine = part.holds.includes(n) && copy !== null ? `${n}#${copy}` : n;
    readings.push({ kind: 'node', id: mine, value: result.trace.nodes[mine]?.[i] ?? NaN, normal: healthy.trace.nodes[n]?.[h] ?? NaN });
  }
  return { part: id, t: result.trace.t[i], readings };
}
