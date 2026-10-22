// glTF 2.0, read just far enough to see a model: its triangles, their
// colors and textures, posed by the scene's transforms. Zero
// dependencies (CLAUDE.md). A file from a library is untrusted input,
// so every offset is checked and every size capped, and a feature the
// portal can't draw faithfully is refused by name, never guessed at.
//
// What comes out is a costume's raw material and nothing more: the
// solver stays 2D and never sees a model (decisions 2026-10-22 §5).

export const LIMITS = Object.freeze({
  bytes: 48 * 1024 * 1024, // one file
  triangles: 250000,
  images: 64,
  depth: 64, // node nesting
});

const MAGIC = 0x46546c67; // "glTF"
const CHUNK_JSON = 0x4e4f534a;
const CHUNK_BIN = 0x004e4942;

// Extensions that change what the geometry is: without them there is
// nothing honest to draw.
const REFUSED = {
  KHR_draco_mesh_compression: 'Draco-compressed geometry',
  EXT_meshopt_compression: 'meshopt-compressed geometry',
  EXT_mesh_gpu_instancing: 'GPU instancing',
};

export class GltfError extends Error {}

function fail(message) {
  throw new GltfError(message);
}

function parseJson(bytes) {
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return fail('the file is not valid glTF (its JSON could not be read)');
  }
}

