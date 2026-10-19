// Time stepping and statics.
//
// Dynamics: semi-implicit Euler over axial spring-dampers under gravity.
// Statics: dynamic relaxation — step with damping until kinetic energy
// dies, and the resting state IS the static equilibrium. One engine gives
// both the frog standing still and the boulder hitting the silk net.

export function step(model, dt) {
  for (const n of model.nodes) {
    n.fx = 0;
    n.fy = n.fixed ? 0 : -n.mass * model.gravity;
  }

  for (const m of model.members) {
    if (m.broken) continue;
    const dx = m.b.x - m.a.x;
    const dy = m.b.y - m.a.y;
    const len = Math.hypot(dx, dy) || 1e-12;
    const ux = dx / len;
    const uy = dy / len;

    const strain = (len - m.restLength) / m.restLength;
    let f = m.material.axialStiffness * strain; // + tension
    if (m.material.tensionOnly && f < 0) f = 0; // slack: an ant cannot push
    m.force = f;

    // Axial damping on the relative velocity along the member. A slack
    // tension-only member transmits nothing, damping included. The
    // damping impulse is clamped to the one that would zero the relative
    // velocity this step — any more is numerically unstable for light
    // nodes (it reverses the velocity and pumps energy in).
    let ft = f;
    if (!(m.material.tensionOnly && f === 0)) {
      const relv = (m.b.vx - m.a.vx) * ux + (m.b.vy - m.a.vy) * uy;
      const ma = m.a.fixed ? Infinity : m.a.mass;
      const mb = m.b.fixed ? Infinity : m.b.mass;
      const mRed =
        ma === Infinity ? mb : mb === Infinity ? ma : (ma * mb) / (ma + mb);
      const fdMax = (mRed * Math.abs(relv)) / dt;
      const fd = m.material.damping * relv;
      ft += Math.max(-fdMax, Math.min(fdMax, fd));
    }

    m.a.fx += ft * ux;
    m.a.fy += ft * uy;
    m.b.fx -= ft * ux;
    m.b.fy -= ft * uy;
  }

  for (const n of model.nodes) {
    if (n.fixed) {
      n.vx = 0;
      n.vy = 0;
      continue;
    }
    n.vx += (n.fx / n.mass) * dt;
    n.vy += (n.fy / n.mass) * dt;
    n.x += n.vx * dt;
    n.y += n.vy * dt;
  }
}

export function kineticEnergy(model) {
  let ke = 0;
  for (const n of model.nodes) {
    if (!n.fixed) ke += 0.5 * n.mass * (n.vx * n.vx + n.vy * n.vy);
  }
  return ke;
}

// Settle to static equilibrium by dynamic relaxation. Extra velocity
// bleed (`relax`) kills oscillation without changing the equilibrium —
// damping forces vanish when velocities do.
export function settle(
  model,
  { dt = 0.0008, maxSteps = 200000, tol = 1e-9, relax = 0.995 } = {},
) {
  let steps = 0;
  for (; steps < maxSteps; steps++) {
    step(model, dt);
    for (const n of model.nodes) {
      if (!n.fixed) {
        n.vx *= relax;
        n.vy *= relax;
      }
    }
    if (steps % 200 === 199 && kineticEnergy(model) < tol) {
      return { settled: true, steps: steps + 1 };
    }
  }
  return { settled: kineticEnergy(model) < tol, steps };
}

// Mark members whose axial force exceeds their material limits as broken.
// Returns the members that broke on this call.
export function checkBreaks(model) {
  const broke = [];
  for (const m of model.members) {
    if (m.broken) continue;
    const overTension = m.force > m.material.tensionLimit;
    const overCompression =
      !m.material.tensionOnly && -m.force > m.material.compressionLimit;
    if (overTension || overCompression) {
      m.broken = true;
      m.force = 0;
      broke.push(m);
    }
  }
  return broke;
}
