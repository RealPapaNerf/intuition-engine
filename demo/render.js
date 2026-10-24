// The renderer: draws what the engine says is true, in whichever skin is
// on. Nothing here feeds the physics, so switching skins re-dresses the
// very same state. Two layers:
//
//   the invariant layer, the same in every skin (decisions 2026-10-22
//   §2): the honest geometry, stress color — on the tether between the
//   pictures, as a glow around each picture, as a rim on cloth — the
//   strain performance (engine/strain.js), the slow-motion break, and
//   the numbers;
//   the costume: whatever the skin's manifest binds to each primitive —
//   a glyph, a strip of cloth, or an imported model's picture, all drawn
//   through the same moves.

import { chainPoses, along, recoilSpeed, isAnchor, SPRITE_MARGIN } from '../engine/index.js';

export const S = 660; // px per meter
export const tx = (x) => (x + 0.15) * S;
export const ty = (y) => (0.32 - y) * S;
export const fromPx = (px, py) => ({ x: px / S - 0.15, y: 0.32 - py / S });

const STRIP_PX = 13; // cloth width
const CARGO_PX = 26; // the lightest cargo's height; the rest grow as ∛mass

export function stressColor(u, alpha = 0.95) {
  return `rgba(${(120 + 135 * u) | 0}, ${(70 - 40 * u) | 0}, 40, ${alpha})`;
}

function span(level) {
  return level.end[0] * level.step;
}

// --- The world ---------------------------------------------------------------

const DECOR_SPOTS = [
  [0.84, 0.24, 34],
  [0.3, 0.27, 15],
  [0.55, 0.21, 12],
  [0.68, 0.29, 14],
  [0.42, 0.31, 10],
  [0.16, 0.23, 12],
];

export function drawScene(ctx, level, skin) {
  const { width: W, height: H } = ctx.canvas;
  const sc = skin.scene;
  const gap = span(level);
  ctx.fillStyle = sc.sky;
  ctx.fillRect(0, 0, W, H);
  (sc.skyDecor ?? []).forEach((g, k) => {
    const [x, y, px] = DECOR_SPOTS[k % DECOR_SPOTS.length];
    ctx.font = `${px}px serif`;
    ctx.fillText(g, tx(x * gap) - px / 2, ty(y));
  });

  // The water, and the reach of whatever waits in it: cargo below dryY
  // is theirs.
  ctx.fillStyle = sc.water.body;
  ctx.fillRect(0, ty(level.waterY), W, H - ty(level.waterY));
  ctx.fillStyle = sc.water.reach;
  ctx.fillRect(tx(0), ty(level.dryY), tx(gap) - tx(0), ty(level.waterY) - ty(level.dryY));
  const lurkers = sc.water.lurkers;
  ctx.font = '26px serif';
  lurkers.forEach((g, k) => {
    const x = (0.2 + (0.6 * (k + 0.5)) / lurkers.length) * gap;
    ctx.fillText(g, tx(x) - 13, ty(level.waterY) + 34 + (k % 2) * 10);
  });

  ctx.fillStyle = sc.bank.body;
  ctx.fillRect(0, ty(0), tx(0), H);
  ctx.fillRect(tx(gap), ty(0), W - tx(gap), H);
  ctx.fillStyle = sc.bank.top;
  ctx.fillRect(0, ty(0), tx(0), 7);
  ctx.fillRect(tx(gap), ty(0), W - tx(gap), 7);

  const top = ty(level.bounds.jMax * level.step + 0.012);
  for (const [x, out] of [[0, -1], [gap, 1]]) drawSupport(ctx, sc.support, tx(x), top, ty(0), out);
}

