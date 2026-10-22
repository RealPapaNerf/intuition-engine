// The 2.5D picture: framing, views, occlusion, light, textures, alpha —
// on shapes simple enough that every pixel's answer is known.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderSprite, suggestView } from '../portal/sprite.js';

const RED = [1, 0, 0, 1];
const BLUE = [0, 0, 1, 1];

function bounds(prims) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const p of prims) {
    for (let i = 0; i < p.positions.length; i++) {
      min[i % 3] = Math.min(min[i % 3], p.positions[i]);
      max[i % 3] = Math.max(max[i % 3], p.positions[i]);
    }
  }
  return { min, max };
}

function model(...prims) {
  return { primitives: prims, bounds: bounds(prims), images: [], warnings: [] };
}

// A flat quad from four corners (counterclockwise), facing `normal`.
function quad(corners, { color = RED, normal, uvs, material = {} } = {}) {
  return {
    positions: Float32Array.from(corners.flat()),
    normals: normal ? Float32Array.from([...normal, ...normal, ...normal, ...normal]) : null,
    uvs: uvs ? Float32Array.from(uvs.flat()) : null,
    colors: null,
    indices: Uint32Array.from([0, 1, 2, 0, 2, 3]),
    material: { color, texture: null, alphaMode: 'OPAQUE', alphaCutoff: 0.5, unlit: false, ...material },
  };
}

// An axis-aligned box, six quads with outward normals.
function box([x0, y0, z0], [x1, y1, z1], color = RED) {
  return [
    quad([[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], { color, normal: [1, 0, 0] }),
    quad([[x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [x0, y0, z0]], { color, normal: [-1, 0, 0] }),
    quad([[x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0]], { color, normal: [0, 1, 0] }),
    quad([[x0, y0, z1], [x0, y0, z0], [x1, y0, z0], [x1, y0, z1]], { color, normal: [0, -1, 0] }),
    quad([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], { color, normal: [0, 0, 1] }),
    quad([[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]], { color, normal: [0, 0, -1] }),
  ];
}

const px = (s, x, y) => Array.from(s.data.subarray((y * s.width + x) * 4, (y * s.width + x) * 4 + 4));

// Where the opaque pixels are, and where the reddest ones are.
function survey(s, isMark = ([r, g, b]) => r > 150 && g < 80 && b < 80) {
  const all = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  let mx = 0;
  let my = 0;
  let n = 0;
  for (let y = 0; y < s.height; y++) {
    for (let x = 0; x < s.width; x++) {
      const p = px(s, x, y);
      if (p[3] < 128) continue;
      all.x0 = Math.min(all.x0, x);
      all.x1 = Math.max(all.x1, x);
      all.y0 = Math.min(all.y0, y);
      all.y1 = Math.max(all.y1, y);
      if (isMark(p)) {
        mx += x;
        my += y;
        n++;
      }
    }
  }
  return { ...all, mark: n ? { x: mx / n, y: my / n } : null };
}

test('normalization: a model of any size, anywhere, fills its picture and sits in the middle', () => {
  for (const [at, size] of [[[0, 0, 0], 1], [[500, -300, 80], 0.002], [[-1e4, 2e3, 7], 900]]) {
    const m = model(...box(at, at.map((v, i) => v + size * [1, 0.5, 2][i])));
    const s = renderSprite(m, [], { size: 100 });
    const b = survey(s);
    // 6% margin all round; the longer side (z, across in profile) fills the rest
    assert.ok(Math.abs(b.x1 - b.x0 + 1 - 88) <= 2, `width ${b.x1 - b.x0 + 1}`);
    assert.ok(Math.abs((b.x0 + b.x1) / 2 - 49.5) <= 1, 'centered across');
    assert.ok(Math.abs((b.y0 + b.y1) / 2 - 49.5) <= 1, 'centered up and down');
  }
});

test('views: in profile it faces right; face on it looks at us; from the top its front is up', () => {
  // A long grey body along z with a red nose at its front (+z).
  const m = model(...box([0, 0, 0], [1, 1, 4], [0.5, 0.5, 0.5, 1]), ...box([0.25, 0.25, 4], [0.75, 0.75, 4.5], RED));
  const side = survey(renderSprite(m, [], { size: 100, view: 'side' }));
  assert.ok(side.mark.x > 85, `nose on the right: ${side.mark.x}`);
  const front = survey(renderSprite(m, [], { size: 100, view: 'front' }));
  assert.ok(Math.abs(front.mark.x - 49.5) < 2 && Math.abs(front.mark.y - 49.5) < 2, 'nose toward us, in the middle');
  const top = survey(renderSprite(m, [], { size: 100, view: 'top' }));
  assert.ok(top.mark.y < 15, `nose up the picture: ${top.mark.y}`);
});

test('turning and mirroring move the picture exactly as turning and mirroring the model would', () => {
  const m = model(...box([0, 0, 0], [1, 1, 4], [0.5, 0.5, 0.5, 1]), ...box([0.25, 0.25, 4], [0.75, 0.75, 4.5], RED));
  const turned = survey(renderSprite(m, [], { size: 100, turn: 1 }));
  assert.ok(turned.mark.y < 15, 'a quarter turn counterclockwise brings the nose to the top');
  const mirrored = survey(renderSprite(m, [], { size: 100, mirror: true }));
  assert.ok(mirrored.mark.x < 15, 'mirrored, it faces left');
  // An exact quarter turn of the whole picture, pixel for pixel.
  const a = renderSprite(m, [], { size: 64 });
  const b = renderSprite(m, [], { size: 64, turn: 1 });
  let differ = 0;
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      const before = px(a, x, y);
      const after = px(b, y, 63 - x); // the same pixel, a quarter turn on
      if (Math.abs(before[3] - after[3]) > 2) differ++;
    }
  }
  assert.ok(differ <= 4, `${differ} pixels out of place`);
});

