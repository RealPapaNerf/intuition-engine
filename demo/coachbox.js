// The coach in the kid's hands (decisions 2026-10-25: the coach arrives
// §7.1, free items §3 and §5–6, questions §1–2 and §5, §7.10–14).
//
// One box, one question back. The coach only ever asks — everything
// that keeps that true lives server-side in coach/service.js, which is
// also where the key is; this file posts what the kid can see and shows
// what comes back. Three things it must get right:
//
//   the kid is never refused a question. The question count is a pacing
//   meter, not a wall; past it the ask still goes, and the coach's own
//   posture shifts. The one wall is the daily cents guard, and behind
//   it a free canned question still comes back ("the coach is
//   resting") — never a dead button.
//   the kid sees the bill. Cents this ask, cents today, questions left:
//   budgeting is curriculum, not telemetry to hide.
//   world knowledge is free. "What's in the forest?" and "What's
//   already built?" are answered from two GET routes with no model
//   behind them, and cost nothing.
//
// Nothing adult is rendered here — no flags, no moderation, no word
// about what publishes and what waits for a grown-up (invariant 7).

const HISTORY = 12; // turns the coach is reminded of; the server trims too

// Tap-to-pick: the input half of spoken mode (questions §5). Big
// buttons — creatures, things, why, what if — that need no reading.
// The picture carries the meaning; the words under it are for whoever
// can read them.
export const PROMPTS = Object.freeze([
  { icon: '🐒', label: 'a monkey', said: 'Can I have a monkey to carry across?' },
  { icon: '🐌', label: 'a slug', said: 'Is there a slug?' },
  { icon: '🐜', label: 'more ants', said: 'Can I have more ants please?' },
  { icon: '🪵', label: 'a branch', said: 'Is there a branch I can use?' },
  { icon: '🕸️', label: 'silk', said: 'Can I have some silk?' },
  { icon: '🪨', label: 'rocks', said: 'Can I put rocks in the river to stand on?' },
  { icon: '🌳', label: 'a tree', said: 'Is there a tree?' },
  { icon: '❓', label: 'why?', said: 'Why did that happen?' },
  { icon: '🤔', label: 'what if?', said: 'What if it gets heavier?' },
]);

const FOREST_WORDS = Object.freeze({
  cargo: 'someone to carry across',
  links: 'more ants for the jar',
  stock: 'wood or silk to build with',
  anchor: 'rocks in the river to stand on',
  fixture: 'a built thing — a tree, a dam, a branch',
});

const cents = (c) => `${(Number(c) || 0).toFixed(2)}¢`;

// Nobody is on the other end (no ANTHROPIC_API_KEY on the server). The
// game is fully playable without a coach — but the kid has to be able
// to SEE that, in the coach's own line, before they tap a picture and
// nothing happens. Stage 0 found this the hard way.
export const NO_COACH =
  '🧑‍🏫 No coach today — but everything still works. Build, test it, and look around all you like.';

// What the coach's answer costs and what is left of the two budgets.
// The question count ticking to zero is pacing, not a refusal, and it
// says so (questions §1).
export function tickerWords(r) {
  if (!r?.on) {
    return r?.why === 'no-key'
      ? 'The coach is out today — the game plays fine without one.'
      : 'The coach could not be reached just now. Keep building.';
  }
  const bits = [`this ask ${cents(r.cost?.turn)}`, `today ${cents(r.cost?.today)}`];
  bits.push(
    r.left?.calls > 0
      ? `${r.left.calls} questions left here`
      : 'questions used up here — ask anyway',
  );
  if (r.resting) {
    return `😴 The coach is resting until the morning · ${bits.join(' · ')}`;
  }
  return bits.join(' · ');
}

export function forestWords(forest) {
  const asks = (forest?.grants ?? []).map((g) => FOREST_WORDS[g]).filter(Boolean);
  const stuff = (forest?.materials ?? []).join(', ');
  return [
    asks.length ? `You can ask the coach for: ${asks.join('; ')}.` : '',
    stuff ? `Everything out there is made of: ${stuff}.` : '',
    'Asking what the forest holds is free.',
  ]
    .filter(Boolean)
    .join(' ');
}

export function libraryWords(list) {
  if (!Array.isArray(list) || list.length === 0) {
    return 'Nothing has been built yet. Ask for something and you could be first.';
  }
  const names = list
    .slice(0, 12)
    .map((e) => (e.tags?.length ? `${e.name} (${e.tags.slice(0, 3).join(', ')})` : e.name));
  return `Already built, ready to grab: ${names.join(' · ')}. Looking is free.`;
}