// The tall fixed supports at the bank edges: the archetype says only
// "fixed points up to here"; the costume says what they are.
function drawSupport(ctx, style, cx, top, bottom, out) {
  if (style === 'tree') {
    ctx.fillStyle = '#6b4f2e';
    ctx.fillRect(cx - 5, top, 10, bottom - top);
    ctx.fillStyle = '#6f9d4f';
    for (const [dx, dy, r] of [[46, 6, 30], [72, 52, 24], [26, 40, 22]]) {
      ctx.beginPath();
      ctx.arc(cx + out * dx, top + dy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (style === 'post') {
    ctx.fillStyle = '#9b6a3c';
    ctx.fillRect(cx - 6, top + 10, 12, bottom - top - 10);
    ctx.fillStyle = '#7a5130';
    for (const y of [top + 30, top + 34, bottom - 40]) ctx.fillRect(cx - 7, y, 14, 3);
    ctx.fillStyle = '#9b6a3c';
    ctx.beginPath();
    ctx.arc(cx, top + 6, 9, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = '#8e3b2a';
    ctx.fillRect(cx - 12, top + 8, 24, bottom - top - 8);
    ctx.strokeStyle = 'rgba(40, 20, 15, 0.45)';
    ctx.lineWidth = 1;
    for (let y = top + 8, row = 0; y < bottom; y += 9, row++) {
      ctx.beginPath();
      ctx.moveTo(cx - 12, y);
      ctx.lineTo(cx + 12, y);
      const off = row % 2 ? -4 : 4;
      ctx.moveTo(cx + off, y);
      ctx.lineTo(cx + off, y + 9);
      ctx.stroke();
    }
    ctx.fillStyle = '#5a2a20';
    ctx.fillRect(cx - 15, top, 30, 9);
  }
}

// --- Building marks ----------------------------------------------------------

export function drawGrid(ctx, level, skin) {
  const { iMin, iMax, jMin, jMax } = level.bounds;
  for (let i = iMin; i <= iMax; i++) {
    for (let j = jMin; j <= jMax; j++) {
      const p = [i, j];
      const x = tx(i * level.step);
      const y = ty(j * level.step);
      ctx.beginPath();
      if (isAnchor(level, p)) {
        // a peg in the bank or the support
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#f4e3c3';
        ctx.fill();
        ctx.strokeStyle = '#3d2e1c';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      } else {
        ctx.arc(x, y, 2.2, 0, Math.PI * 2);
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = skin.scene.ink;
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
  }
}

export function drawRoute(ctx, level, route) {
  ctx.save();
  ctx.setLineDash([3, 7]);
  ctx.strokeStyle = 'rgba(70, 150, 70, 0.8)';
  ctx.lineWidth = 7;
  ctx.beginPath();
  route.forEach((p, k) => {
    const x = tx(p[0] * level.step);
    const y = ty(p[1] * level.step) - 4;
    if (k === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
  ctx.restore();
}

export function drawRing(ctx, level, p, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(tx(p[0] * level.step), ty(p[1] * level.step), 9, 0, Math.PI * 2);
  ctx.stroke();
}

export function drawDragLine(ctx, level, from, to) {
  ctx.save();
  ctx.setLineDash([5, 5]);
  ctx.strokeStyle = 'rgba(80, 60, 40, 0.6)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(tx(from[0] * level.step), ty(from[1] * level.step));
  ctx.lineTo(tx(to.x), ty(to.y));
  ctx.stroke();
  ctx.restore();
}

// --- Links, in the strain language ------------------------------------------

// One picture's length along its chain: a creature is the same size on
// every link it holds; cloth is cut to the link.
function instanceSize(level, skin, m) {
  const b = skin.link;
  const base = b.strip ? m.restLength : level.step * (b.scale ?? 1);
  return (b.fill * base) / b.perLink;
}

function strokePoints(ctx, pts, color, width) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  pts.forEach((p, k) => {
    if (k === 0) ctx.moveTo(tx(p.x), ty(p.y));
    else ctx.lineTo(tx(p.x), ty(p.y));
  });
  ctx.stroke();
}

// The art kept upright: a chain's heading and its reverse are the same
// line, so turn the picture whichever way reads right side up.
function upright(angle) {
  let a = angle;
  while (a > Math.PI / 2) a -= Math.PI;
  while (a <= -Math.PI / 2) a += Math.PI;
  return a;
}

// An imported model's picture, decoded once per binding. Until it has
// decoded (a frame, for a picture carried in the manifest) nothing is
// drawn; the physics is not waiting on it.
const sprites = new WeakMap();
function spriteOf(model) {
  let img = sprites.get(model);
  if (!img) {
    img = new Image();
    img.src = model.sprite;
    sprites.set(model, img);
  }
  return img.complete && img.naturalWidth > 0 ? img : null;
}

// A binding's picture — its glyph, or its model — `px` across at its
// longest, centered on (x, y) or, anchored 'bottom', standing on it;
// turned to the chain's heading, kept upright, glowing with the stress.
function drawPicture(ctx, pic, x, y, { angle = 0, px, axis, glow = 0, anchor = 'center' }) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(upright(-angle + (axis === 'across' ? Math.PI / 2 : 0)));
  if (glow > 0.05) {
    ctx.shadowColor = stressColor(glow, 0.9);
    ctx.shadowBlur = 4 + 14 * glow;
  }
  if (pic.model) {
    const img = spriteOf(pic.model);
    if (img) {
      // The portal framed the model inside a margin; the margin isn't art.
      const k = px / ((1 - 2 * SPRITE_MARGIN) * Math.max(img.naturalWidth, img.naturalHeight));
      const w = img.naturalWidth * k;
      const h = img.naturalHeight * k;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, -w / 2, anchor === 'bottom' ? -h * (1 - SPRITE_MARGIN) : -h / 2, w, h);
    }
  } else {
    ctx.font = `${px / 0.9}px serif`; // the art fills ~0.9 em
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(pic.glyph, 0, 0);
  }
  ctx.restore();
}

// heat: the utilization to color by (the live one, or a remembered
// peak); defaults to the live one.
export function drawLink(ctx, level, skin, m, { t = 0, seed = 0, heat } = {}) {
  const b = skin.link;
  const size = instanceSize(level, skin, m);
  const pose = chainPoses(m, { perLink: b.perLink, size, t, seed });
  const u = Math.min(heat ?? pose.u, 1);
  const slack = pose.state === 'slack' && heat === undefined;
  const tether = slack ? 'rgba(120, 120, 120, 0.55)' : stressColor(u);
  strokePoints(ctx, pose.path, tether, 1.5 + 2.5 * u);

  for (const it of pose.instances) {
    if (b.strip) {
      const pts = [];
      for (let k = 0; k <= 8; k++) {
        const at = along(pose.path, it.from + ((it.to - it.from) * k) / 8);
        pts.push({ x: at.x + it.dx, y: at.y + it.dy });
      }
      const width = STRIP_PX * (1 - 0.35 * it.slip); // cloth thins as the knot slips
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      strokePoints(ctx, pts, slack ? 'rgba(90, 90, 100, 0.6)' : stressColor(u), width + 4);
      strokePoints(ctx, pts, b.strip[seed % b.strip.length], width);
      strokePoints(ctx, pts, 'rgba(0, 0, 0, 0.12)', 1.5);
      ctx.lineCap = 'butt';
      ctx.lineJoin = 'miter';
    } else {
      drawPicture(ctx, b, tx(it.x), ty(it.y), { angle: it.angle, px: size * S, axis: b.axis, glow: slack ? 0 : u });
    }
  }
}

// Knots, stitches: what the skin draws where links meet.
export function drawJoints(ctx, level, skin, points) {
  if (!skin.joint) return;
  const px = level.step * S * (skin.joint.scale ?? 1) * 0.45;
  for (const p of points) drawPicture(ctx, skin.joint, tx(p.x), ty(p.y), { px });
}

// --- Cargo ---------------------------------------------------------------------

export function cargoPx(level, skin, index) {
  return CARGO_PX * Math.cbrt(level.cargo[index] / level.cargo[0]) * (skin.cargo[index].scale ?? 1);
}

export function drawCargo(ctx, level, skin, index, pos) {
  const px = cargoPx(level, skin, index);
  const cargo = skin.cargo[index];
  ctx.font = `${px}px serif`;
  if (pos.y < level.waterY) {
    ctx.fillText(skin.scene.water.splash, tx(pos.x) - px / 2, ty(level.waterY) + 8); // in it went
  } else if (cargo.model) {
    drawPicture(ctx, cargo, tx(pos.x), ty(pos.y) - 2, { px, anchor: 'bottom' }); // feet on the bridge
  } else {
    ctx.fillText(cargo.glyph, tx(pos.x) - px / 2, ty(pos.y) - 4);
  }
}

// --- Recoil and tumble ----------------------------------------------------------

// The end a link that lets go flies back toward: the one still held —
// a fixed anchor, or the joint with more links on it.
function holdingEnd(m) {
  if (m.a.fixed !== m.b.fixed) return m.a.fixed ? m.a : m.b;
  return (m.a.degree ?? 0) >= (m.b.degree ?? 0) ? m.a : m.b;
}

// Freed pictures: they leave at the speed the link's stored strain
// energy gives them (engine/strain.js) and fall under g. They fall in
// whatever costume is on, like everything else.
export function spawnDebris(debris, level, skin, m, { seed = 0 } = {}) {
  const b = skin.link;
  const size = instanceSize(level, skin, m);
  const { instances } = chainPoses(m, { perLink: b.perLink, size, seed });
  const toward = holdingEnd(m);
  const v = recoilSpeed(m);
  const drift = { x: (m.a.vx + m.b.vx) / 2, y: (m.a.vy + m.b.vy) / 2 };
  for (const it of instances) {
    const dx = toward.x - it.x;
    const dy = toward.y - it.y;
    const d = Math.hypot(dx, dy) || 1;
    debris.push({
      x: it.x,
      y: it.y,
      vx: drift.x + (v * dx) / d,
      vy: drift.y + (v * dy) / d,
      angle: it.angle,
      spin: (seed % 2 ? 1 : -1) * (5 + (seed % 5)),
      size,
      seed,
      splash: 0,
      landed: 0,
    });
  }
}

export function stepDebris(debris, level, dt, g) {
  const gap = span(level);
  for (let k = debris.length - 1; k >= 0; k--) {
    const d = debris[k];
    if (d.splash > 0) {
      if (--d.splash === 0) debris.splice(k, 1);
      continue;
    }
    if (d.landed > 0) {
      if (--d.landed === 0) debris.splice(k, 1);
      continue;
    }
    d.vy -= g * dt;
    d.x += d.vx * dt;
    d.y += d.vy * dt;
    d.angle += d.spin * dt;
    if ((d.x < 0 || d.x > gap) && d.y < 0) {
      d.y = 0; // the banks are solid ground: it lands there
      d.landed = 45;
    } else if (d.y < level.waterY) {
      d.splash = 30; // in it went
    }
  }
}

export function drawDebris(ctx, level, skin, debris) {
  for (const d of debris) {
    if (d.landed > 0) ctx.globalAlpha = Math.min(1, d.landed / 20);
    if (d.splash > 0) {
      ctx.font = '22px serif';
      ctx.fillText(skin.scene.water.splash, tx(d.x) - 11, ty(level.waterY) + 6);
    } else if (skin.link.strip) {
      const hx = (Math.cos(d.angle) * d.size) / 2;
      const hy = (Math.sin(d.angle) * d.size) / 2;
      const color = skin.link.strip[d.seed % skin.link.strip.length];
      ctx.lineCap = 'round';
      strokePoints(ctx, [{ x: d.x - hx, y: d.y - hy }, { x: d.x + hx, y: d.y + hy }], color, STRIP_PX);
      ctx.lineCap = 'butt';
    } else {
      drawPicture(ctx, skin.link, tx(d.x), ty(d.y), { angle: d.angle, px: d.size * S, axis: skin.link.axis });
    }
    ctx.globalAlpha = 1;
  }
}

// --- Words on the scene ----------------------------------------------------------

function label(ctx, skin, text, x, y, px) {
  ctx.font = `${px}px system-ui, sans-serif`;
  const w = ctx.measureText(text).width;
  ctx.globalAlpha = 0.75;
  ctx.fillStyle = skin.scene.sky;
  ctx.fillRect(x - w / 2 - 4, y - px * 0.8, w + 8, px * 1.15);
  ctx.globalAlpha = 1;
  ctx.fillStyle = skin.scene.ink;
  ctx.textAlign = 'center';
  ctx.fillText(text, x, y);
  ctx.textAlign = 'start';
}

// The numbers, the same in every skin: each link's pull as a share of
// what it can hold, and the cargo's mass.
export function drawNumbers(ctx, level, skin, members, valueOf, cargo) {
  for (const m of members) {
    const mid = { x: (m.a.x + m.b.x) / 2, y: (m.a.y + m.b.y) / 2 };
    const len = Math.hypot(m.b.x - m.a.x, m.b.y - m.a.y) || 1;
    const nx = -(m.b.y - m.a.y) / len;
    const ny = (m.b.x - m.a.x) / len;
    label(ctx, skin, `${Math.round(valueOf(m) * 100)}%`, tx(mid.x + nx * 0.022), ty(mid.y + ny * 0.022) + 4, 11);
  }
  if (cargo && cargo.pos.y >= level.waterY) {
    const px = cargoPx(level, skin, cargo.index);
    label(ctx, skin, `${Math.round(level.cargo[cargo.index] * 1000)} g`, tx(cargo.pos.x), ty(cargo.pos.y) - px - 6, 12);
  }
}

export function drawCaption(ctx, level, skin, text, alpha = 1) {
  ctx.globalAlpha = alpha;
  label(ctx, skin, text, tx(span(level) / 2), ty(0.27), 15);
  ctx.globalAlpha = 1;
}

// A blueprint link as a resting member: what the strain language needs
// to draw it before any physics has run.
export function restingLink(level, p, q) {
  const a = { x: p[0] * level.step, y: p[1] * level.step, vx: 0, vy: 0 };
  const b = { x: q[0] * level.step, y: q[1] * level.step, vx: 0, vy: 0 };
  return {
    a,
    b,
    material: level.material,
    restLength: Math.hypot(b.x - a.x, b.y - a.y),
    mass: level.material.mass ?? 0,
    broken: false,
    force: 0,
  };
}
