// A tiny deterministic stream for the pack's choices — which question,
// which part to ask about, when the Consultant is wrong, which mystery.
// The same seed gives the same choice, always: no reroll-fishing, and a
// round can be replayed. engine/consultant.js has the same stream; the
// pack keeps its own copy so it reaches nothing of the engine but its
// freeze. (mulberry32, seeded by an FNV-1a hash of the key.)

function hash(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function makeRng(seed) {
  let a = hash(String(seed)) || 1;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A seeded shuffle, leaving the input alone.
export function shuffled(items, rng) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
