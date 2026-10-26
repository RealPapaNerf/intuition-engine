// The flashlight: a tiny circuit board, the user's own example, and the
// cleanest ground truth in the pack — Ohm's law with nothing approximated
// but the LED. Two cells, a switch, a resistor, a red LED, and the wire
// back. Its lessons: a circuit is a loop (cut any piece of it and the
// light goes out), the resistor is what keeps the light alive (swap in a
// plain wire and the LED burns out in a flash), and fixing what burned
// is not fixing why it burned (put a new LED in without fixing the
// resistor and it burns too).
//
// Units are chosen so the numbers read as a hobbyist reads them:
// charge in millicoulombs, so a flow is in milliamps; conductance in
// millisiemens (1000 / ohms). Data only, like a skin: checked and frozen
// by systems/library/index.js.
export default {
  id: 'flashlight',
  title: 'The flashlight',
  icon: '🔦',
  model: 'A model of a tiny flashlight circuit board: two AA cells, a switch, a resistor and a red LED.',
  intro:
    'This is the circuit board inside a little flashlight. The batteries push electricity around a loop, through the switch, the resistor and the light, and back. Right now it shines. Pull a part out, or swap in a bad one, and say what will happen before you see it.',
  time: { unit: 's', step: 1, run: 60 },
  substances: [{ id: 'charge', name: 'electricity', amount: 'mC', level: 'V', flow: 'mA', color: '#d4a017' }],
  nodes: [
    // Two fresh AA cells: 2,500 mAh at 3.0 V. Their push fades as they
    // empty — linearly here (see notes).
    { id: 'cells', substance: 'charge', name: 'stored electricity', kind: 'store', capacity: 3000000, start: 9000000 },
    { id: 'minus', substance: 'charge', name: 'the batteries’ minus end', kind: 'fixed', level: 0 },
    { id: 'plus', substance: 'charge', name: 'plus wire', kind: 'junction', at: [0, 0] },
    { id: 'mid', substance: 'charge', name: 'wire after the switch', kind: 'junction', at: [2, 0] },
    { id: 'anode', substance: 'charge', name: 'wire into the light', kind: 'junction', at: [4, 0] },
    { id: 'back', substance: 'charge', name: 'wire out of the light', kind: 'junction', at: [4, 2] },
  ],
  parts: [
    {
      id: 'batteries',
      name: 'Batteries',
      icon: '🔋',
      says: 'Two AA batteries.',
      job: 'push electricity around the loop',
      at: [0, 1],
      copies: 1,
      holds: ['cells', 'minus'],
      flows: [{ id: 'inside', law: 'conduct', from: 'cells', to: 'plus', g: 3333 }], // 0.3 Ω inside the pair
      faults: [
        { id: 'flat', name: 'flat batteries', icon: '🪫', changes: [{ node: 'cells', start: 0.55 }] },
        { id: 'tired', name: 'tired batteries', icon: '🪫', changes: [{ node: 'cells', start: 0.66 }] },
      ],
    },
    {
      id: 'switch',
      name: 'Switch',
      icon: '🔘',
      says: 'The switch, switched on.',
      job: 'joins the two wires when it is on',
      at: [1, 0],
      copies: 1,
      flows: [{ id: 'contact', law: 'conduct', from: 'plus', to: 'mid', g: 20000 }], // 0.05 Ω
      faults: [{ id: 'stuck-off', name: 'a switch stuck off', changes: [{ flow: 'contact', set: { g: 0 } }] }],
    },
    {
      id: 'resistor',
      name: 'Resistor',
      icon: '〰️',
      says: 'A little striped part that electricity has to squeeze through: 47 ohms.',
      job: 'squeezes the electricity down to a trickle the light can take',
      at: [3, 0],
      copies: 2,
      flows: [{ id: 'squeeze', law: 'conduct', from: 'mid', to: 'anode', g: 21.28 }], // 47 Ω
      faults: [
        { id: 'jumper', name: 'a plain wire instead', icon: '➖', changes: [{ flow: 'squeeze', set: { g: 50000 } }] }, // 0.02 Ω
        { id: 'too-small', name: 'one too small (10 ohms)', changes: [{ flow: 'squeeze', set: { g: 100 } }] },
        { id: 'too-big', name: 'one too big (10,000 ohms)', changes: [{ flow: 'squeeze', set: { g: 0.1 } }] },
      ],
    },
    {
      id: 'led',
      name: 'Light (LED)',
      icon: '💡',
      says: 'A red light-emitting diode.',
      job: 'glows when electricity goes through it, and only lets it through one way',
      at: [4, 1],
      copies: 2,
      // Needs 1.8 V before it lets anything through, then acts like 10 Ω;
      // 30 mA is the most it can take.
      flows: [{ id: 'glow', law: 'oneway', from: 'anode', to: 'back', g: 100, drop: 1.8 }],
      ratings: [{ flow: 'glow', above: 30 }],
      faults: [
        { id: 'burnt', name: 'a burnt-out light', icon: '💥', changes: [{ broken: true }] },
        { id: 'backwards', name: 'a light put in backwards', icon: '🔄', changes: [{ flow: 'glow', reverse: true }] },
      ],
    },
    {
      id: 'wire',
      name: 'Wire back',
      icon: '➰',
      says: 'The copper path from the light back to the batteries.',
      job: 'carries the electricity back to the batteries',
      at: [2, 2],
      copies: 1,
      flows: [{ id: 'return', law: 'conduct', from: 'back', to: 'minus', g: 50000 }], // 0.02 Ω
      faults: [{ id: 'cut', name: 'a cut wire', icon: '✂️', changes: [{ flow: 'return', set: { g: 0 } }] }],
    },
  ],
  goal: {
    says: 'The flashlight shines.',
    asks: 'Will the flashlight still shine?',
    checks: [{ read: { flow: 'glow' }, above: 2, fails: 'The light went dark.' }],
  },
  measure: {
    says: 'How much electricity goes through the light, at the most?',
    read: { flow: 'glow', stat: 'max' },
    unit: 'mA',
    max: 150,
    resolution: 1,
  },
  notes: [
    'A real battery keeps its push almost steady and then fades near the end. This one fades steadily the whole time, so over hours it would go dim sooner than a real one.',
    'A real LED starts glowing faintly a little before 1.8 volts and brightens smoothly. This one is either off or on at 1.8.',
    'A real LED burns out from heat a moment after too much electricity starts. This one burns out the instant it passes its limit.',
  ],
  sources: [
    'A typical 5 mm red LED: about 1.8 to 2.2 volts to switch on, 20 milliamps for everyday use, 30 milliamps at most (manufacturers’ datasheets).',
    'A fresh AA alkaline cell: about 1.5 volts, about 2,500 milliamp-hours, and roughly 0.15 ohms inside.',
  ],
};