function dataView(bytes) {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

export function isGlb(bytes) {
  return bytes.byteLength >= 12 && dataView(bytes).getUint32(0, true) === MAGIC;
}

// A .glb is a header and chunks: one JSON, then (usually) one binary.
export function readGlb(bytes) {
  const dv = dataView(bytes);
  if (bytes.byteLength < 20 || dv.getUint32(0, true) !== MAGIC) fail('not a .glb file');
  const version = dv.getUint32(4, true);
  if (version !== 2) fail(`glTF version ${version}: only version 2 can be read`);
  const total = dv.getUint32(8, true);
  if (total > bytes.byteLength) fail('the .glb file is cut short');
  let json = null;
  let bin = null;
  for (let at = 12; at + 8 <= total; ) {
    const length = dv.getUint32(at, true);
    const type = dv.getUint32(at + 4, true);
    const start = at + 8;
    if (start + length > total) fail('a .glb chunk runs past the end of the file');
    if (type === CHUNK_JSON && json === null) {
      json = parseJson(bytes.subarray(start, start + length));
    } else if (type === CHUNK_BIN && bin === null) {
      bin = bytes.subarray(start, start + length);
    }
    at = start + length + ((4 - (length % 4)) % 4);
  }
  if (json === null) fail('the .glb file has no JSON chunk');
  return { json, bin };
}

function fromDataUri(uri) {
  const m = /^data:([^;,]*)(;base64)?,(.*)$/s.exec(uri);
  if (!m) return null;
  if (!m[2]) return new TextEncoder().encode(decodeURIComponent(m[3]));
  const raw = atob(m[3]);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

// Open a .glb or .gltf file. Separate files a .gltf points at are read
// through `resolve(uri) → bytes`, when the caller can fetch them (from
// the same allowlisted place); without it, they are refused or skipped.
export async function openGltf(bytes, { resolve } = {}) {
  if (bytes.byteLength > LIMITS.bytes) fail('the file is too big to import');
  let json;
  let bin = null;
  if (isGlb(bytes)) ({ json, bin } = readGlb(bytes));
  else json = parseJson(bytes);
  const fetchUri = async (uri, what) => {
    const inline = fromDataUri(uri);
    if (inline) return inline;
    if (!resolve) fail(`the model needs a separate ${what} file (${uri}) that can't be fetched here`);
    return new Uint8Array(await resolve(uri));
  };
  const buffers = await Promise.all(
    (json.buffers ?? []).map((b, i) => {
      if (b.uri === undefined) return i === 0 && bin ? bin : fail('a buffer has no data');
      return fetchUri(b.uri, 'buffer');
    }),
  );
  const model = readModel(json, buffers);
  for (const image of model.images) {
    if (image.uri !== undefined && resolve) {
      try {
        image.bytes = await fetchUri(image.uri, 'texture');
      } catch {
        model.warnings.push(`texture ${image.uri} couldn't be fetched; drawn without it`);
      }
    }
  }
  return model;
}

// --- Accessors --------------------------------------------------------------

const COMPONENTS = {
  5120: { size: 1, get: 'getInt8', max: 127 },
  5121: { size: 1, get: 'getUint8', max: 255 },
  5122: { size: 2, get: 'getInt16', max: 32767 },
  5123: { size: 2, get: 'getUint16', max: 65535 },
  5125: { size: 4, get: 'getUint32', max: 4294967295 },
  5126: { size: 4, get: 'getFloat32', max: 0 },
};
const WIDTHS = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 };

function reader(json, buffers) {
  const view = (i) => {
    const v = json.bufferViews?.[i] ?? fail(`bufferView ${i} is missing`);
    const buffer = buffers[v.buffer] ?? fail(`buffer ${v.buffer} is missing`);
    const offset = v.byteOffset ?? 0;
    if (!(v.byteLength >= 0) || offset + v.byteLength > buffer.byteLength) {
      fail('a bufferView runs past the end of its buffer');
    }
    return { bytes: buffer.subarray(offset, offset + v.byteLength), stride: v.byteStride ?? 0 };
  };

  // Read `count` elements of `width` components from a view, as numbers.
  const read = (bytes, stride, offset, count, width, componentType, normalized, out, outOffset = 0) => {
    const c = COMPONENTS[componentType] ?? fail(`unknown component type ${componentType}`);
    const element = c.size * width;
    const step = stride || element;
    if (count > 0 && offset + step * (count - 1) + element > bytes.byteLength) {
      fail('an accessor runs past the end of its bufferView');
    }
    const dv = dataView(bytes);
    for (let i = 0; i < count; i++) {
      for (let k = 0; k < width; k++) {
        const at = offset + i * step + k * c.size;
        let v = c.size === 1 ? dv[c.get](at) : dv[c.get](at, true);
        if (normalized && c.max) v = Math.max(v / c.max, -1);
        out[outOffset + i * width + k] = v;
      }
    }
  };

  const accessor = (i) => {
    const a = json.accessors?.[i] ?? fail(`accessor ${i} is missing`);
    const width = WIDTHS[a.type] ?? fail(`unknown accessor type ${a.type}`);
    if (!(a.count >= 0) || a.count * width > 64 * 1024 * 1024) fail('an accessor is implausibly large');
    const out = new Float32Array(a.count * width);
    if (a.bufferView !== undefined) {
      const { bytes, stride } = view(a.bufferView);
      read(bytes, stride, a.byteOffset ?? 0, a.count, width, a.componentType, a.normalized, out);
    }
    if (a.sparse) {
      const s = a.sparse;
      const at = new Float32Array(s.count);
      const iv = view(s.indices.bufferView);
      read(iv.bytes, 0, s.indices.byteOffset ?? 0, s.count, 1, s.indices.componentType, false, at);
      const vv = view(s.values.bufferView);
      const values = new Float32Array(s.count * width);
      read(vv.bytes, 0, s.values.byteOffset ?? 0, s.count, width, a.componentType, a.normalized, values);
      for (let k = 0; k < s.count; k++) {
        if (!(at[k] < a.count)) fail('a sparse accessor points past its end');
        out.set(values.subarray(k * width, (k + 1) * width), at[k] * width);
      }
    }
    return { values: out, count: a.count, width };
  };

  // Indices are read as integers: a float would round past 2²⁴.
  const indices = (i) => {
    const a = json.accessors?.[i] ?? fail(`accessor ${i} is missing`);
    const c = COMPONENTS[a.componentType];
    if (!c || c.get === 'getFloat32' || c.get.startsWith('getInt')) fail('indices must be unsigned integers');
    const out = new Uint32Array(a.count);
    const { bytes, stride } = view(a.bufferView);
    read(bytes, stride, a.byteOffset ?? 0, a.count, 1, a.componentType, false, out);
    return out;
  };

  return { accessor, indices, view };
}

// --- Transforms (column-major 4×4, as glTF writes them) ---------------------

function multiply(a, b) {
  const out = new Float64Array(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
      out[c * 4 + r] = s;
    }
  }
  return out;
}

const IDENTITY = new Float64Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

