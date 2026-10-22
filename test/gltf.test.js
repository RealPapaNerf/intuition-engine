// The portal's glTF reader, against files built here byte by byte —
// so every expected number is known exactly, and nothing needs the
// network.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openGltf, readGlb, GltfError } from '../portal/gltf.js';

// --- A tiny glTF writer -------------------------------------------------------

// Pack typed arrays into one binary buffer, one bufferView each.
function pack(arrays) {
  const views = [];
  let length = 0;
  for (const a of arrays) {
    length += (4 - (length % 4)) % 4;
    views.push({ buffer: 0, byteOffset: length, byteLength: a.byteLength });
    length += a.byteLength;
  }
  const bin = new Uint8Array(length);
  arrays.forEach((a, i) => bin.set(new Uint8Array(a.buffer, a.byteOffset, a.byteLength), views[i].byteOffset));
  return { bin, views };
}

function glb(json, bin) {
  const enc = new TextEncoder();
  let j = enc.encode(JSON.stringify(json));
  const jPad = (4 - (j.length % 4)) % 4;
  const bPad = bin ? (4 - (bin.length % 4)) % 4 : 0;
  const total = 12 + 8 + j.length + jPad + (bin ? 8 + bin.length + bPad : 0);
  const out = new Uint8Array(total);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, 0x46546c67, true);
  dv.setUint32(4, 2, true);
  dv.setUint32(8, total, true);
  dv.setUint32(12, j.length + jPad, true);
  dv.setUint32(16, 0x4e4f534a, true);
  out.set(j, 20);
  out.fill(0x20, 20 + j.length, 20 + j.length + jPad);
  if (bin) {
    const at = 20 + j.length + jPad;
    dv.setUint32(at, bin.length + bPad, true);
    dv.setUint32(at + 4, 0x004e4942, true);
    out.set(bin, at + 8);
  }
  return out;
}

// One triangle (or more), with whatever extra the test needs.
function model({ positions, indices, nodes, mode, extra = {}, material, extraArrays = [] }) {
  const arrays = [Float32Array.from(positions)];
  if (indices) arrays.push(Uint16Array.from(indices));
  const { bin, views } = pack([...arrays, ...extraArrays]);
  const count = positions.length / 3;
  const accessors = [{ bufferView: 0, componentType: 5126, count, type: 'VEC3' }];
  const prim = { attributes: { POSITION: 0 } };
  if (indices) {
    accessors.push({ bufferView: 1, componentType: 5123, count: indices.length, type: 'SCALAR' });
    prim.indices = 1;
  }
  if (mode !== undefined) prim.mode = mode;
  if (material !== undefined) prim.material = material;
  return {
    json: {
      asset: { version: '2.0' },
      buffers: [{ byteLength: bin.length }],
      bufferViews: views,
      accessors,
      meshes: [{ primitives: [prim] }],
      nodes: nodes ?? [{ mesh: 0 }],
      scenes: [{ nodes: [0] }],
      ...extra,
    },
    bin,
  };
}

const TRI = [0, 0, 0, 1, 0, 0, 0, 1, 0];
const close = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;
const near = (got, want) => got.every((v, i) => close(v, want[i]));

// --- Tests ----------------------------------------------------------------------

test('a .glb with one triangle: positions, the triangle, the bounds', async () => {
  const { json, bin } = model({ positions: TRI, indices: [0, 1, 2] });
  const m = await openGltf(glb(json, bin));
  assert.equal(m.triangles, 1);
  assert.deepEqual([...m.primitives[0].indices], [0, 1, 2]);
  assert.deepEqual(m.bounds, { min: [0, 0, 0], max: [1, 1, 0] });
  assert.deepEqual(m.warnings, []);
});

