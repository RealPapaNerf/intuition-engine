// Pull It Apart's drawing (decisions 2026-10-26 §9): a system as a
// diagram a kid can read and touch. Parts are cards you can tap; stores
// are jars that fill and empty; every flow is a line in its substance's
// colour whose dots move as fast as the stuff does, compared with how
// fast it moves in the system as shipped — so "it slowed down" and "it
// stopped" are things you see before you read them. Things nobody can
// see in the real one — the waste in the blood, the charge in a
// battery, the heat in an engine — are drawn, because novices reason
// about the parts they can see and miss the invisible ones (Hmelo-Silver
// and colleagues, 2007).
//
// SVG, so every part is a real element that a finger, a mouse or a
// screen reader can find. Nothing here decides anything: it draws a
// frame of a run the solver already made (systems/solve.js), or the
// bench before any run at all (wiring()).

import { wiring, instanceOf, partState, partName } from '../systems/index.js';

const NS = 'http://www.w3.org/2000/svg';
const CW = 156; // a grid column, in drawing units
const RH = 124; // a grid row
const PAD = 84;
const CARD = { w: 124, h: 72 };

function el(name, attrs = {}, parent = null) {
  const e = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== null) e.setAttribute(k, String(v));
  if (parent) parent.appendChild(e);
  return e;
}

// A number a kid can read: three figures, thousands spaced, units on.
export function fmt(v, unit = '') {
  if (!Number.isFinite(v)) return '—';
  const a = Math.abs(v);
  let s;
  if (a >= 1000) s = Math.round(v).toLocaleString('en-US');
  else if (a >= 100) s = v.toFixed(0);
  else if (a >= 10) s = v.toFixed(1);
  else if (a >= 1) s = v.toFixed(2);
  else if (a === 0) s = '0';
  else s = v.toPrecision(2);
  return unit ? `${s} ${unit}` : s;
}

// Two lines at most, broken at spaces.
function wrap(text, width) {
  const words = String(text).split(/\s+/);
  const lines = [''];
  for (const w of words) {
    const cur = lines[lines.length - 1];
    if (!cur) lines[lines.length - 1] = w;
    else if ((cur + ' ' + w).length <= width) lines[lines.length - 1] = `${cur} ${w}`;
    else lines.push(w);
  }
  if (lines.length > 2) lines.splice(2, lines.length - 2, `${lines[1]}…`.slice(0, width));
  return lines;
}

const gridPos = (at) => ({ x: PAD + at[0] * CW, y: PAD + at[1] * RH });

