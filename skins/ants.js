// The reference skin (README): one person's interests, used to prove the
// games. Ants hold on to each other, frogs cross, crocodiles wait.
export default {
  id: 'ants',
  name: 'Ants',
  icon: '🐜',
  attribution: 'Original costume, drawn with emoji and code',
  words: {
    link: 'ant',
    links: 'ants',
    cargo: 'frog',
    jar: 'jar',
    bank: 'bank',
    support: 'tree',
    letGo: 'let go',
    danger: 'the crocodiles could reach {cargo}',
  },
  link: { glyph: '🐜', axis: 'along', fill: 0.68, perLink: 1 },
  cargo: [
    { name: 'Peep', glyph: '🐸' },
    { name: 'Hopper', glyph: '🐸' },
    { name: 'Chonk', glyph: '🐸' },
    { name: 'Big Earl', glyph: '🐸' },
  ],
  scene: {
    sky: '#dff0f7',
    ink: '#2b2620',
    bank: { body: '#8a6b43', top: '#6f9d4f' },
    support: 'tree',
    water: {
      body: '#7fb6d9',
      reach: 'rgba(127, 182, 217, 0.35)',
      lurkers: ['🐊', '🐊'],
      splash: '💦',
    },
  },
};
