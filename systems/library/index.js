// The built-in systems: the owner's own first examples, one per kind of
// ground truth the laws can carry — a circuit (the flashlight), an organ
// (the kidneys), a cell and a virus (reactions that feed themselves), a
// machine with buffers, feedback and ratings (the car) — and the
// bathtub, the simplest stock and flow there is, which is also the
// Workbench's template. Each file is data only, like a skin, and is
// checked and frozen by systems/index.js before anything can run it.
import flashlight from './flashlight.js';
import kidneys from './kidneys.js';
import virus from './virus.js';
import car from './car.js';
import bathtub from './bathtub.js';

export const LIBRARY_DATA = [flashlight, kidneys, virus, car, bathtub];
