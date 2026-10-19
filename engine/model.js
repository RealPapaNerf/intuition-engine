// Model: nodes (point masses) and members (axial spring-dampers between
// them). Everything in the world is built from these two things — that
// compositional honesty is what makes unanticipated solutions possible.

export function makeModel({ gravity = 9.81 } = {}) {
  return { nodes: [], members: [], gravity };
}

export function addNode(model, { x, y, mass = 0.01, fixed = false }) {
  const n = { x, y, vx: 0, vy: 0, fx: 0, fy: 0, mass, fixed };
  model.nodes.push(n);
  return n;
}

// restLength defaults to the as-built distance: members are born unstressed.
export function addMember(model, a, b, material, restLength) {
  const m = {
    a,
    b,
    material,
    restLength: restLength ?? Math.hypot(b.x - a.x, b.y - a.y),
    broken: false,
    force: 0, // axial force [N]: + tension, − compression (updated each step)
  };
  model.members.push(m);
  return m;
}

export function activeMembers(model) {
  return model.members.filter((m) => !m.broken);
}

// |force| relative to the breaking load, 0..1+ (0 for a slack tension-only
// member). This is the "laziness" measure the shedder sorts by.
export function utilization(m) {
  if (m.force >= 0) {
    return m.material.tensionLimit > 0 ? m.force / m.material.tensionLimit : 0;
  }
  if (m.material.tensionOnly) return 0;
  return m.material.compressionLimit > 0
    ? -m.force / m.material.compressionLimit
    : 0;
}
