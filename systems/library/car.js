// The car: a whole car, kept to the parts a kid can name, on a ninety-
// minute drive to grandma's. Fuel goes tank → pump → engine; the engine
// turns fuel into turning (the crank) and heat; the wheels turn the
// turning into distance; the cooling loop carries the heat away; the
// battery runs the spark, the pump, the computer and the fan, and the
// alternator — turned by the engine — keeps it charged.
//
// Its lessons are the classic ones. A buffer buys time: pull the
// alternator and the car still drives for most of an hour, on the
// battery, then dies on the road. Feedback holds a level: the
// thermostat keeps the engine near 90 °C, and pulling it (stuck open)
// just runs it cool — nothing breaks, which surprises. Ratings and
// cascades: lose the radiator, the water pump or a hose and the engine
// overheats and seizes. And not every part matters for every job: at
// highway speed the fan is not needed.
//
// A toy model: the laws are honest and the numbers are plausible, not a
// particular car's (notes). Heat is in kJ with the engine block at
// 50 kJ per °C, so its level reads in °C. Data only.
export default {
  id: 'car',
  title: 'The car',
  icon: '🚗',
  model: 'A toy model of a petrol car on a 90-minute drive at highway speed: fuel, spark, cooling and the battery.',
  intro:
    'It is a ninety-minute drive to grandma’s house, 120 km away. The car burns fuel to turn the wheels, makes a lot of heat doing it, and runs its spark and pumps on electricity. Pull a part or swap in a bad one, and say whether you will still get to grandma’s.',
  time: { unit: 'min', step: 0.1, run: 90 },
  substances: [
    { id: 'fuel', name: 'fuel', amount: 'L', level: 'L', color: '#b5651d' },
    { id: 'heat', name: 'heat', amount: 'kJ', level: '°C', flow: 'kJ/min', color: '#d64541' },
    { id: 'charge', name: 'electricity', amount: 'Ah', level: 'V', flow: 'Ah/min', color: '#d4a017' },
    { id: 'spark', name: 'sparks', amount: 'sparks', color: '#f1c40f' },
    { id: 'work', name: 'turning (work)', amount: 'kJ', level: 'kJ', flow: 'kJ/min', color: '#5d6d7e' },
    { id: 'distance', name: 'distance', amount: 'km', level: 'km', flow: 'km/min', color: '#27ae60' },
  ],
  nodes: [
    { id: 'tank', substance: 'fuel', name: 'fuel in the tank', kind: 'store', capacity: 1, start: 40 },
    { id: 'fuel-line', substance: 'fuel', name: 'fuel in the line', kind: 'store', capacity: 1, start: 0.2, max: 0.2, at: [2, 0] },
    { id: 'spark', substance: 'spark', name: 'spark ready', kind: 'store', capacity: 1, start: 1, max: 1, at: [2.9, 2.1] },
    // The engine block: 50 kJ to warm it 1 °C, starting at 20 °C.
    { id: 'block', substance: 'heat', name: 'engine heat', kind: 'store', capacity: 50, start: 1000 },
    { id: 'crank', substance: 'work', name: 'engine turning', kind: 'store', capacity: 1, start: 0, max: 20 },
    { id: 'coolant', substance: 'heat', name: 'radiator heat', kind: 'store', capacity: 10, start: 200 },
    { id: 'air', substance: 'heat', name: 'outside air', kind: 'fixed', level: 25, at: [6, 3] },
    // A 12.6 V battery of 50 Ah: about 4 Ah per volt.
    { id: 'battery', substance: 'charge', name: 'battery charge', kind: 'store', capacity: 3.97, start: 50, max: 50 },
    { id: 'trip', substance: 'distance', name: 'distance driven', kind: 'store', capacity: 1, start: 0, at: [6, 1] },
  ],
  parts: [
    {
      id: 'tank',
      name: 'Fuel tank',
      icon: '🛢️',
      says: 'Holds the petrol: 40 litres, full.',
      job: 'holds the petrol',
      at: [0, 0],
      holds: ['tank'],
      faults: [{ id: 'nearly-empty', name: 'a nearly empty tank', icon: '⛽', changes: [{ node: 'tank', start: 0.05 }] }],
    },
    {
      id: 'fuel-pump',
      name: 'Fuel pump',
      icon: '⛽',
      says: 'An electric pump.',
      job: 'pushes petrol from the tank to the engine',
      at: [1, 0],
      copies: 1,
      flows: [
        {
          id: 'pump-fuel',
          law: 'react',
          inputs: { tank: 0.2, battery: 0.0833 },
          outputs: { 'fuel-line': 0.2 },
          rate: 1,
          needs: [{ node: 'battery', atLeast: 9 }],
        },
      ],
      faults: [{ id: 'weak', name: 'a weak fuel pump', icon: '🐌', changes: [{ flow: 'pump-fuel', scale: { rate: 0.4 } }] }],
    },
    {
      id: 'engine',
      name: 'Engine',
      icon: '⚙️',
      says: 'The engine.',
      job: 'burns petrol to make turning, and a lot of heat',
      at: [3, 1],
      holds: ['block', 'crank'],
      flows: [
        {
          id: 'burn',
          law: 'react',
          inputs: { 'fuel-line': 0.1, spark: 1 },
          outputs: { crank: 1000, block: 1000 },
          rate: 1,
          needs: [{ part: 'computer' }],
        },
        { id: 'block-to-air', law: 'conduct', from: 'block', to: 'air', g: 2 },
      ],
      // Past 125 °C for two minutes, it seizes.
      ratings: [{ node: 'block', above: 125, for: 2 }],
    },
    {
      id: 'ignition',
      name: 'Spark plugs',
      icon: '⚡',
      says: 'Spark plugs and the coil that fires them.',
      job: 'make the spark that lights the petrol',
      at: [2, 2],
      flows: [{ id: 'make-spark', law: 'react', inputs: { battery: 0.0833 }, outputs: { spark: 1 }, rate: 1, needs: [{ node: 'battery', atLeast: 9 }] }],
      faults: [{ id: 'worn', name: 'worn-out spark plugs', icon: '🥀', changes: [{ broken: true }] }],
    },
    {
      id: 'computer',
      name: 'Engine computer',
      icon: '🖥️',
      says: 'A small computer under the bonnet.',
      job: 'times the fuel and the spark',
      at: [1, 2],
      flows: [{ id: 'think', law: 'pump', from: 'battery', to: null, rate: 0.0333 }],
      faults: [{ id: 'crashed', name: 'a crashed computer', icon: '🧊', changes: [{ broken: true }] }],
    },
    {
      id: 'battery',
      name: 'Battery',
      icon: '🔋',
      says: 'A 12-volt battery.',
      job: 'stores electricity for everything electric',
      at: [0, 2],
      holds: ['battery'],
      faults: [
        { id: 'old', name: 'an old battery', icon: '🪫', changes: [{ node: 'battery', start: 0.85 }] },
        { id: 'flat', name: 'a flat battery', icon: '🪫', changes: [{ node: 'battery', start: 0.7 }] },
      ],
    },
    {
      id: 'alternator',
      name: 'Alternator',
      icon: '🔌',
      says: 'Turned by the engine’s belt.',
      job: 'charges the battery while the engine runs',
      at: [1, 3],
      flows: [{ id: 'charge', law: 'react', inputs: { crank: 20 }, outputs: { battery: 0.333 }, rate: 1 }],
      faults: [{ id: 'worn', name: 'a worn alternator', icon: '🥀', changes: [{ flow: 'charge', scale: { rate: 0.5 } }] }],
    },
    {
      id: 'wheels',
      name: 'Gearbox and wheels',
      icon: '🛞',
      says: 'The gearbox, the axles and the wheels.',
      job: 'turn the engine’s turning into going down the road',
      at: [5, 1],
      flows: [{ id: 'drive', law: 'react', inputs: { crank: 950 }, outputs: { trip: 1.5 }, rate: 1 }],
    },
    {
      id: 'water-pump',
      name: 'Water pump',
      icon: '💧',
      says: 'Turned by the engine’s belt.',
      job: 'pushes coolant around the engine and the radiator',
      at: [3, 3],
      copies: 1,
      flows: [{ id: 'spin', law: 'react', inputs: { crank: 10 }, outputs: {}, rate: 1 }],
      faults: [{ id: 'broken-belt', name: 'a water pump with a broken belt', icon: '➰', changes: [{ broken: true }] }],
    },
    {
      id: 'hoses',
      name: 'Coolant hoses',
      icon: '🧵',
      says: 'Rubber pipes.',
      job: 'carry hot coolant from the engine to the radiator',
      at: [4, 2],
      copies: 1,
      flows: [{ id: 'coolant-flow', law: 'conduct', from: 'block', to: 'coolant', g: 40, needs: [{ part: 'water-pump' }] }],
      faults: [{ id: 'leaking', name: 'a leaking hose', icon: '💦', changes: [{ flow: 'coolant-flow', scale: { g: 0.1 } }] }],
    },
    {
      id: 'thermostat',
      name: 'Thermostat',
      icon: '🌡️',
      says: 'A valve in the hose.',
      job: 'keeps the engine from running cold: it opens only once the engine is warm',
      at: [4, 3],
      gates: [{ flow: 'coolant-flow', by: 'block', open: 'above', at: 90, band: 4 }],
      faults: [
        { id: 'stuck-shut', name: 'a thermostat stuck shut', icon: '🚫', changes: [{ gate: 'coolant-flow', stuck: 'shut' }] },
        { id: 'stuck-open', name: 'a thermostat stuck open', icon: '🚪', changes: [{ gate: 'coolant-flow', stuck: 'open' }] },
      ],
    },
    {
      id: 'radiator',
      name: 'Radiator',
      icon: '▦',
      says: 'Thin metal fins at the front of the car.',
      job: 'lets the engine’s heat out into the air',
      at: [5, 2],
      holds: ['coolant'],
      flows: [
        { id: 'radiate', law: 'conduct', from: 'coolant', to: 'air', g: 60 },
        { id: 'fan-air', law: 'conduct', from: 'coolant', to: 'air', g: 15, needs: [{ part: 'fan' }] },
      ],
      faults: [
        {
          id: 'clogged',
          name: 'a clogged radiator',
          icon: '🍂',
          changes: [
            { flow: 'radiate', scale: { g: 0.1 } },
            { flow: 'fan-air', scale: { g: 0.1 } },
          ],
        },
      ],
    },
    {
      id: 'fan',
      name: 'Radiator fan',
      icon: '🌀',
      says: 'An electric fan behind the radiator.',
      job: 'pulls extra air through the radiator',
      at: [5, 3],
      flows: [{ id: 'fan-power', law: 'pump', from: 'battery', to: null, rate: 0.0833 }],
    },
  ],
  goal: {
    says: 'You get to grandma’s: 120 km in 90 minutes, and the engine survives.',
    asks: 'Will the car still get you to grandma’s, 120 km away?',
    checks: [
      { part: 'engine', intact: true, fails: 'The engine overheated and seized.' },
      { read: { node: 'trip' }, above: 120, when: 'end', fails: 'The car stopped short of grandma’s.' },
    ],
  },
  measure: {
    says: 'How far does the car get in 90 minutes?',
    read: { node: 'trip', stat: 'end' },
    unit: 'km',
    max: 150,
    resolution: 5,
  },
  notes: [
    'This is a toy car: the laws are honest but the numbers are plausible, not any real car’s.',
    'A real battery keeps its voltage up and then drops near the end. This one sinks steadily, so it gives up a little early.',
    'A real thermostat opens gradually. This one is either open or shut, with a few degrees between opening and closing.',
    'There is no starter motor, no gears to choose and no traffic: the car starts already running and drives at a steady 90 km/h.',
  ],
  sources: [
    'A car cruising at highway speed needs roughly 15–20 kW at the wheels and burns about 6 litres of petrol an hour.',
    'Engines run their coolant near 90 °C, held there by the thermostat; past about 120 °C they risk serious damage.',
    'A healthy car battery reads about 12.6 V; much below 10 V the spark and the fuel pump give up.',
  ],
};