test('nearer surfaces hide farther ones, whichever is drawn first', () => {
  // Seen face on (front view): larger z is nearer the camera.
  const near = quad([[0, 0, 1], [2, 0, 1], [2, 2, 1], [0, 2, 1]], { color: RED, normal: [0, 0, 1] });
  const far = quad([[1, 1, 0], [3, 1, 0], [3, 3, 0], [1, 3, 0]], { color: BLUE, normal: [0, 0, 1] });
  for (const order of [[near, far], [far, near]]) {
    const s = renderSprite(model(...order), [], { size: 90, view: 'front' });
    const [r, , b] = px(s, 40, 50); // inside both
    assert.ok(r > 100 && b < 30, `overlap should be red, got ${px(s, 40, 50)}`);
  }
});

test('light: a face toward it is brighter than one turned away, and a back is lit like its front', () => {
  const toward = quad([[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]], { color: [1, 1, 1, 1], normal: [0, 0, 1] });
  const slanted = quad([[2, 0, 0], [3, 0, 0], [3, 1, 0], [2, 1, 0]], { color: [1, 1, 1, 1], normal: [0.7, -0.7, 0.1] });
  const s = renderSprite(model(toward, slanted), [], { size: 120, view: 'front' });
  const lit = px(s, 25, 60)[0];
  const dim = px(s, 95, 60)[0];
  assert.ok(lit > dim + 40, `toward ${lit} vs away ${dim}`);
  // The same face with its normal flipped away from us shades the same.
  const back = quad([[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]], { color: [1, 1, 1, 1], normal: [0, 0, -1] });
  const sb = renderSprite(model(back), [], { size: 60, view: 'front' });
  const sf = renderSprite(model(toward), [], { size: 60, view: 'front' });
  assert.deepEqual(px(sb, 30, 30), px(sf, 30, 30));
});

test('textures land where their UVs say, wrapping as their sampler says', () => {
  // A 2×1 texture: red on the left, green on the right.
  const tex = { width: 2, height: 1, data: Uint8Array.from([255, 0, 0, 255, 0, 255, 0, 255]) };
  const face = (u, sampler = {}) =>
    quad([[0, 0, 0], [4, 0, 0], [4, 1, 0], [0, 1, 0]], {
      color: [1, 1, 1, 1],
      normal: [0, 0, 1],
      uvs: [[0, 0], [u, 0], [u, 1], [0, 1]],
      material: { texture: { image: 0, sampler, texCoord: 0 }, unlit: true },
    });
  const across = (s) => [0.1, 0.35, 0.6, 0.9].map((f) => px(s, Math.floor(f * 100), 50)[0] > 128 ? 'R' : 'G').join('');
  assert.equal(across(renderSprite(model(face(1)), [tex], { size: 100, view: 'front' })), 'RRGG');
  assert.equal(across(renderSprite(model(face(2)), [tex], { size: 100, view: 'front' })), 'RGRG', 'repeat');
  assert.equal(across(renderSprite(model(face(2, { wrapS: 33071 })), [tex], { size: 100, view: 'front' })), 'RGGG', 'clamp');
  // Unlit, a texel is drawn exactly as stored.
  assert.deepEqual(px(renderSprite(model(face(1)), [tex], { size: 100, view: 'front' }), 10, 50), [255, 0, 0, 255]);
});

test('alpha: a masked-out texel leaves the picture clear', () => {
  const tex = { width: 2, height: 1, data: Uint8Array.from([255, 0, 0, 255, 0, 255, 0, 0]) };
  const m = model(
    quad([[0, 0, 0], [4, 0, 0], [4, 1, 0], [0, 1, 0]], {
      color: [1, 1, 1, 1],
      normal: [0, 0, 1],
      uvs: [[0, 0], [1, 0], [1, 1], [0, 1]],
      material: { texture: { image: 0, sampler: {}, texCoord: 0 }, alphaMode: 'MASK', alphaCutoff: 0.5 },
    }),
  );
  const s = renderSprite(m, [tex], { size: 100, view: 'front' });
  assert.ok(px(s, 25, 50)[3] === 255, 'the solid half is there');
  assert.ok(px(s, 75, 50)[3] === 0, 'the masked half is not');
});

test('cargo stands on the ground: anchored at the bottom, its lowest point meets the bottom margin', () => {
  const m = model(...box([0, 3, 0], [1, 5, 1.5]));
  const b = survey(renderSprite(m, [], { size: 100, anchor: 'bottom' }));
  assert.ok(Math.abs(b.y1 - 93) <= 1, `feet at ${b.y1}`);
});

test('first guesses: a long creature in profile, lying along a chain or standing as cargo', () => {
  const creature = model(...box([0, 0, 0], [0.4, 1, 3]));
  assert.deepEqual(suggestView(creature, 'cargo'), { view: 'side', turn: 0, mirror: false });
  assert.deepEqual(suggestView(creature, 'link'), { view: 'side', turn: 0, mirror: false });
  const tower = model(...box([0, 0, 0], [0.5, 4, 0.5]));
  assert.deepEqual(suggestView(tower, 'link'), { view: 'side', turn: 1, mirror: false }, 'a tall thing lies down to be a link');
  const sideways = model(...box([0, 0, 0], [3, 1, 0.4])); // a model facing x, not z
  assert.equal(suggestView(sideways, 'cargo').view, 'front', 'its profile is what front shows');
});