export function localMatrix(node) {
  if (node.matrix) {
    if (node.matrix.length !== 16) fail('a node matrix needs 16 numbers');
    return Float64Array.from(node.matrix);
  }
  const [tx, ty, tz] = node.translation ?? [0, 0, 0];
  const [qx, qy, qz, qw] = node.rotation ?? [0, 0, 0, 1];
  const [sx, sy, sz] = node.scale ?? [1, 1, 1];
  const xx = qx * qx;
  const yy = qy * qy;
  const zz = qz * qz;
  const xy = qx * qy;
  const xz = qx * qz;
  const yz = qy * qz;
  const wx = qw * qx;
  const wy = qw * qy;
  const wz = qw * qz;
  return new Float64Array([
    (1 - 2 * (yy + zz)) * sx, 2 * (xy + wz) * sx, 2 * (xz - wy) * sx, 0,
    2 * (xy - wz) * sy, (1 - 2 * (xx + zz)) * sy, 2 * (yz + wx) * sy, 0,
    2 * (xz + wy) * sz, 2 * (yz - wx) * sz, (1 - 2 * (xx + yy)) * sz, 0,
    tx, ty, tz, 1,
  ]);
}

// The inverse transpose of the upper 3×3: how normals turn.
function normalMatrix(m) {
  const [a, b, c, d, e, f, g, h, i] = [m[0], m[1], m[2], m[4], m[5], m[6], m[8], m[9], m[10]];
  const A = e * i - f * h;
  const B = -(d * i - f * g);
  const C = d * h - e * g;
  const det = a * A + b * B + c * C;
  if (Math.abs(det) < 1e-20) return null;
  // (M⁻¹)ᵀ = cofactor matrix / det, laid out column-major
  return [
    A / det, B / det, C / det,
    -(b * i - c * h) / det, (a * i - c * g) / det, -(a * h - b * g) / det,
    (b * f - c * e) / det, -(a * f - c * d) / det, (a * e - b * d) / det,
  ];
}

// --- Materials --------------------------------------------------------------

const PLAIN = Object.freeze({
  color: [1, 1, 1, 1],
  texture: null,
  alphaMode: 'OPAQUE',
  alphaCutoff: 0.5,
  unlit: false,
});

function material(json, index, warnings) {
  if (index === undefined) return PLAIN;
  const m = json.materials?.[index];
  if (!m) return PLAIN;
  const pbr = m.pbrMetallicRoughness ?? {};
  const sg = m.extensions?.KHR_materials_pbrSpecularGlossiness; // older exports
  const info = sg?.diffuseTexture ?? pbr.baseColorTexture;
  let texture = null;
  if (info) {
    const t = json.textures?.[info.index];
    const source = t?.source ?? t?.extensions?.EXT_texture_webp?.source;
    if (t && source === undefined && t.extensions?.KHR_texture_basisu) {
      warnings.add('KTX2/Basis textures can’t be decoded here; drawn in their base colors');
    } else if (t && source !== undefined) {
      texture = { image: source, sampler: json.samplers?.[t.sampler] ?? {}, texCoord: info.texCoord ?? 0 };
    }
  }
  return {
    color: [...(sg?.diffuseFactor ?? pbr.baseColorFactor ?? [1, 1, 1, 1])],
    texture,
    alphaMode: m.alphaMode ?? 'OPAQUE',
    alphaCutoff: m.alphaCutoff ?? 0.5,
    unlit: Boolean(m.extensions?.KHR_materials_unlit),
  };
}

// --- The model ----------------------------------------------------------------

// Read a parsed glTF (JSON plus its buffers, in order) into posed
// triangles: everything a picture of it needs, in the scene's units.
export function readModel(json, buffers) {
  if (!String(json?.asset?.version ?? '').startsWith('2')) fail('only glTF 2.0 files can be read');
  for (const ext of json.extensionsRequired ?? []) {
    if (REFUSED[ext]) fail(`this model uses ${REFUSED[ext]}, which the portal can't open yet — pick another`);
  }
  const warnings = new Set();
  const r = reader(json, buffers);

  const images = (json.images ?? []).slice(0, LIMITS.images).map((img) => {
    if (img.bufferView !== undefined) return { mimeType: img.mimeType, bytes: r.view(img.bufferView).bytes };
    const inline = img.uri !== undefined ? fromDataUri(img.uri) : null;
    if (inline) return { mimeType: img.mimeType ?? /^data:([^;,]*)/.exec(img.uri)[1], bytes: inline };
    return { mimeType: img.mimeType, uri: img.uri };
  });

  const nodes = json.nodes ?? [];
  let roots = json.scenes?.[json.scene ?? 0]?.nodes;
  if (!roots) {
    const children = new Set(nodes.flatMap((n) => n.children ?? []));
    roots = nodes.map((_, i) => i).filter((i) => !children.has(i));
  }

  const primitives = [];
  let triangles = 0;
  const visit = (index, parent, path) => {
    if (path.has(index) || path.size > LIMITS.depth) fail('the scene graph loops or nests too deep');
    const node = nodes[index] ?? fail(`node ${index} is missing`);
    const world = multiply(parent, localMatrix(node));
    if (node.mesh !== undefined) {
      const mesh = json.meshes?.[node.mesh] ?? fail(`mesh ${node.mesh} is missing`);
      for (const p of mesh.primitives ?? []) {
        const prim = primitive(json, r, p, world, warnings);
        if (!prim) continue;
        triangles += prim.indices.length / 3;
        if (triangles > LIMITS.triangles) fail('the model is too detailed to import (over 250,000 triangles)');
        primitives.push(prim);
      }
    }
    path.add(index);
    for (const child of node.children ?? []) visit(child, world, path);
    path.delete(index);
  };
  for (const root of roots) visit(root, IDENTITY, new Set());
  if (triangles === 0) fail('the model has no triangles to draw');

  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const p of primitives) {
    for (let i = 0; i < p.positions.length; i += 3) {
      for (let k = 0; k < 3; k++) {
        min[k] = Math.min(min[k], p.positions[i + k]);
        max[k] = Math.max(max[k], p.positions[i + k]);
      }
    }
  }
  return { primitives, images, triangles, bounds: { min, max }, warnings: [...warnings] };
}

