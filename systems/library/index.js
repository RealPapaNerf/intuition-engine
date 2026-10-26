// The built-in systems: the user's own first examples, one per kind of
// ground truth the laws can carry — a circuit (the flashlight), an organ
// (the kidneys), a cell and a virus (reactions that feed themselves), and
// a machine with buffers, feedback and ratings (the car). Each file is
// data only, like a skin, and is checked and frozen by
// systems/index.js before anything can run it.
import flashlight from './flashlight.js';
import kidneys from './kidneys.js';
import virus from './virus.js';
import car from './car.js';

export const LIBRARY_DATA = [flashlight, kidneys, virus, car];
