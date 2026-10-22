// Stuffed animals stitched end to end between two beds — and the floor
// is lava. The ants' own primitive, a tension-only chain with a grip
// limit per link, wearing a bedroom (decisions 2026-10-22 §4).
export default {
  id: 'plush',
  name: 'Stuffed animals',
  icon: '🧸',
  attribution: 'Original costume, drawn with emoji and code',
  words: {
    link: 'teddy',
    links: 'teddies',
    cargo: 'toy',
    jar: 'toy box',
    bank: 'bed',
    support: 'bedpost',
    letGo: 'came unstitched',
    danger: '{cargo} touched the lava',
  },
  link: { glyph: '🧸', axis: 'across', fill: 0.75, perLink: 1 },
  cargo: [
    { name: 'Squeak', glyph: '🐭' },
    { name: 'Duckie', glyph: '🦆' },
    { name: 'Shelly', glyph: '🐢' },
    { name: 'Rex', glyph: '🦖', scale: 1.1 },
  ],
  scene: {
    sky: '#f3e7d3',
    ink: '#3a2f25',
    bank: { body: '#6f97b5', top: '#f4f1ea' },
    support: 'post',
    water: {
      body: '#e0532c',
      reach: 'rgba(246, 150, 70, 0.4)',
      lurkers: ['🔥', '🔥', '🔥'],
      splash: '🔥',
    },
  },
};
