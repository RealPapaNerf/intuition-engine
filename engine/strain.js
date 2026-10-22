// The strain performance (decisions 2026-10-22 §3): the engine acts, the
// model wears it. Each link's utilization — already computed by the
// engine — maps to a few behaviors any mesh can perform. Written once,
// so every skin, and every model anyone ever imports, inherits the drama:
//
//   slack    a tension-only link carrying nothing droops, drawn on the
//            curve a chain of its length really hangs in
//   grip     low load: steady
//   tremble  from STRAIN.tremble: a quiver that grows toward the limit
//   slip     from STRAIN.slip: the link's instances lose their hold one
//            by one, opening gaps at the joints
//   break    recoil and tumble: the freed instances fly back at the speed
//            the link's stored strain energy gives them, then fall
//
// A link is drawn as N instances of its skin's mesh along it. Meshes
// never stretch, so a link that really stretches really opens gaps
// between them (silk visibly; ants, which let go at 2% strain, barely).
// Every motion here is applied to the chain — positions, turns, gaps —
// never baked into a mesh, and nothing here feeds back into the physics:
// it reads the engine's numbers and moves pictures. The nodes it starts
// from are always the honest geometry.

import { utilization } from './model.js';

// The thresholds are global, not per material: utilization is already
// the fraction of each material's own limit.
export const STRAIN = Object.freeze({
  tremble: 0.75, // utilization where the quiver starts            REVISIT
  slip: 0.9, // utilization where instances start to lose hold    REVISIT
  quiver: 0.004, // m: quiver amplitude at the limit
  quiverHz: 9,
  lean: 0.22, // rad: tilt at the limit
  slipShift: 0.18, // fraction of its spacing a slipped instance slides
});

export function strainState(m) {
  if (m.broken) return 'broken';
  if (m.material.tensionOnly && m.force <= 0) return 'slack';
  const u = utilization(m);
  if (u >= STRAIN.slip) return 'slip';
  if (u >= STRAIN.tremble) return 'tremble';
  return 'grip';
}

function ramp(u, from, to) {
  return Math.min(1, Math.max(0, (u - from) / (to - from)));
}

// Arc length of the parabola through both ends of a chord with this sag
// at its middle: (d/2)(√(1+a²) + asinh(a)/a), a = 4·sag/d.
export function parabolaLength(chord, sag) {
  if (sag <= 0) return chord;
  const a = (4 * sag) / chord;
  return (chord / 2) * (Math.sqrt(1 + a * a) + Math.asinh(a) / a);
}

// The sag that makes the parabola as long as the chain. A taut or
// stretched link (chord ≥ rest length) does not droop.
export function droopSag(chord, restLength) {
  if (chord >= restLength) return 0;
  if (chord <= 1e-9) return restLength / 2; // both ends together: a fold
  let lo = 0;
  let hi = restLength;
  for (let k = 0; k < 60; k++) {
    const mid = (lo + hi) / 2;
    if (parabolaLength(chord, mid) < restLength) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

// The link as it should be drawn: a straight segment, or for a slack
// tension-only link the hanging curve, sagging toward the ground.
export function linkPath(m, segments = 16) {
  const { a, b } = m;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const chord = Math.hypot(dx, dy);
  const slack = m.material.tensionOnly && m.force <= 0 && !m.broken;
  const sag = slack ? droopSag(chord, m.restLength) : 0;
  if (sag === 0) return [{ x: a.x, y: a.y }, { x: b.x, y: b.y }];
  // The chord's normal on the downhill side (straight down, for a level
  // chord; sideways for a steep one, which really does fold to one side).
  let nx = -dy / chord;
  let ny = dx / chord;
  if (ny > 0 || (ny === 0 && nx < 0)) {
    nx = -nx;
    ny = -ny;
  }
  const points = [];
  for (let k = 0; k <= segments; k++) {
    const s = k / segments;
    const off = 4 * sag * s * (1 - s);
    points.push({ x: a.x + dx * s + nx * off, y: a.y + dy * s + ny * off });
  }
  return points;
}

export function pathLength(path) {
  let len = 0;
  for (let k = 1; k < path.length; k++) {
    len += Math.hypot(path[k].x - path[k - 1].x, path[k].y - path[k - 1].y);
  }
  return len;
}

// The point and heading a distance s along a path (clamped to its ends).
export function along(path, s) {
  let left = Math.max(0, s);
  for (let k = 1; k < path.length; k++) {
    const p = path[k - 1];
    const q = path[k];
    const len = Math.hypot(q.x - p.x, q.y - p.y);
    if (left <= len || k === path.length - 1) {
      const f = len > 0 ? Math.min(1, left / len) : 0;
      return {
        x: p.x + (q.x - p.x) * f,
        y: p.y + (q.y - p.y) * f,
        angle: Math.atan2(q.y - p.y, q.x - p.x),
      };
    }
    left -= len;
  }
  return { x: path[0].x, y: path[0].y, angle: 0 };
}

// Where each of a link's instances is this instant. World units, angles
// in radians with y up. `size` is how long one instance is along the
// chain — fixed by the mesh, never by the stretch (a creature is the same
// creature on a long link as on a short one; a strip of cloth is cut to
// its link's resting length). `seed` makes each link move as itself; `t`
// is seconds. Returns the path to draw along, the state, the utilization,
// and per instance: its center, heading, the arc span it covers (for
// meshes that follow the path), its sideways shake, and how far it has
// slipped (0..1).
export function chainPoses(m, { perLink = 1, size, t = 0, seed = 0 } = {}) {
  const path = linkPath(m);
  const total = pathLength(path);
  const state = strainState(m);
  const u = state === 'slack' || state === 'broken' ? 0 : Math.min(utilization(m), 1);
  const quiver = ramp(u, STRAIN.tremble, 1);
  const loss = ramp(u, STRAIN.slip, 1);
  const length = size ?? (0.85 * m.restLength) / perLink;
  const spacing = total / perLink;
  const instances = [];
  for (let i = 0; i < perLink; i++) {
    const order = (i + seed) % perLink; // which one lets go first
    const slip = Math.min(1, Math.max(0, loss * perLink - order));
    const side = (i + seed) % 2 === 0 ? 1 : -1;
    const center = (i + 0.5) * spacing + side * slip * STRAIN.slipShift * spacing;
    const at = along(path, center);
    const amp = STRAIN.quiver * quiver * (1 + 0.5 * slip);
    const shake = amp * Math.sin(2 * Math.PI * STRAIN.quiverHz * t + seed * 2.399 + i * 1.7);
    const dx = -Math.sin(at.angle) * shake;
    const dy = Math.cos(at.angle) * shake;
    instances.push({
      x: at.x + dx,
      y: at.y + dy,
      angle: at.angle + side * STRAIN.lean * u * u,
      from: center - length / 2,
      to: center + length / 2,
      dx,
      dy,
      slip,
    });
  }
  return { path, state, u, instances };
}

// How fast a link that lets go flies back: its stored strain energy at
// the limit, F²/(2k) with k = EA/L₀, all turned into its own motion,
// gives v = F/√(k·m). A massless link has nothing to throw.
export function recoilSpeed(m) {
  const mat = m.material;
  if (!(m.mass > 0)) return 0;
  const F = mat.tensionOnly ? mat.tensionLimit : Math.max(mat.tensionLimit, mat.compressionLimit);
  const k = mat.axialStiffness / m.restLength;
  return F / Math.sqrt(k * m.mass);
}