function primitive(json, r, p, world, warnings) {
  const mode = p.mode ?? 4;
  if (mode < 4) {
    warnings.add('points and lines are skipped');
    return null;
  }
  if (p.attributes?.POSITION === undefined) fail('a primitive has no positions');
  const pos = r.accessor(p.attributes.POSITION);
  if (pos.width !== 3) fail('positions must be 3D');
  const mat = material(json, p.material, warnings);
  const uvName = `TEXCOORD_${mat.texture?.texCoord ?? 0}`;
  const nrm = p.attributes.NORMAL !== undefined ? r.accessor(p.attributes.NORMAL) : null;
  const uv = p.attributes[uvName] !== undefined ? r.accessor(p.attributes[uvName]) : null;
  const col = p.attributes.COLOR_0 !== undefined ? r.accessor(p.attributes.COLOR_0) : null;

  let order = p.indices !== undefined ? r.indices(p.indices) : Uint32Array.from({ length: pos.count }, (_, i) => i);
  for (const i of order) if (i >= pos.count) fail('an index points past the end of its vertices');
  if (mode === 5 || mode === 6) {
    const tris = [];
    for (let i = 2; i < order.length; i++) {
      if (mode === 6) tris.push(order[0], order[i - 1], order[i]);
      else if (i % 2 === 0) tris.push(order[i - 2], order[i - 1], order[i]);
      else tris.push(order[i - 1], order[i - 2], order[i]);
    }
    order = Uint32Array.from(tris);
  } else {
    order = order.subarray(0, order.length - (order.length % 3));
  }

  const positions = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.values[i * 3];
    const y = pos.values[i * 3 + 1];
    const z = pos.values[i * 3 + 2];
    positions[i * 3] = world[0] * x + world[4] * y + world[8] * z + world[12];
    positions[i * 3 + 1] = world[1] * x + world[5] * y + world[9] * z + world[13];
    positions[i * 3 + 2] = world[2] * x + world[6] * y + world[10] * z + world[14];
  }
  let normals = null;
  const nm = nrm ? normalMatrix(world) : null;
  if (nrm && nm) {
    normals = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const x = nrm.values[i * 3];
      const y = nrm.values[i * 3 + 1];
      const z = nrm.values[i * 3 + 2];
      const nx = nm[0] * x + nm[3] * y + nm[6] * z;
      const ny = nm[1] * x + nm[4] * y + nm[7] * z;
      const nz = nm[2] * x + nm[5] * y + nm[8] * z;
      const len = Math.hypot(nx, ny, nz) || 1;
      normals[i * 3] = nx / len;
      normals[i * 3 + 1] = ny / len;
      normals[i * 3 + 2] = nz / len;
    }
  }
  let colors = null;
  if (col) {
    colors = new Float32Array(pos.count * 4);
    for (let i = 0; i < pos.count; i++) {
      for (let k = 0; k < 4; k++) colors[i * 4 + k] = k < col.width ? col.values[i * col.width + k] : 1;
    }
  }
  return {
    positions,
    normals,
    uvs: uv && uv.width === 2 ? uv.values : null,
    colors,
    indices: order,
    material: mat,
  };
}
