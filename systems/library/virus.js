// A flu virus gets in: how does a virus copy itself, and what does each
// part of the cell do? The system is the virus's factory — a cell, and
// the virus that has landed on it — and the goal is the virus's: five
// hundred new viruses out of the cell in eight hours, enough to spread.
// Pull a part and see whether the virus is held back; every part that
// stops it is a place a medicine could aim (the scissors are the one
// Tamiflu jams). Medicines here slow the virus rather than switch it
// off, which is the honest lesson about them.
//
// Its lessons are the reinforcing loop — a recipe that helps copy itself
// doubles, which nobody guesses right the first time — and the limit
// that bends it over: the cell's building blocks and energy run out.
// And the cytoplasm question answers itself: pull the cell's jelly and
// the building blocks, the energy and the machines that float in it go
// with it.
//
// Amounts are averages (a mean-field model), so there can be half a
// virus; the notes say so. Data only.
export default {
  id: 'flu-cell',
  title: 'A flu virus gets in',
  icon: '🦠',
  model: 'A model of one cell in your nose after a few flu viruses land on it, over eight hours.',
  intro:
    'A few flu viruses have landed on a cell in your nose. A virus cannot copy itself on its own: it has to get inside a cell and use the cell’s parts. Pull a part of the cell (or of the virus) and say whether the virus can still get five hundred new copies out in eight hours.',
  time: { unit: 'min', step: 0.5, run: 480 },
  substances: [
    { id: 'virus', name: 'flu viruses', amount: 'viruses', color: '#c0392b' },
    { id: 'recipe', name: 'virus recipes', amount: 'recipes', color: '#8e44ad' },
    { id: 'coat', name: 'coat pieces', amount: 'pieces', color: '#d35400' },
    { id: 'block', name: 'building blocks', amount: 'blocks', color: '#7f8c4d' },
    { id: 'energy', name: 'energy', amount: 'units', color: '#e1b12c' },
  ],
  nodes: [
    { id: 'outside', substance: 'virus', name: 'viruses waiting outside', kind: 'store', capacity: 1, start: 10, at: [0, 1] },
    { id: 'recipes', substance: 'recipe', name: 'virus recipes inside', kind: 'store', capacity: 1, start: 0, at: [2, 1] },
    { id: 'coats', substance: 'coat', name: 'coat pieces', kind: 'store', capacity: 1, start: 0, at: [3, 2] },
    { id: 'ready', substance: 'virus', name: 'new viruses, not out yet', kind: 'store', capacity: 1, start: 0, at: [4, 1] },
    { id: 'freed', substance: 'virus', name: 'new viruses out of the cell', kind: 'store', capacity: 1, start: 0, at: [5.6, 1] },
    { id: 'blocks', substance: 'block', name: 'building blocks', kind: 'store', capacity: 1, start: 20000 },
    { id: 'energy', substance: 'energy', name: 'energy', kind: 'store', capacity: 1, start: 300, max: 600 },
  ],
  parts: [
    {
      id: 'membrane',
      name: 'Cell skin (membrane)',
      icon: '🫧',
      says: 'The thin skin around the cell.',
      job: 'lets food in, and is where new viruses are put together',
      at: [3, 0],
      flows: [
        { id: 'food-in', law: 'pump', from: null, to: 'blocks', rate: 30 },
        { id: 'pack', law: 'react', inputs: { recipes: 1, coats: 20 }, outputs: { ready: 1 }, rate: 0.02, by: ['recipes'] },
      ],
    },
    {
      id: 'receptor',
      name: 'Door the virus fits',
      icon: '🔑',
      says: 'A shape on the cell’s skin that the flu virus fits, like a key in a lock.',
      job: 'is the door the virus gets in by',
      at: [1, 1],
      copies: 2,
      within: 'membrane',
      flows: [{ id: 'enter', law: 'react', inputs: { outside: 1 }, outputs: { recipes: 1 }, rate: 0.03, by: ['outside'] }],
      faults: [{ id: 'other-shape', name: 'a door of a different shape', icon: '🔒', changes: [{ flow: 'enter', set: { rate: 0 } }] }],
    },
    {
      id: 'nucleus',
      name: 'Nucleus',
      icon: '🟣',
      says: 'The cell’s control room, where its own recipes are kept.',
      job: 'is where the virus’s copier works',
      at: [2, 0],
    },
    {
      id: 'copier',
      name: 'Virus copier',
      icon: '📠',
      says: 'A machine the flu virus brings in with it.',
      job: 'copies the virus’s recipe',
      at: [2, 2],
      copies: 1,
      within: 'nucleus',
      flows: [{ id: 'copy', law: 'react', inputs: { blocks: 2, energy: 1 }, outputs: { recipes: 1 }, rate: 0.04, by: ['recipes'] }],
      faults: [{ id: 'jammed', name: 'a copier slowed by medicine', icon: '💊', changes: [{ flow: 'copy', scale: { rate: 0.4 } }] }],
    },
    {
      id: 'cytoplasm',
      name: 'Cytoplasm',
      icon: '🫗',
      says: 'The jelly that fills the cell.',
      job: 'holds the building blocks, the energy and the machines the cell runs on',
      at: [1, 3],
      holds: ['blocks', 'energy'],
      faults: [{ id: 'starved', name: 'a hungry cell', icon: '🍽️', changes: [{ node: 'blocks', start: 0.1 }] }],
    },
    {
      id: 'ribosomes',
      name: 'Ribosomes',
      icon: '🧶',
      says: 'Tiny machines that read a recipe and build what it says.',
      job: 'build coat pieces from the virus’s recipe',
      at: [3, 3],
      copies: 2,
      within: 'cytoplasm',
      flows: [
        { id: 'make-coats', law: 'react', inputs: { blocks: 1, energy: 1 }, outputs: { coats: 1 }, rate: 0.2, by: ['recipes'] },
        { id: 'upkeep', law: 'react', inputs: { blocks: 1, energy: 1 }, outputs: {}, rate: 20 },
      ],
    },
    {
      id: 'mitochondria',
      name: 'Mitochondria',
      icon: '⚡',
      says: 'Little power plants inside the cell.',
      job: 'make energy from building blocks',
      at: [0, 3],
      copies: 2,
      within: 'cytoplasm',
      flows: [{ id: 'burn', law: 'react', inputs: { blocks: 1 }, outputs: { energy: 30 }, rate: 4 }],
    },
    {
      id: 'scissors',
      name: 'Virus scissors',
      icon: '✂️',
      says: 'A part on each new virus.',
      job: 'cut new viruses free of the cell',
      at: [5, 0],
      copies: 1,
      flows: [{ id: 'release', law: 'react', inputs: { ready: 1 }, outputs: { freed: 1 }, rate: 0.2, by: ['ready'] }],
      faults: [{ id: 'tamiflu', name: 'scissors jammed by Tamiflu', icon: '💊', changes: [{ flow: 'release', scale: { rate: 0.01 } }] }],
    },
  ],
  goal: {
    says: 'The virus spreads: five hundred new viruses get out of the cell in eight hours.',
    asks: 'Will the virus still get five hundred new copies out of the cell in eight hours?',
    checks: [{ read: { node: 'freed' }, above: 500, when: 'end', fails: 'The virus was held back: fewer than five hundred got out.' }],
  },
  measure: {
    says: 'How many new viruses get out of the cell in eight hours?',
    read: { node: 'freed', stat: 'end' },
    unit: 'viruses',
    max: 2000,
    resolution: 10,
  },
  notes: [
    'Amounts here are averages, so there can be half a virus. A real cell has whole ones, and with only a few viruses luck matters a lot.',
    'Real flu carries eight separate pieces of recipe and makes about a dozen different proteins. Here there is one recipe and one kind of coat piece.',
    'Flu brings its copier along and also makes more inside the cell. This copier just arrives.',
    'Real infected cells let out hundreds to thousands of new flu viruses, and the cell usually dies. This model’s number is a model’s.',
  ],
  sources: [
    'Flu gets in by fitting a sugar (sialic acid) on the cell’s surface, and copies its recipe in the cell’s nucleus.',
    'Ribosomes, the cell’s protein builders, are what build the virus’s parts.',
    'Tamiflu (oseltamivir) works by jamming neuraminidase, the part that cuts new flu viruses free of the cell.',
  ],
};
