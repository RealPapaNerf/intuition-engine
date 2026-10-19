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

export const ANT = {
  name: 'ant',
  axialStiffness: 60,
  tensionLimit: 1.2,
  compressionLimit: 0,
  tensionOnly: true,
  damping: 1.5,
};

export const WOOD = {
  name: 'wood',
  axialStiffness: 5000,
  tensionLimit: 40,
  compressionLimit: 40,
  tensionOnly: false,
  damping: 2.0,
};

export const SILK = {
  name: 'silk',
  axialStiffness: 8,
  tensionLimit: 2.5,
  compressionLimit: 0,
  tensionOnly: true,
  damping: 6.0,
};
