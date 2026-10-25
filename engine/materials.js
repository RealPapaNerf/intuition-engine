// Creature materials. Units are SI (meters, kilograms, newtons, seconds).
//
// The *relationships* are honest — linear elasticity (force = EA * strain),
// equilibrium under gravity, tension-only slackness — and the tests validate
// them against hand calculations. The *constants* are fantasy, scaled so a
// kid-sized scene (a 1 m gap, a 50 g frog) behaves legibly on screen.
//
// Fields:
//   axialStiffness  EA [N]  — axial force per unit strain
//   tensionLimit    [N]     — axial tension at which the member breaks
//   compressionLimit[N]     — axial compression at which the member breaks
//   tensionOnly     bool    — if true, the member goes slack instead of
//                             pushing back (an ant cannot push)
//   damping         [N·s/m] — axial damping (silk absorbs; wood barely)
//   mass            [kg]    — one creature's mass, for materials that come
//                             one creature per member. Placed members carry
//                             it (blueprint.js); addMember stays massless
//                             unless told otherwise.
//
// Frozen: these are the honest parameters, and nothing at runtime — a
// skin least of all — may change them (decisions 2026-10-22 §4).

export const ANT = Object.freeze({
  name: 'ant',
  axialStiffness: 60,
  tensionLimit: 1.2,
  compressionLimit: 0,
  tensionOnly: true,
  damping: 1.5,
  mass: 0.0015, // the old fixed demo bridge's weight per ant (≈40 g / 25)
});

export const WOOD = Object.freeze({
  name: 'wood',
  // Stiff enough to read as wood next to an ant (17× the ant), soft
  // enough that a placed grid-length stick with its own small mass
  // integrates stably at the crossing's dt: ω = √(EA/L / (m/2)) must
  // stay under the stepper's limit. 5000 with light placed nodes blew
  // past it (ω·dt ≈ 3.6 → explosion); 1000 at 8 g sits near 1.3 with
  // damping in hand. Fantasy constants, legible scene — and now also
  // solver-legible.
  axialStiffness: 1000,
  tensionLimit: 40,
  compressionLimit: 40,
  tensionOnly: false,
  damping: 2.0,
  // One placed stick's weight. The solver treats a zero-mass node as
  // immovable, so a massless free body would hang in the sky like a
  // hook — placed wood and silk must weigh something for "an unheld
  // object falls" to be true (decisions 2026-10-25, free items §1).
  // 8 g: heavier than five ants, still holdable by one (1.2 N ≈ 120 g).
  mass: 0.008, //                                           REVISIT
});

export const SILK = Object.freeze({
  name: 'silk',
  axialStiffness: 8,
  tensionLimit: 2.5,
  compressionLimit: 0,
  tensionOnly: true,
  damping: 6.0,
  mass: 0.0002, // a strand weighs nearly nothing — but it falls  REVISIT
});

// The catalog: every material a blueprint link or a grant may name.
// Names resolve only through here — nothing at runtime hands the solver
// a material object of its own (decisions 2026-10-25 §2).
export const MATERIALS = Object.freeze({
  ant: ANT,
  wood: WOOD,
  silk: SILK,
});