// els: the panel's elements. getState: everything the coach may be told
// — the whitelist is enforced again server-side. grant: hands a granted
// thing to the game, returning why not or null. speak: the voice.
export function makeCoachBox({ els, kid, getState, grant, speak = () => {}, fetch: fetchFn = globalThis.fetch }) {
  const history = [];
  let open = false; // asking is a between-rounds thing
  let busy = false;
  let present = true; // until the world says otherwise
  let who = kid;

  const show = (text) => {
    els.say.textContent = text;
  };

  function enable() {
    const can = open && !busy && present;
    els.ask.disabled = !can;
    els.text.disabled = !can;
    // With no coach the asking buttons go quiet rather than pretending;
    // the free lookups below them keep working, because they always
    // did — they never needed a coach.
    for (const b of els.picks.querySelectorAll('button')) b.disabled = !can;
  }

  function setPresent(yes) {
    const was = present;
    present = yes !== false;
    if (!present) {
      show(NO_COACH);
      els.ticker.textContent = '';
      if (was) speak(NO_COACH); // said once, not on every lookup
    }
    enable();
  }

  async function ask(said) {
    const words = String(said ?? '').trim();
    if (!words || busy || !open) return;
    busy = true;
    enable();
    show('…');
    els.ticker.textContent = 'asking the coach…';
    let r = null;
    try {
      const res = await fetchFn('/coach/ask', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kid: who, said: words, state: getState(), history }),
      });
      r = res.ok ? await res.json() : { on: false, why: `http-${res.status}` };
    } catch {
      r = { on: false, why: 'unreachable' };
    }
    busy = false;
    els.ticker.textContent = tickerWords(r);
    if (!r.on) {
      if (r.why === 'no-key') setPresent(false);
      else show('');
      enable();
      return;
    }
    show(`🧑‍🏫 ${r.question}`);
    speak(r.question);
    history.push({ role: 'user', content: words }, { role: 'assistant', content: r.question });
    while (history.length > HISTORY) history.shift();
    if (r.grant) {
      const why = grant(r.grant);
      // A grant the game cannot take is dropped quietly: the kid still
      // has their question, and nothing about it is their problem.
      if (why) console.warn(`a granted thing did not fit: ${why}`);
    }
    els.text.value = '';
    enable();
  }

  // Free, local, no model: the two world-knowledge routes (free items
  // §5). Looking never costs an ask.
  async function browse(what) {
    els.browseout.textContent = 'looking…';
    try {
      const res = await fetchFn(what === 'forest' ? '/coach/forest' : '/coach/fixtures');
      const data = res.ok ? await res.json() : null;
      if (what === 'forest' && data) setPresent(data.coach !== 'out');
      const words = what === 'forest' ? forestWords(data) : libraryWords(data);
      els.browseout.textContent = words;
      speak(words);
    } catch {
      els.browseout.textContent = 'Could not look just now.';
    }
  }

  els.ask.onclick = () => ask(els.text.value);
  els.text.onkeydown = (e) => {
    if (e.key === 'Enter') ask(els.text.value);
  };
  els.forest.onclick = () => browse('forest');
  els.shelf.onclick = () => browse('shelf');
  for (const p of PROMPTS) {
    const b = document.createElement('button');
    b.className = 'pick';
    b.dataset.said = p.said;
    b.title = p.said;
    b.append(
      Object.assign(document.createElement('span'), { className: 'picon', textContent: p.icon }),
      Object.assign(document.createElement('span'), { className: 'plabel', textContent: p.label }),
    );
    b.onclick = () => ask(p.said);
    els.picks.append(b);
  }
  enable();
  // One free lookup on the way in, so an absent coach is visible before
  // the first tap rather than after it.
  Promise.resolve(fetchFn('/coach/forest'))
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => setPresent(!d || d.coach !== 'out'))
    .catch(() => {});

  return {
    ask,
    setPresent,
    setOpen(v) {
      open = v === true;
      enable();
    },
    setKid(name) {
      who = name;
    },
    // In spoken mode the typing box goes away — a kid who cannot read
    // cannot type — and the pictures are the whole input (questions §5).
    setSpoken(spoken) {
      els.text.hidden = spoken;
      els.ask.hidden = spoken;
    },
  };
}
