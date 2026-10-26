// The bathtub: the oldest example in systems teaching, and the one even
// grown-ups get wrong (Sweeney and Sterman's "bathtub dynamics", 2000):
// how deep is the water, given what the tap pours in and the drain lets
// out? A stock, an inflow, an outflow that grows with the depth. With
// the tap on and the plug out it settles where in = out — 8 L/min in,
// 0.8 L/min per cm of depth out, so 10 cm — and every change asks where
// it settles now, and how fast it gets there.
//
// It is also the Workbench's starting template: the smallest system that
// uses a store, a pump, a conduct, a fault, a copy and a goal with two
// lines. Data only.
export default {
  id: 'bathtub',
  title: 'The bathtub',
  icon: '🛁',
  model: 'A model of a bathtub with the tap running and the plug out.',
  intro:
    'The tap pours water in, and the drain lets water out — faster when the water is deeper. Right now the water stays just right. Take a part out, put a bad one in or add another, and say what the water does before you see it.',
  time: { unit: 'min', step: 0.1, run: 30 },
  substances: [{ id: 'water', name: 'water', amount: 'L', level: 'cm', flow: 'L/min', color: '#3b82c4' }],
  nodes: [
    // 6 litres raise the water 1 cm, so the store's level is the depth.
    { id: 'tub', substance: 'water', name: 'water in the tub', kind: 'store', capacity: 6, start: 60, at: [1, 0.15] },
    { id: 'pipes', substance: 'water', name: 'down the drain', kind: 'fixed', level: 0, at: [2.6, 1] },
  ],
  parts: [
    {
      id: 'tap',
      name: 'Tap',
      icon: '🚰',
      says: 'The bath tap, turned on.',
      job: 'pours water into the tub',
      at: [0, 0],
      copies: 1,
      flows: [{ id: 'pour', law: 'pump', from: null, to: 'tub', rate: 8 }],
      faults: [{ id: 'dribble', name: 'a tap that only dribbles', icon: '💧', changes: [{ flow: 'pour', scale: { rate: 0.2 } }] }],
    },
    {
      id: 'drain',
      name: 'Drain',
      icon: '🕳️',
      says: 'The plughole, with the plug out.',
      job: 'lets water out — faster when the water is deeper',
      at: [2, 0],
      copies: 1,
      flows: [{ id: 'away', law: 'conduct', from: 'tub', to: 'pipes', g: 0.8 }],
      faults: [{ id: 'clogged', name: 'a clogged drain', icon: '🧽', changes: [{ flow: 'away', scale: { g: 0.2 } }] }],
    },
  ],
  goal: {
    says: 'The water stays between ankle-deep and the top.',
    asks: 'Will the water stay between ankle-deep and the top?',
    checks: [
      { read: { node: 'tub' }, above: 5, fails: 'The tub ran almost dry.' },
      { read: { node: 'tub' }, below: 30, fails: 'The tub overflowed.' },
    ],
  },
  measure: {
    says: 'How deep does the water get, at its deepest?',
    read: { node: 'tub', stat: 'max' },
    unit: 'cm',
    max: 60,
    resolution: 1,
  },
  notes: [
    'A real drain runs faster with deeper water, but by the square root of the depth, not in proportion to it as here.',
    'A real tub has sloping sides, so a centimetre near the top holds more water than one near the bottom. This one has straight sides.',
  ],
  sources: ['A bath tap pours roughly 8 to 12 litres a minute; a bath holds 150 to 200 litres.'],
};
