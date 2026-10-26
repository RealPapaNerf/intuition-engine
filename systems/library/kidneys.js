// The kidneys: what does the kidney do? Pull one and find out — and find
// out that you had a spare. The body makes waste (urea) all day and
// drinks water all day; the kidneys take the waste out of the blood in
// proportion to how much is there, and let water out above a normal
// level, like a spillway. Two kidneys hold the waste at G/K = 4 mmol/L.
// One holds it at 8 — higher, and still nowhere near the line, which is
// the surprise. None, and the waste climbs a straight line forever,
// which is the other surprise: it takes a day and a half to matter, not
// a minute. Dialysis is a spare part the kid can put in.
//
// Every number is a textbook adult's, rounded (sources), and the model
// says what it leaves out (notes). Data only.
export default {
  id: 'kidneys',
  title: 'The kidneys',
  icon: '🫘',
  model: 'A model of how a grown-up’s two kidneys keep the blood clean and the body’s water just right, over a week.',
  intro:
    'Your body makes waste all day, just from living, and you drink water all day. Two kidneys keep the waste in your blood low and your water just right. Take a kidney out, give it a sick one, or add a machine, and say what happens to the blood before you watch a week go by.',
  time: { unit: 'h', step: 0.25, run: 168 },
  substances: [
    { id: 'urea', name: 'waste (urea)', amount: 'mmol', level: 'mmol/L', flow: 'mmol/h', color: '#a0742a' },
    { id: 'water', name: 'water', amount: 'L', level: 'L', flow: 'L/h', color: '#3b82c4' },
  ],
  nodes: [
    // Urea spreads through all the body's water, about 42 L: that is the
    // store's capacity, so its level is the concentration in the blood.
    { id: 'blood', substance: 'urea', name: 'waste in the blood', kind: 'store', capacity: 42, start: 168, at: [1.3, 0.55] },
    { id: 'body-water', substance: 'water', name: 'water in the body', kind: 'store', capacity: 1, start: 42.25, at: [1.3, 1.45] },
    { id: 'pee-waste', substance: 'urea', name: 'out, in pee', kind: 'fixed', level: 0, at: [4.1, 0.55] },
    { id: 'pee-water', substance: 'water', name: 'out, in pee', kind: 'fixed', level: 0, at: [4.1, 1.45] },
  ],
  parts: [
    {
      id: 'body',
      name: 'Your body',
      icon: '🧍',
      says: 'Everything else: it makes waste just by living, drinks water, and loses a little through skin and breath.',
      job: 'makes waste, drinks water, and sweats and breathes a little out',
      at: [0, 1],
      keep: true,
      flows: [
        { id: 'make-waste', law: 'pump', from: null, to: 'blood', rate: 16.67 }, // 400 mmol a day
        { id: 'drink', law: 'pump', from: null, to: 'body-water', rate: 0.1042 }, // 2.5 L a day
        { id: 'skin-and-breath', law: 'pump', from: 'body-water', to: null, rate: 0.0333 }, // 0.8 L a day
      ],
    },
    {
      id: 'left-kidney',
      name: 'Left kidney',
      icon: '🫘',
      says: 'A bean-shaped part about the size of a fist, low in your back on the left.',
      job: 'cleans waste out of the blood and lets extra water out',
      at: [2.6, 0],
      copies: 1,
      flows: [
        { id: 'left-cleans', law: 'conduct', from: 'blood', to: 'pee-waste', g: 2.083 }, // 50 L a day of urea clearance
        { id: 'left-water', law: 'oneway', from: 'body-water', to: 'pee-water', g: 0.1417, drop: 42 },
      ],
      faults: [
        {
          id: 'sick',
          name: 'a sick kidney',
          icon: '🤒',
          changes: [
            { flow: 'left-cleans', scale: { g: 0.15 } },
            { flow: 'left-water', scale: { g: 0.15 } },
          ],
        },
        {
          id: 'blocked',
          name: 'a kidney blocked by a stone',
          icon: '🪨',
          changes: [
            { flow: 'left-cleans', set: { g: 0 } },
            { flow: 'left-water', set: { g: 0 } },
          ],
        },
      ],
    },
    {
      id: 'right-kidney',
      name: 'Right kidney',
      icon: '🫘',
      says: 'The same again, on the right.',
      job: 'cleans waste out of the blood and lets extra water out',
      at: [2.6, 2],
      copies: 1,
      flows: [
        { id: 'right-cleans', law: 'conduct', from: 'blood', to: 'pee-waste', g: 2.083 },
        { id: 'right-water', law: 'oneway', from: 'body-water', to: 'pee-water', g: 0.1417, drop: 42 },
      ],
      faults: [
        {
          id: 'sick',
          name: 'a sick kidney',
          icon: '🤒',
          changes: [
            { flow: 'right-cleans', scale: { g: 0.15 } },
            { flow: 'right-water', scale: { g: 0.15 } },
          ],
        },
        {
          id: 'blocked',
          name: 'a kidney blocked by a stone',
          icon: '🪨',
          changes: [
            { flow: 'right-cleans', set: { g: 0 } },
            { flow: 'right-water', set: { g: 0 } },
          ],
        },
      ],
    },
    {
      id: 'dialysis',
      name: 'Dialysis machine',
      icon: '🩺',
      says: 'A machine that cleans blood through a filter, outside the body.',
      job: 'cleans the blood through a filter, the way a kidney does',
      at: [2.6, 1],
      installed: false,
      flows: [
        { id: 'machine-cleans', law: 'conduct', from: 'blood', to: 'pee-waste', g: 1.1 }, // about 26 L a day
        { id: 'machine-water', law: 'oneway', from: 'body-water', to: 'pee-water', g: 0.1, drop: 42 },
      ],
    },
  ],
  goal: {
    says: 'The blood stays clean and the body’s water stays just right, all week.',
    asks: 'Will the blood stay clean and the water stay just right all week?',
    checks: [
      { read: { node: 'blood' }, below: 20, fails: 'Waste built up in the blood, far past healthy.' },
      { read: { node: 'body-water' }, below: 45, fails: 'Water built up in the body: puffy, then dangerous.' },
      { read: { node: 'body-water' }, above: 39, fails: 'The body dried out: not enough water.' },
    ],
  },
  measure: {
    says: 'How high does the waste in the blood get, at its worst?',
    read: { node: 'blood', stat: 'max' },
    unit: 'mmol/L',
    max: 80,
    resolution: 1,
  },
  notes: [
    'A real kidney left on its own grows stronger over the next weeks and takes on most of the missing one’s work. This one does not, so with one kidney the waste here sits higher than a real person’s would.',
    'Real kidneys save water when you drink less and let more go when you drink more. These let out whatever is above a normal level, which does the same job a simpler way.',
    'Kidneys also balance salt and acid, make hormones, and help hold blood pressure steady. This model has only waste and water.',
    'This dialysis runs all day, every day. Real dialysis runs a few hours a few days a week, so the waste rises and falls between sessions.',
    'A transplanted kidney is usually added low in the belly, and the old ones are often left in place: some people really do have three.',
  ],
  sources: [
    'A grown-up makes roughly 400 mmol of urea a day (about 12 g of urea nitrogen), more with more protein.',
    'Healthy blood urea is about 2.5 to 7 mmol/L. Two healthy kidneys clear urea at about 70 mL a minute — about 100 L of blood’s worth a day.',
    'Urea spreads through all the body’s water: about 42 L in a 70 kg adult.',
    'A day’s water: about 2.5 L in from drinking and food, 0.8 L out through skin and breath, the rest as pee.',
    'People who give a kidney away live with one, and their kidney function stays normal or near it.',
    'Losing about 6% of the body’s water is serious dehydration; people last only about three days without water.',
  ],
};