test('node transforms compose down the hierarchy, and normals turn but stay unit length', async () => {
  // parent: move 10 along x · child: turn 90° about z, then scale 2.
  const s = Math.SQRT1_2;
  const normals = Float32Array.from([1, 0, 0, 1, 0, 0, 1, 0, 0]);
  const { json, bin } = model({
    positions: TRI,
    nodes: [
      { translation: [10, 0, 0], children: [1] },
      { mesh: 0, rotation: [0, 0, s, s], scale: [2, 2, 2] },
    ],
    extraArrays: [normals],
  });
  json.accessors.push({ bufferView: 1, componentType: 5126, count: 3, type: 'VEC3' });
  json.meshes[0].primitives[0].attributes.NORMAL = 1;
  const m = await openGltf(glb(json, bin));
  const p = m.primitives[0];
  // (1,0,0) → scale (2,0,0) → turn (0,2,0) → move (10,2,0)
  assert.ok(near(p.positions.subarray(3, 6), [10, 2, 0]), `${[...p.positions]}`);
  assert.ok(near(p.positions.subarray(6, 9), [8, 0, 0]));
  assert.ok(near(p.normals.subarray(0, 3), [0, 1, 0]), `normal ${[...p.normals.subarray(0, 3)]}`);

  // A squash tells the right rule from the naive one: stretched 2× in x,
  // a 45° surface tilts toward y, so its normal (1,1,0)/√2 must become
  // (1,2,0)/√5 — the inverse transpose — not (2,1,0)/√5.
  const tilted = Float32Array.from([s, s, 0, s, s, 0, s, s, 0]);
  const { json: jn, bin: bn } = model({ positions: TRI, nodes: [{ mesh: 0, scale: [2, 1, 1] }], extraArrays: [tilted] });
  jn.accessors.push({ bufferView: 1, componentType: 5126, count: 3, type: 'VEC3' });
  jn.meshes[0].primitives[0].attributes.NORMAL = 1;
  const squashed = await openGltf(glb(jn, bn));
  assert.ok(near(squashed.primitives[0].normals.subarray(0, 3), [1 / Math.sqrt(5), 2 / Math.sqrt(5), 0]));

  // The same thing as a single matrix (column-major).
  const { json: j2, bin: b2 } = model({
    positions: TRI,
    nodes: [{ mesh: 0, matrix: [0, 2, 0, 0, -2, 0, 0, 0, 0, 0, 2, 0, 10, 0, 0, 1] }],
  });
  const m2 = await openGltf(glb(j2, b2));
  assert.ok(near(m2.primitives[0].positions.subarray(3, 6), [10, 2, 0]));
});

test('interleaved, normalized data: a stride shared by positions and byte colors', async () => {
  // Each vertex: x y z as float32, then r g b a as unsigned bytes — 16 bytes.
  const bin = new Uint8Array(48);
  const dv = new DataView(bin.buffer);
  const rgba = [[255, 0, 0, 255], [0, 255, 0, 255], [0, 0, 255, 128]];
  TRI.forEach((v, i) => dv.setFloat32(Math.floor(i / 3) * 16 + (i % 3) * 4, v, true));
  rgba.forEach((c, v) => c.forEach((x, k) => dv.setUint8(v * 16 + 12 + k, x)));
  const json = {
    asset: { version: '2.0' },
    buffers: [{ byteLength: 48 }],
    bufferViews: [{ buffer: 0, byteLength: 48, byteStride: 16 }],
    accessors: [
      { bufferView: 0, componentType: 5126, count: 3, type: 'VEC3' },
      { bufferView: 0, byteOffset: 12, componentType: 5121, normalized: true, count: 3, type: 'VEC4' },
    ],
    meshes: [{ primitives: [{ attributes: { POSITION: 0, COLOR_0: 1 } }] }],
    nodes: [{ mesh: 0 }],
  };
  const m = await openGltf(glb(json, bin));
  const p = m.primitives[0];
  assert.ok(near(p.positions, TRI));
  assert.ok(near(p.colors, [1, 0, 0, 1, 0, 1, 0, 1, 0, 0, 1, 128 / 255]));
  assert.deepEqual([...p.indices], [0, 1, 2], 'no indices: the vertices in order');
});

test('strips and fans become plain triangles, keeping each face the same way round', async () => {
  const quad = [0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0];
  const strip = await openGltf(glb(...Object.values(model({ positions: quad, indices: [0, 1, 2, 3], mode: 5 }))));
  assert.deepEqual([...strip.primitives[0].indices], [0, 1, 2, 2, 1, 3]);
  const fan = await openGltf(glb(...Object.values(model({ positions: quad, indices: [0, 1, 3, 2], mode: 6 }))));
  assert.deepEqual([...fan.primitives[0].indices], [0, 1, 3, 0, 3, 2]);
});

test('sparse accessors overwrite their base values', async () => {
  const { json, bin } = model({
    positions: TRI,
    extraArrays: [Uint16Array.from([2]), Float32Array.from([5, 5, 5])],
  });
  json.accessors[0].sparse = {
    count: 1,
    indices: { bufferView: 1, componentType: 5123 },
    values: { bufferView: 2 },
  };
  const m = await openGltf(glb(json, bin));
  assert.ok(near(m.primitives[0].positions.subarray(6, 9), [5, 5, 5]));
  assert.ok(near(m.primitives[0].positions.subarray(0, 3), [0, 0, 0]));
});