// Where everything goes for this bench: parts at their places (a moved
// part beside or after the part whose spot it took, a copy just below
// its first), stores at theirs, and anything unplaced among what it
// connects.
export function layout(system, bench) {
  const w = wiring(system, bench);
  const parts = new Map();
  const taken = [];
  const free = (xy) => taken.every((t) => Math.abs(t.x - xy.x) > CARD.w + 10 || Math.abs(t.y - xy.y) > CARD.h + 10);
  // Parts in their own places first; then copies and moved parts, each
  // in the first free spot around the part it went beside or after.
  const later = [];
  for (const p of w.parts) {
    const { part, copy } = instanceOf(system, p.id);
    const state = partState(system, bench, p.id);
    if (state.at || copy !== null) {
      later.push({ p, part, state, copy });
      continue;
    }
    const xy = gridPos(part.at);
    taken.push(xy);
    parts.set(p.id, { ...p, part, state, x: xy.x, y: xy.y });
  }
  for (const n of system.nodes) if (n.at) taken.push(gridPos(n.at));
  const around = (how) =>
    how === 'inline'
      ? [[0.8, 0.25], [-0.8, 0.25], [0.8, -0.25], [-0.8, -0.25], [0, 0.75], [0, -0.75], [1.6, 0.25], [-1.6, 0.25]]
      : [[0, 0.7], [0, -0.7], [0.8, 0.45], [-0.8, 0.45], [0.8, -0.45], [-0.8, -0.45], [0, 1.4], [1.6, 0], [-1.6, 0]];
  for (const { p, part, state, copy } of later) {
    const anchorPart = state.at ? state.at.part : part.id;
    const anchor = parts.get(anchorPart) ?? gridPos(instanceOf(system, anchorPart).part.at);
    const spots = around(state.at?.how ?? 'beside').map(([dx, dy]) => ({ x: anchor.x + dx * CW, y: anchor.y + dy * RH }));
    const xy = spots.find(free) ?? { x: anchor.x + 20 * (copy ?? 1), y: anchor.y + RH * 0.7 };
    taken.push(xy);
    parts.set(p.id, { ...p, part, state, x: xy.x, y: xy.y });
  }
  const nodes = new Map();
  const touching = new Map();
  for (const f of w.flows) {
    for (const n of [f.from, f.to, ...f.inputs.map(([k]) => k), ...f.outputs.map(([k]) => k), ...f.by]) {
      if (!n) continue;
      if (!touching.has(n)) touching.set(n, new Set());
      touching.get(n).add(f.part);
    }
  }
  for (const n of w.nodes) {
    if (n.held) {
      const h = parts.get(n.held);
      nodes.set(n.id, { ...n, x: h.x, y: h.y, inCard: true });
      continue;
    }
    let xy = n.at ? gridPos(n.at) : null;
    if (!xy) {
      const near = [...(touching.get(n.id) ?? [])].map((id) => parts.get(id)).filter(Boolean);
      xy = near.length ? { x: near.reduce((s, p) => s + p.x, 0) / near.length, y: near.reduce((s, p) => s + p.y, 0) / near.length + 30 } : { x: PAD, y: PAD };
    }
    nodes.set(n.id, { ...n, x: xy.x, y: xy.y, inCard: false });
  }
  const all = [...parts.values(), ...nodes.values()];
  const minX = Math.min(...all.map((a) => a.x)) - CARD.w / 2 - 34;
  const maxX = Math.max(...all.map((a) => a.x)) + CARD.w / 2 + 34;
  const minY = Math.min(...all.map((a) => a.y)) - CARD.h / 2 - 30;
  const maxY = Math.max(...all.map((a) => a.y)) + CARD.h / 2 + 46;
  return { w, parts, nodes, box: { x: minX, y: minY, w: maxX - minX, h: maxY - minY } };
}

// A gentle curve from a to b, bent a little so lines that share two ends
// stay apart. Returns the path and a function giving the point at u.
function curve(a, b, bend) {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const c = { x: mx - (dy / len) * bend, y: my + (dx / len) * bend };
  const at = (u) => ({
    x: (1 - u) * (1 - u) * a.x + 2 * (1 - u) * u * c.x + u * u * b.x,
    y: (1 - u) * (1 - u) * a.y + 2 * (1 - u) * u * c.y + u * u * b.y,
  });
  return { d: `M${a.x.toFixed(1)},${a.y.toFixed(1)} Q${c.x.toFixed(1)},${c.y.toFixed(1)} ${b.x.toFixed(1)},${b.y.toFixed(1)}`, at, len };
}

// Where a line meets a card: on its edge, toward the other end.
function edgeOf(card, toward) {
  const dx = toward.x - card.x;
  const dy = toward.y - card.y;
  if (!dx && !dy) return { x: card.x, y: card.y };
  const sx = CARD.w / 2 / Math.abs(dx || 1e-9);
  const sy = CARD.h / 2 / Math.abs(dy || 1e-9);
  const s = Math.min(sx, sy);
  return { x: card.x + dx * s, y: card.y + dy * s };
}

