// Bedsheets knotted into a rope between two rooftops, at night, with a
// dog waiting in the alley. Same chain, same grip limit per link, same
// numbers; only the costume knows it is laundry.
export default {
  id: 'sheets',
  name: 'Knotted sheets',
  icon: '🪢',
  attribution: 'Original costume, drawn with emoji and code',
  words: {
    link: 'sheet',
    links: 'sheets',
    cargo: 'cat',
    jar: 'laundry basket',
    bank: 'roof',
    support: 'chimney',
    letGo: 'came untied',
    danger: 'the dog could reach {cargo}',
  },
  link: { strip: ['#f4f1ea', '#cfe0f2', '#f2d8e0', '#efe6c2'], fill: 0.86, perLink: 1 },
  joint: { glyph: '🪢', scale: 0.55 },
  cargo: [
    { name: 'Whiskers', glyph: '🐈' },
    { name: 'Mittens', glyph: '🐈' },
    { name: 'Biscuit', glyph: '🐈' },
    { name: 'Sir Fluff', glyph: '🐈' },
  ],
  scene: {
    sky: '#1d2740',
    ink: '#ece6d6',
    skyDecor: ['🌙', '⭐', '⭐', '⭐'],
    bank: { body: '#4c5160', top: '#9a4632' },
    support: 'chimney',
    water: {
      body: '#2e2e36',
      reach: 'rgba(150, 150, 175, 0.3)',
      lurkers: ['🐕'],
      splash: '💨',
    },
  },
};
