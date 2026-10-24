// The 2.5D step (decisions 2026-10-22 §5): a model is drawn once, from a
// locked camera, into a picture the game turns and slides along its
// chain. The camera is orthographic, so turning the picture in its own
// plane is exactly turning the model about the view axis: lean, recoil
// and tumble (engine/strain.js) work on an imported model unchanged,
// and the physics never leaves the plane.
//
// Normalization (decisions §6) happens here as well. Whatever size a
// library model arrives at and wherever its origin sits, it is
// recentered and scaled to fill its picture; the game then draws the
// picture at the binding's size. "Hit import and it works" is mostly
// this step.
//
// A small z-buffered software rasterizer: no dependencies, the same
// pixels in a browser and in a test.

import { SPRITE_MARGIN as MARGIN } from '../engine/manifest.js';

// Each view: the model axis that runs across the picture, the one that
// runs up it, and the one toward the camera. glTF models are +Y up and
// face +Z.
export const VIEWS = Object.freeze({
  side: { x: [0, 0, 1], y: [0, 1, 0], z: [-1, 0, 0] }, // in profile, facing right
  front: { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] }, // face on
  top: { x: [-1, 0, 0], y: [0, 0, 1], z: [0, 1, 0] }, // from above, front up
});

const LIGHT = (() => {
  const l = [-0.45, 0.55, 0.7]; // from up-left, toward the viewer
  const n = Math.hypot(...l);
  return l.map((v) => v / n);
})();
const AMBIENT = 0.42;

const dot = (a, x, y, z) => a[0] * x + a[1] * y + a[2] * z;

// Where every vertex lands in the picture's plane, before framing: x
// across, y up, d toward the camera; normals turned the same way.
function project(model, { view = 'side', turn = 0, mirror = false }) {
  const v = VIEWS[view] ?? VIEWS.side;
  const q = ((turn % 4) + 4) % 4;
  const place = (x, y) => {
    let px = x;
    let py = y;
    for (let k = 0; k < q; k++) [px, py] = [-py, px]; // 90° counterclockwise
    return [mirror ? -px : px, py];
  };
  return model.primitives.map((p) => {
    const n = p.positions.length / 3;
    const xy = new Float32Array(n * 2);
    const d = new Float32Array(n);
    const normals = p.normals ? new Float32Array(n * 3) : null;
    for (let i = 0; i < n; i++) {
      const [x, y, z] = [p.positions[i * 3], p.positions[i * 3 + 1], p.positions[i * 3 + 2]];
      const [sx, sy] = place(dot(v.x, x, y, z), dot(v.y, x, y, z));
      xy[i * 2] = sx;
      xy[i * 2 + 1] = sy;
      d[i] = dot(v.z, x, y, z);
      if (normals) {
        const [nx, ny, nz] = [p.normals[i * 3], p.normals[i * 3 + 1], p.normals[i * 3 + 2]];
        const [mx, my] = place(dot(v.x, nx, ny, nz), dot(v.y, nx, ny, nz));
        normals[i * 3] = mx;
        normals[i * 3 + 1] = my;
        normals[i * 3 + 2] = dot(v.z, nx, ny, nz);
      }
    }
    return { prim: p, xy, d, normals };
  });
}

// The picture's own extent of the model, in model units.
function extent(projected) {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const { xy } of projected) {
    for (let i = 0; i < xy.length; i += 2) {
      x0 = Math.min(x0, xy[i]);
      x1 = Math.max(x1, xy[i]);
      y0 = Math.min(y0, xy[i + 1]);
      y1 = Math.max(y1, xy[i + 1]);
    }
  }
  return { x0, y0, x1, y1 };
}

// A first guess at how a model should be seen, so most imports need no
// fiddling: the view that shows the most of it (a creature's profile),
// standing up for cargo, lying along the chain for a link.
export function suggestView(model, purpose = 'cargo') {
  const [ex, ey, ez] = model.bounds.max.map((v, k) => v - model.bounds.min[k]);
  if (purpose === 'cargo') return { view: ez * ey >= ex * ey ? 'side' : 'front', turn: 0, mirror: false };
  // A link holds the chain head to tail: in profile, unless another view
  // shows a lot more of it.
  const areas = { side: 1.5 * ez * ey, front: ex * ey, top: ex * ez };
  const view = Object.keys(areas).reduce((a, b) => (areas[b] > areas[a] ? b : a));
  const [w, h] = { side: [ez, ey], front: [ex, ey], top: [ex, ez] }[view];
  return { view, turn: h > w ? 1 : 0, mirror: false };
}