// The diagram itself. onPick({ part }) or onPick({ flow }) when a part or
// a line is tapped. `normal` is what each flow carries as shipped, so a
// dot's speed means "faster or slower than usual"; `scales` is how full
// a jar is drawn at each level.
export function makeDiagram(svg, system, { onPick = () => {}, normal = {}, scales = {}, hideFaults = false } = {}) {
  let L = null;
  let edges = [];
  let cards = new Map();
  let gauges = new Map();
  let frame = { levels: {}, flows: {}, broken: new Set() };
  let pickable = null; // null = everything, or a Set of part ids
  let selected = null;
  const subColor = new Map(system.substances.map((s) => [s.id, s.color]));
  const unitOf = (nodeId) => {
    const n = L.nodes.get(nodeId);
    return system.substances.find((s) => s.id === n.substance)?.level ?? '';
  };
  const normalOf = (flowId) => normal[flowId] ?? normal[flowId.replace(/#\d+$/, '')] ?? 0;

  function build(bench) {
    L = layout(system, bench);
    svg.replaceChildren();
    svg.setAttribute('viewBox', `${L.box.x} ${L.box.y} ${L.box.w} ${L.box.h}`);
    // A small system draws at a little over life size, not blown up to the page.
    svg.style.maxWidth = `${Math.round(Math.max(L.box.w * 1.3, 680))}px`;
    svg.style.margin = '0 auto';
    el('rect', { x: L.box.x, y: L.box.y, width: L.box.w, height: L.box.h, class: 'board' }, svg);
    const gLines = el('g', { class: 'lines' }, svg);
    const gDots = el('g', { class: 'dots' }, svg);
    const gNodes = el('g', { class: 'nodes' }, svg);
    const gCards = el('g', { class: 'cards' }, svg);
    edges = [];
    cards = new Map();
    gauges = new Map();

    // Lines: each flow runs node → part → node; a machine's inputs come
    // in and its outputs go out; a store a part holds is inside its card.
    const pairCount = new Map();
    const point = (nodeId, toward) => {
      const n = L.nodes.get(nodeId);
      if (n.inCard) return edgeOf(L.parts.get(n.held), toward);
      return { x: n.x, y: n.y };
    };
    const addEdge = (flow, fromPt, toPt, sub, kind) => {
      const key = [Math.round(fromPt.x), Math.round(fromPt.y), Math.round(toPt.x), Math.round(toPt.y)].join(':');
      const n = pairCount.get(key) ?? 0;
      pairCount.set(key, n + 1);
      const c = curve(fromPt, toPt, 10 + n * 14);
      const color = kind === 'flow' ? subColor.get(sub) ?? '#6b6354' : '#9a8f7a';
      const path = el('path', { d: c.d, class: `line ${kind}`, stroke: color }, gLines);
      const hit = el('path', { d: c.d, class: 'hit' }, gLines);
      if (kind === 'flow') {
        hit.addEventListener('click', (e) => {
          e.stopPropagation();
          onPick({ flow: flow.id });
        });
      }
      const dots = kind === 'flow' ? [0, 1, 2].map(() => el('circle', { r: 3.6, fill: color, class: 'dot' }, gDots)) : [];
      edges.push({ flow, path, curve: c, dots, phase: Math.random(), kind });
    };
    for (const f of L.w.flows) {
      const card = L.parts.get(f.part);
      if (!card) continue;
      const mine = (nodeId) => L.nodes.get(nodeId)?.held === f.part;
      if (f.passive) {
        const sub = L.nodes.get(f.from).substance;
        if (!mine(f.from)) addEdge(f, point(f.from, card), edgeOf(card, point(f.from, card)), sub, 'flow');
        if (!mine(f.to)) addEdge(f, edgeOf(card, point(f.to, card)), point(f.to, card), sub, 'flow');
      } else {
        for (const [n] of f.inputs) if (!mine(n)) addEdge(f, point(n, card), edgeOf(card, point(n, card)), L.nodes.get(n).substance, 'flow');
        for (const [n] of f.outputs) if (!mine(n)) addEdge(f, edgeOf(card, point(n, card)), point(n, card), L.nodes.get(n).substance, 'flow');
        for (const n of f.by) if (!mine(n) && !f.inputs.some(([k]) => k === n)) addEdge(f, point(n, card), edgeOf(card, point(n, card)), null, 'helper');
      }
      for (const need of f.needs) {
        if (need.part) {
          for (const p of L.parts.values()) if (p.base === need.part && p.id !== f.part) addEdge(f, edgeOf(p, card), edgeOf(card, p), null, 'need');
        }
      }
      for (const gp of f.gates) {
        const g = L.parts.get(gp);
        if (g && gp !== f.part) addEdge(f, edgeOf(g, card), edgeOf(card, g), null, 'gate');
      }
    }

    // Stores, fixed levels and junctions that no card holds.
    for (const n of L.nodes.values()) {
      if (n.inCard || !n.here) continue;
      const g = el('g', { class: `node ${n.kind}`, transform: `translate(${n.x},${n.y})` }, gNodes);
      const title = el('title', {}, g);
      title.textContent = n.name;
      if (n.kind === 'junction') {
        el('circle', { r: 5, class: 'junction' }, g);
        gauges.set(n.id, { g, kind: 'junction' });
        continue;
      }
      const color = subColor.get(n.substance);
      if (n.kind === 'fixed') {
        el('rect', { x: -52, y: -15, width: 104, height: 30, rx: 15, class: 'fixed', stroke: color }, g);
        const t = el('text', { y: -1, class: 'fixed-name' }, g);
        t.textContent = wrap(n.name, 18)[0];
        const v = el('text', { y: 11, class: 'fixed-value' }, g);
        gauges.set(n.id, { g, kind: 'fixed', value: v });
        continue;
      }
      el('rect', { x: -17, y: -26, width: 34, height: 46, rx: 6, class: 'jar' }, g);
      const fill = el('rect', { x: -15, y: 18, width: 30, height: 0, rx: 4, fill: color, class: 'jar-fill' }, g);
      const name = wrap(n.name, 16);
      name.forEach((line, i) => {
        const t = el('text', { y: 34 + i * 12, class: 'jar-name' }, g);
        t.textContent = line;
      });
      const v = el('text', { y: 34 + name.length * 12, class: 'jar-value' }, g);
      gauges.set(n.id, { g, kind: 'store', fill, value: v });
    }

    // Cards.
    for (const p of L.parts.values()) {
      const g = el('g', { class: 'card', transform: `translate(${p.x},${p.y})`, role: 'button', tabindex: 0 }, gCards);
      g.addEventListener('click', (e) => {
        e.stopPropagation();
        onPick({ part: p.id });
      });
      g.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onPick({ part: p.id });
        }
      });
      const box = el('rect', { x: -CARD.w / 2, y: -CARD.h / 2, width: CARD.w, height: CARD.h, rx: 12, class: 'card-box' }, g);
      const icon = el('text', { x: -CARD.w / 2 + 22, y: -4, class: 'card-icon' }, g);
      icon.textContent = p.part.icon;
      wrap(partName(system, p.id), 11).forEach((line, i) => {
        const t = el('text', { x: -CARD.w / 2 + 42, y: -12 + i * 14, class: 'card-name' }, g);
        t.textContent = line;
      });
      const badge = el('text', { x: CARD.w / 2 - 6, y: -CARD.h / 2 + 15, class: 'card-badge' }, g);
      // Stores the card holds: a bar each along the bottom.
      const held = [...L.nodes.values()].filter((n) => n.held === p.id && n.kind === 'store');
      const bars = held.slice(0, 2).map((n, i) => {
        const y = CARD.h / 2 - 15 - i * 13;
        el('rect', { x: -CARD.w / 2 + 8, y, width: CARD.w - 16, height: 9, rx: 4, class: 'bar' }, g);
        const fill = el('rect', { x: -CARD.w / 2 + 8, y, width: 0, height: 9, rx: 4, fill: subColor.get(n.substance), class: 'bar-fill' }, g);
        const v = el('text', { x: CARD.w / 2 - 10, y: y + 8, class: 'bar-value' }, g);
        const t = el('title', {}, g);
        t.textContent = n.name;
        return { node: n.id, fill, value: v, width: CARD.w - 16 };
      });
      cards.set(p.id, { g, box, badge, bars, p });
    }
    svg.onclick = () => onPick({ none: true });
    paint();
  }

  // The frame's numbers onto the drawing.
  function paint() {
    if (!L) return;
    for (const [id, gg] of gauges) {
      const v = frame.levels[id];
      const sc = scales[id] || 1;
      if (gg.kind === 'store') {
        const f = Number.isFinite(v) ? Math.max(0, Math.min(1, v / sc)) : 0;
        gg.fill.setAttribute('y', String(18 - 40 * f));
        gg.fill.setAttribute('height', String(40 * f));
        gg.value.textContent = fmt(v, unitOf(id));
      } else if (gg.kind === 'fixed') {
        gg.value.textContent = fmt(v, unitOf(id));
      } else {
        gg.g.classList.toggle('floating', !Number.isFinite(v));
      }
    }
    for (const [id, c] of cards) {
      const state = c.p.state;
      const broken = frame.broken.has(id) || state.broken;
      const out = !c.p.present;
      // A hidden fault looks like a good part (something's wrong mode);
      // damage, like a burnt-out light, is there for anyone to see.
      const bad = state.as === 'bad' && !hideFaults;
      c.g.classList.toggle('out', out);
      c.g.classList.toggle('bad', bad && !out);
      c.g.classList.toggle('broken', broken && !out);
      c.g.classList.toggle('selected', selected === id);
      c.g.classList.toggle('dim', pickable !== null && !pickable.has(id));
      const spare = out && c.p.copy === null && !c.p.part.installed && state.as === 'out';
      c.badge.textContent = spare ? 'spare' : out ? 'out' : broken ? '💥' : bad ? '⚠️' : c.p.copy ? '+' : '';
      const label = `${partName(system, id)}${out ? ', pulled out' : ''}${broken ? ', broken' : ''}${bad && !out ? ', a bad one' : ''}`;
      c.g.setAttribute('aria-label', label);
      for (const b of c.bars) {
        const v = frame.levels[b.node];
        const f = Number.isFinite(v) ? Math.max(0, Math.min(1, v / (scales[b.node] || 1))) : 0;
        b.fill.setAttribute('width', String(b.width * f));
        b.value.textContent = Number.isFinite(v) ? fmt(v, unitOf(b.node)) : '';
      }
    }
    for (const e of edges) {
      if (e.kind !== 'flow') {
        e.path.classList.toggle('faint', !L.parts.get(e.flow.part)?.present);
        continue;
      }
      const v = Math.abs(frame.flows[e.flow.id] ?? 0);
      const ref = normalOf(e.flow.id) || v || 1;
      const rel = Math.min(3, v / ref);
      e.speed = rel;
      e.path.style.strokeWidth = String(1.5 + Math.min(1, rel) * 3);
      e.path.classList.toggle('idle', rel < 0.01);
      e.path.classList.toggle('blocked', e.flow.blocked);
      for (const d of e.dots) d.style.display = rel < 0.01 ? 'none' : '';
    }
  }

  // Dots travel at the speed the stuff does, relative to as shipped.
  function tick(seconds) {
    for (const e of edges) {
      if (!e.dots.length || !(e.speed > 0.01)) continue;
      e.phase = (e.phase + seconds * 0.55 * Math.max(0.15, e.speed) * (90 / Math.max(40, e.curve.len))) % 1;
      e.dots.forEach((d, i) => {
        const u = (e.phase + i / e.dots.length) % 1;
        const pt = e.curve.at(u);
        d.setAttribute('cx', pt.x.toFixed(1));
        d.setAttribute('cy', pt.y.toFixed(1));
      });
    }
  }

  return {
    setBench(bench) {
      build(bench);
    },
    setFrame(f) {
      frame = { levels: f.levels ?? {}, flows: f.flows ?? {}, broken: f.broken ?? new Set() };
      paint();
    },
    setScales(s) {
      scales = s;
      paint();
    },
    setNormal(n) {
      normal = n;
      paint();
    },
    select(id) {
      selected = id;
      paint();
    },
    setPickable(ids) {
      pickable = ids ? new Set(ids) : null;
      paint();
    },
    setHideFaults(v) {
      hideFaults = v;
      paint();
    },
    tick,
    get layout() {
      return L;
    },
  };
}