test('a .gltf whose buffer is a data URI', async () => {
  const { json, bin } = model({ positions: TRI, indices: [0, 1, 2] });
  json.buffers[0].uri = `data:application/octet-stream;base64,${Buffer.from(bin).toString('base64')}`;
  const m = await openGltf(new TextEncoder().encode(JSON.stringify(json)));
  assert.equal(m.triangles, 1);
  // A separate .bin file can only be read if the caller can fetch it.
  json.buffers[0].uri = 'model.bin';
  await assert.rejects(openGltf(new TextEncoder().encode(JSON.stringify(json))), /separate buffer file/);
  const m2 = await openGltf(new TextEncoder().encode(JSON.stringify(json)), { resolve: async () => bin });
  assert.equal(m2.triangles, 1);
});

test('materials: base color, a texture with its sampler and texCoord, alpha, unlit, older spec-gloss', async () => {
  const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47]); // only the bytes travel; decoding is the browser's
  const { json, bin } = model({ positions: TRI, material: 0, extraArrays: [png] });
  json.materials = [
    {
      pbrMetallicRoughness: { baseColorFactor: [1, 0.5, 0.25, 1], baseColorTexture: { index: 0, texCoord: 0 } },
      alphaMode: 'MASK',
      alphaCutoff: 0.3,
      extensions: { KHR_materials_unlit: {} },
    },
  ];
  json.textures = [{ source: 0, sampler: 0 }];
  json.samplers = [{ wrapS: 33071, wrapT: 33648 }];
  json.images = [{ bufferView: 1, mimeType: 'image/png' }];
  const m = await openGltf(glb(json, bin));
  const mat = m.primitives[0].material;
  assert.deepEqual(mat.color, [1, 0.5, 0.25, 1]);
  assert.deepEqual(mat.texture, { image: 0, sampler: { wrapS: 33071, wrapT: 33648 }, texCoord: 0 });
  assert.equal(mat.alphaMode, 'MASK');
  assert.equal(mat.alphaCutoff, 0.3);
  assert.equal(mat.unlit, true);
  assert.deepEqual([...m.images[0].bytes], [...png]);
  assert.equal(m.images[0].mimeType, 'image/png');

  json.materials = [{ extensions: { KHR_materials_pbrSpecularGlossiness: { diffuseFactor: [0, 1, 0, 1] } } }];
  const sg = await openGltf(glb(json, bin));
  assert.deepEqual(sg.primitives[0].material.color, [0, 1, 0, 1]);
});

test('a mesh used by two nodes is drawn twice, once where each node puts it', async () => {
  const { json, bin } = model({
    positions: TRI,
    nodes: [{ children: [1, 2] }, { mesh: 0 }, { mesh: 0, translation: [0, 0, 3] }],
  });
  const m = await openGltf(glb(json, bin));
  assert.equal(m.triangles, 2);
  assert.equal(m.bounds.max[2], 3);
});

test('refused by name, not guessed at: compressed or instanced geometry', async () => {
  for (const [ext, words] of [
    ['KHR_draco_mesh_compression', /Draco/],
    ['EXT_meshopt_compression', /meshopt/],
    ['EXT_mesh_gpu_instancing', /instancing/],
  ]) {
    const { json, bin } = model({ positions: TRI, extra: { extensionsUsed: [ext], extensionsRequired: [ext] } });
    await assert.rejects(openGltf(glb(json, bin)), (e) => e instanceof GltfError && words.test(e.message));
  }
});

test('broken files fail as GltfErrors with a reason, never as crashes', async () => {
  const good = model({ positions: TRI, indices: [0, 1, 2] });
  const bytes = glb(good.json, good.bin);
  const cases = {
    'cut short': bytes.subarray(0, bytes.length - 8),
    'not glTF at all': new TextEncoder().encode('hello'),
    'an index past the vertices': glb(model({ positions: TRI, indices: [0, 1, 7] }).json, model({ positions: TRI, indices: [0, 1, 7] }).bin),
  };
  const overrun = model({ positions: TRI });
  overrun.json.accessors[0].count = 99;
  cases['an accessor past its data'] = glb(overrun.json, overrun.bin);
  const loop = model({ positions: TRI, nodes: [{ mesh: 0, children: [1] }, { children: [0] }] });
  cases['a scene graph that loops'] = glb(loop.json, loop.bin);
  const old = model({ positions: TRI, extra: { asset: { version: '1.0' } } });
  cases['glTF 1.0'] = glb(old.json, old.bin);
  for (const [what, file] of Object.entries(cases)) {
    await assert.rejects(openGltf(file), GltfError, what);
  }
  assert.throws(() => readGlb(new Uint8Array(4)), GltfError);
});