// --- Colors -------------------------------------------------------------------

// glTF factors and vertex colors are linear; textures and pictures are
// sRGB. Close enough for a sprite: convert the linear ones and multiply.
const srgb = (c) => Math.pow(Math.min(1, Math.max(0, c)), 1 / 2.2);

const WRAP = {
  33071: (t) => Math.min(1, Math.max(0, t)), // clamp to edge
  33648: (t) => {
    const f = Math.abs(t) % 2; // mirrored repeat
    return f > 1 ? 2 - f : f;
  },
  10497: (t) => t - Math.floor(t), // repeat (the default)
};

function sample(texture, sampler, u, v) {
  const wu = WRAP[sampler.wrapS] ?? WRAP[10497];
  const wv = WRAP[sampler.wrapT] ?? WRAP[10497];
  const x = Math.min(texture.width - 1, Math.floor(wu(u) * texture.width));
  const y = Math.min(texture.height - 1, Math.floor(wv(v) * texture.height));
  const i = (y * texture.width + x) * 4;
  const t = texture.data;
  return [t[i] / 255, t[i + 1] / 255, t[i + 2] / 255, t[i + 3] / 255];
}

// --- The picture ----------------------------------------------------------------

// Draw a model into a square picture of `size` pixels, framed and lit.
// textures: decoded images by index — { width, height, data: RGBA } — or
// missing, in which case the base colors stand in. anchor 'center'
// (links) or 'bottom' (cargo: feet on the ground).
export function renderSprite(
  model,
  textures = [],
  { size = 192, view = 'side', turn = 0, mirror = false, anchor = 'center', supersample = 3 } = {},
) {
  const projected = project(model, { view, turn, mirror });
  const box = extent(projected);
  const span = Math.max(box.x1 - box.x0, box.y1 - box.y0) || 1;
  const W = size * supersample;
  const scale = (W * (1 - 2 * MARGIN)) / span;
  const cx = (box.x0 + box.x1) / 2;
  const cy = anchor === 'bottom' ? box.y0 : (box.y0 + box.y1) / 2;
  const oy = anchor === 'bottom' ? W * (1 - MARGIN) : W / 2;
  const toPx = (x) => (x - cx) * scale + W / 2;
  const toPy = (y) => oy - (y - cy) * scale;

  const color = new Float32Array(W * W * 3);
  const depth = new Float32Array(W * W).fill(-Infinity);
  const covered = new Uint8Array(W * W);

  for (const { prim: p, xy, d, normals } of projected) {
    const m = p.material;
    const tex = m.texture ? textures[m.texture.image] : null;
    const base = [srgb(m.color[0]), srgb(m.color[1]), srgb(m.color[2]), m.color[3] ?? 1];
    const idx = p.indices;
    for (let t = 0; t < idx.length; t += 3) {
      const a = idx[t];
      const b = idx[t + 1];
      const c = idx[t + 2];
      const ax = toPx(xy[a * 2]);
      const ay = toPy(xy[a * 2 + 1]);
      const bx = toPx(xy[b * 2]);
      const by = toPy(xy[b * 2 + 1]);
      const qx = toPx(xy[c * 2]);
      const qy = toPy(xy[c * 2 + 1]);
      const area = (bx - ax) * (qy - ay) - (qx - ax) * (by - ay);
      if (Math.abs(area) < 1e-12) continue;

      // Without vertex normals, the face's own, turned toward the camera.
      let face = null;
      if (!normals) {
        const ux = xy[b * 2] - xy[a * 2];
        const uy = xy[b * 2 + 1] - xy[a * 2 + 1];
        const uz = d[b] - d[a];
        const vx = xy[c * 2] - xy[a * 2];
        const vy = xy[c * 2 + 1] - xy[a * 2 + 1];
        const vz = d[c] - d[a];
        face = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
        const len = Math.hypot(...face) || 1;
        face = face.map((f) => f / len);
        if (face[2] < 0) face = face.map((f) => -f);
      }

      const x0 = Math.max(0, Math.floor(Math.min(ax, bx, qx)));
      const x1 = Math.min(W - 1, Math.ceil(Math.max(ax, bx, qx)));
      const y0 = Math.max(0, Math.floor(Math.min(ay, by, qy)));
      const y1 = Math.min(W - 1, Math.ceil(Math.max(ay, by, qy)));
      for (let py = y0; py <= y1; py++) {
        for (let px = x0; px <= x1; px++) {
          const sx = px + 0.5;
          const sy = py + 0.5;
          const w0 = ((bx - sx) * (qy - sy) - (qx - sx) * (by - sy)) / area;
          const w1 = ((qx - sx) * (ay - sy) - (ax - sx) * (qy - sy)) / area;
          const w2 = 1 - w0 - w1;
          if (w0 < -1e-9 || w1 < -1e-9 || w2 < -1e-9) continue;
          const z = w0 * d[a] + w1 * d[b] + w2 * d[c];
          const at = py * W + px;
          if (z <= depth[at]) continue;

          let r = base[0];
          let g = base[1];
          let bl = base[2];
          let alpha = base[3];
          if (p.colors) {
            const k = (n) => w0 * p.colors[a * 4 + n] + w1 * p.colors[b * 4 + n] + w2 * p.colors[c * 4 + n];
            r *= srgb(k(0));
            g *= srgb(k(1));
            bl *= srgb(k(2));
            alpha *= k(3);
          }
          if (tex && p.uvs) {
            const u = w0 * p.uvs[a * 2] + w1 * p.uvs[b * 2] + w2 * p.uvs[c * 2];
            const v = w0 * p.uvs[a * 2 + 1] + w1 * p.uvs[b * 2 + 1] + w2 * p.uvs[c * 2 + 1];
            const s = sample(tex, m.texture.sampler, u, v);
            r *= s[0];
            g *= s[1];
            bl *= s[2];
            alpha *= s[3];
          }
          if (m.alphaMode === 'MASK' && alpha < m.alphaCutoff) continue;
          if (m.alphaMode === 'BLEND' && alpha < 0.5) continue; // blended glass: kept only where mostly solid

          let shade = 1;
          if (!m.unlit) {
            let n = face;
            if (normals) {
              const nn = (k) => w0 * normals[a * 3 + k] + w1 * normals[b * 3 + k] + w2 * normals[c * 3 + k];
              n = [nn(0), nn(1), nn(2)];
              const len = Math.hypot(...n) || 1;
              n = n.map((v) => v / len);
              if (n[2] < 0) n = n.map((v) => -v); // its back is lit like its front
            }
            shade = AMBIENT + (1 - AMBIENT) * Math.max(0, n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2]);
          }
          depth[at] = z;
          covered[at] = 1;
          color[at * 3] = r * shade;
          color[at * 3 + 1] = g * shade;
          color[at * 3 + 2] = bl * shade;
        }
      }
    }
  }

  // Average the supersamples: covered share becomes alpha (smooth edges).
  const data = new Uint8ClampedArray(size * size * 4);
  const k2 = supersample * supersample;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let n = 0;
      let r = 0;
      let g = 0;
      let b = 0;
      for (let sy = 0; sy < supersample; sy++) {
        for (let sx = 0; sx < supersample; sx++) {
          const at = (y * supersample + sy) * W + x * supersample + sx;
          if (!covered[at]) continue;
          n++;
          r += color[at * 3];
          g += color[at * 3 + 1];
          b += color[at * 3 + 2];
        }
      }
      if (n === 0) continue;
      const o = (y * size + x) * 4;
      data[o] = (r / n) * 255;
      data[o + 1] = (g / n) * 255;
      data[o + 2] = (b / n) * 255;
      data[o + 3] = (n / k2) * 255;
    }
  }
  return { width: size, height: size, data };
}