// A frame of a run at sample i: every node's level and flow's value, and
// what had broken by then.
export function frameAt(result, i) {
  const levels = {};
  const flows = {};
  for (const [id, xs] of Object.entries(result.trace.nodes)) levels[id] = xs[i];
  for (const [id, xs] of Object.entries(result.trace.flows)) flows[id] = xs[i];
  const t = result.trace.t[i];
  const broken = new Set(result.broke.filter((b) => b.t <= t + 1e-9).map((b) => b.part));
  return { levels, flows, broken, t };
}

// How full to draw each jar: what it reaches as shipped, or the goal's
// line on it, whichever is bigger, with room to spare.
export function scalesFor(system, healthy) {
  const out = {};
  for (const [id, st] of Object.entries(healthy.stats.node)) out[id] = Math.max(Math.abs(st.max) || 0, 1e-9) * 1.25;
  for (const c of system.goal.checks) {
    if (c.read?.node !== undefined) out[c.read.node] = Math.max(out[c.read.node] ?? 0, (c.below ?? c.above ?? 0) * 1.15);
  }
  return out;
}

// The before/after chart: what a gauge did in the system as shipped
// (grey, dashed) and after the kid's change (in colour), the goal's line,
// the kid's band when there is one, and when it failed. Comparing the
// two side by side is the point (contrasting cases).
export function drawChart(svg, { series, lines = [], band = null, marks = [], unit = '', timeUnit = '', end }) {
  const W = 640;
  const H = 220;
  const m = { l: 56, r: 40, t: 28, b: 34 };
  svg.replaceChildren();
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const vals = series.flatMap((s) => s.v.filter(Number.isFinite));
  const ys = [...vals, ...lines.map((l) => l.y), ...(band ? [band.lo, band.hi] : [])];
  let lo = Math.min(0, ...ys);
  let hi = Math.max(...ys, 1e-9);
  if (hi - lo < 1e-9) hi = lo + 1;
  hi += (hi - lo) * 0.08;
  const X = (t) => m.l + (t / end) * (W - m.l - m.r);
  const Y = (v) => H - m.b - ((v - lo) / (hi - lo)) * (H - m.t - m.b);
  el('rect', { x: m.l, y: m.t, width: W - m.l - m.r, height: H - m.t - m.b, class: 'plot' }, svg);
  for (let k = 0; k <= 4; k++) {
    const v = lo + ((hi - lo) * k) / 4;
    el('line', { x1: m.l, x2: W - m.r, y1: Y(v), y2: Y(v), class: 'grid' }, svg);
    const t = el('text', { x: m.l - 6, y: Y(v) + 4, class: 'tick y' }, svg);
    t.textContent = fmt(v);
  }
  for (let k = 0; k <= 4; k++) {
    const tv = (end * k) / 4;
    const t = el('text', { x: X(tv), y: H - m.b + 16, class: 'tick x' }, svg);
    t.textContent = `${fmt(tv)}${k === 4 ? ` ${timeUnit}` : ''}`;
  }
  const u = el('text', { x: 10, y: 14, class: 'tick unit' }, svg);
  u.textContent = unit;
  if (band) {
    el('rect', { x: m.l, width: W - m.l - m.r, y: Y(band.hi), height: Math.max(2, Y(band.lo) - Y(band.hi)), class: 'kidband' }, svg);
  }
  for (const l of lines) {
    el('line', { x1: m.l, x2: W - m.r, y1: Y(l.y), y2: Y(l.y), class: 'goal-line' }, svg);
    const t = el('text', { x: W - m.r - 4, y: Y(l.y) - 4, class: 'goal-label' }, svg);
    t.textContent = l.label;
  }
  for (const s of series) {
    const pts = s.t.map((t, i) => [t, s.v[i]]).filter(([, v]) => Number.isFinite(v));
    if (!pts.length) continue;
    el('path', { d: `M${pts.map(([t, v]) => `${X(t).toFixed(1)},${Y(v).toFixed(1)}`).join(' L')}`, class: `series${s.dashed ? ' dashed' : ''}`, stroke: s.color }, svg);
  }
  for (const mk of marks) {
    el('line', { x1: X(mk.t), x2: X(mk.t), y1: m.t, y2: H - m.b, class: 'mark' }, svg);
    const t = el('text', { x: X(mk.t) + 4, y: m.t + 12, class: 'mark-label' }, svg);
    t.textContent = mk.label;
  }
  const legend = el('g', { transform: `translate(${m.l + 8},${H - 6})` }, svg);
  let x = 0;
  for (const s of series) {
    el('line', { x1: x, x2: x + 18, y1: -4, y2: -4, stroke: s.color, class: `series${s.dashed ? ' dashed' : ''}` }, legend);
    const t = el('text', { x: x + 22, y: 0, class: 'legend' }, legend);
    t.textContent = s.label;
    x += 30 + s.label.length * 6.2;
  }
}
