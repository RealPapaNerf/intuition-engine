// The educator's window (decisions 2026-10-25 §5; fixture library §4.9;
// questions §7.15; grant freely §5). Four things an adult needs and a
// kid must never see:
//
//   who is playing and how their calls are going — the flags and their
//   evidence, straight from engine/journal.js;
//   how much they are leaning on the coach (questions §4): a signal for
//   the adult, never a wall for the kid;
//   the builds the coach doubted, waiting to be published or thrown
//   away — the kid already has the thing in their own scene;
//   the shelf every coach grabs from, searchable.
//
// Plus the one control that changes the game: the reader toggle. It is
// per-device here, written where the game reads it (same origin, the
// costume portal's precedent) — a per-kid setting on the server is
// REVISIT, along with any authentication at all on these routes.

import {
  signalWords,
  actionWords,
  relianceWords,
  predictionText,
  outcomeText,
  wasHit,
  consultantText,
  when,
} from './educator-words.js';

const $ = (id) => document.getElementById(id);
function el(tag, props = {}, ...children) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children.filter((c) => c !== null && c !== undefined));
  return node;
}
const KID = 'willitbreak-kid';
const READER = 'willitbreak-reader';
const status = (text) => {
  $('status').textContent = text;
};

async function get(path) {
  const r = await fetch(path);
  if (!r.ok) throw new Error(`${path} answered ${r.status}`);
  return r.json();
}
async function post(path, body) {
  const r = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`${path} answered ${r.status}`);
  return r.json();
}

// --- This device's player ---------------------------------------------------

function readLocal(key, fallback = '') {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}
function writeLocal(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    status('This browser will not keep settings; the game will play as a new kid each time.');
  }
}

// Whether there is a coach at all is adult business: the key lives on
// the server, and only an adult can put it there.
async function paintCoach() {
  try {
    const forest = await get('/coach/forest');
    if (forest.coach === 'out') {
      $('coachstate').replaceChildren(
        el('p', {
          textContent:
            'The coach is out: this server was started without ANTHROPIC_API_KEY, so asking for ' +
            'things does nothing. The game plays fine without it — the kid can still build, test, ' +
            'measure and look around, and their page says so plainly.',
        }),
        el('p', {
          className: 'note',
          textContent: 'To let the coach in: stop the server and start it again as ANTHROPIC_API_KEY=sk-… npm run demo',
        }),
      );
    } else {
      $('coachstate').replaceChildren(
        el('p', { textContent: 'The coach is in. Spending is capped per kid per day, in cents.' }),
      );
    }
  } catch {
    $('coachstate').replaceChildren(el('p', { className: 'note', textContent: 'Could not reach the server.' }));
  }
}

function paintPlayer() {
  const reads = readLocal(READER) === 'true';
  $('kidname').value = readLocal(KID, 'friend') || 'friend';
  $('reader').setAttribute('aria-pressed', String(reads));
  $('readernote').textContent = reads
    ? 'Reading mode: questions are text, and the kid can type to the coach.'
    : 'Spoken mode: the game reads itself aloud and the kid answers by tapping pictures. ' +
      'Nothing is ever recorded or sent — there is no microphone.';
}

$('savekid').onclick = () => {
  const name = $('kidname').value.trim();
  if (!name) return;
  writeLocal(KID, name);
  status(`This device's game now plays as ${name}.`);
  paintPlayer();
};
$('reader').onclick = () => {
  writeLocal(READER, readLocal(READER) === 'true' ? 'false' : 'true');
  paintPlayer();
};

// --- Kids, flags, attempts ---------------------------------------------------

let chosen = null;

function kidButton(f) {
  const b = el(
    'button',
    { className: 'kid' },
    el('strong', { textContent: f.kid }),
    el('span', {
      className: `badge${f.alert ? '' : ' quiet'}`,
      textContent: f.alert ? 'needs a look' : 'quiet',
    }),
    el('div', {
      className: 'note',
      textContent: `${f.entries} attempts · ${
        f.calibration.total ? `${f.calibration.hits}/${f.calibration.total} called right` : 'no calls yet'
      } · ${relianceWords(f.coach)}`,
    }),
  );
  b.onclick = () => showKid(f.kid);
  return b;
}

async function loadKids() {
  try {
    const flags = await get('/educator/flags');
    const box = $('kids');
    box.replaceChildren();
    if (flags.length === 0) {
      box.append(el('p', { className: 'note', textContent: 'Nobody has played yet on this server.' }));
      return;
    }
    flags.sort((a, b) => Number(b.alert) - Number(a.alert) || a.kid.localeCompare(b.kid));
    for (const f of flags) box.append(kidButton(f));
    if (chosen) showKid(chosen);
  } catch (e) {
    status(`Could not read the window: ${e.message}`);
  }
}

function attemptsTable(entries) {
  const head = el(
    'tr',
    {},
    ...['when', 'level', 'said', 'reality', '', 'links', 'the Consultant'].map((h) =>
      el('th', { textContent: h }),
    ),
  );
  const rows = [...entries].reverse().map((e) =>
    el(
      'tr',
      {},
      el('td', { textContent: when(e.at) }),
      el('td', { textContent: e.level ?? '' }),
      el('td', { textContent: predictionText(e) }),
      el('td', { textContent: outcomeText(e) }),
      el('td', { className: wasHit(e) ? 'hit' : 'miss', textContent: wasHit(e) ? '✓' : '✗' }),
      el('td', { textContent: e.ants ?? '' }),
      el('td', { textContent: consultantText(e) }),
    ),
  );
  return el('table', {}, el('thead', {}, head), el('tbody', {}, ...rows));
}

async function showKid(kid) {
  chosen = kid;
  $('whose').textContent = kid;
  const view = $('kidview');
  view.replaceChildren(el('p', { className: 'note', textContent: 'looking…' }));
  try {
    const [f, entries] = await Promise.all([
      get(`/educator/flags/${encodeURIComponent(kid)}`),
      get(`/educator/attempts/${encodeURIComponent(kid)}`),
    ]);
    const cal = f.calibration;
    const trust = f.trust;
    view.replaceChildren(
      el(
        'div',
        { className: 'card' },
        el('h3', { textContent: 'How the calls are going' }),
        el('p', {
          textContent:
            `${cal.total} calls, ${cal.hits} inside · streak ${cal.streak}` +
            (trust.judged
              ? ` · Consultant judged ${trust.judged} times, ${trust.correct} well called, ${trust.deferred} deferred`
              : ' · no Consultant calls yet'),
        }),
      ),
      el(
        'div',
        { className: 'card' },
        el(
          'h3',
          {},
          'What is flagged',
          el('span', {
            className: `badge${f.alert ? '' : ' quiet'}`,
            textContent: f.alert ? 'needs a look' : 'quiet',
          }),
        ),
        el('p', { textContent: signalWords(f.signal) }),
        f.recommendation ? el('p', { textContent: `Try: ${actionWords(f.recommendation)}` }) : null,
        f.needsDebrief
          ? el('p', { textContent: 'A debrief is due — the last build failed, or the predictions stopped moving.' })
          : null,
        el('h3', { textContent: 'Leaning on the coach' }),
        el('p', { textContent: relianceWords(f.coach) }),
        el('h3', { textContent: 'The evidence, unfolded' }),
        el('pre', { textContent: JSON.stringify(f.flag, null, 2) }),
      ),
      el('div', { className: 'card' }, el('h3', { textContent: 'Attempts' }), attemptsTable(entries)),
    );
  } catch (e) {
    view.replaceChildren(el('p', { className: 'note', textContent: `Could not read ${kid}: ${e.message}` }));
  }
}

$('refresh').onclick = loadKids;

// --- The pending shelf (grant freely §2) -------------------------------------

function entryCard(e, actions = null) {
  return el(
    'div',
    { className: 'card' },
    el('strong', { textContent: e.name }),
    el('span', {
      className: 'badge quiet',
      textContent: [e.tags?.join(', '), e.author ? `asked for by ${e.author}` : null, e.at]
        .filter(Boolean)
        .join(' · '),
    }),
    actions,
  );
}

async function loadPending() {
  const box = $('pending');
  try {
    const list = await get('/educator/pending');
    box.replaceChildren();
    if (list.length === 0) {
      box.append(el('p', { className: 'note', textContent: 'Nothing is waiting.' }));
      return;
    }
    for (const e of list) {
      const approve = el('button', { textContent: 'Publish it' });
      const reject = el('button', { textContent: 'Throw it away' });
      approve.onclick = async () => {
        try {
          const saved = await post('/educator/approve', { id: e.id });
          status(`“${saved.name}” is on the shelf — every coach can grab it now.`);
        } catch (err) {
          status(`Could not publish: ${err.message}`);
        }
        loadPending();
        loadLibrary();
      };
      reject.onclick = async () => {
        try {
          await post('/educator/reject', { id: e.id });
          status(`“${e.name}” is gone. The kid keeps theirs.`);
        } catch (err) {
          status(`Could not throw it away: ${err.message}`);
        }
        loadPending();
      };
      box.append(entryCard(e, el('div', { className: 'row' }, approve, reject)));
    }
  } catch (err) {
    box.replaceChildren(el('p', { className: 'note', textContent: `Could not read the shelf: ${err.message}` }));
  }
}

// --- The library (fixture library §4.9) --------------------------------------

async function loadLibrary(q = '') {
  const box = $('library');
  try {
    const list = await get(q ? `/coach/fixtures?q=${encodeURIComponent(q)}` : '/coach/fixtures');
    box.replaceChildren();
    if (list.length === 0) {
      box.append(
        el('p', {
          className: 'note',
          textContent: q ? `Nothing on the shelf matches “${q}”.` : 'The shelf is empty.',
        }),
      );
      return;
    }
    for (const e of list) box.append(entryCard(e));
  } catch (err) {
    box.replaceChildren(el('p', { className: 'note', textContent: `Could not read the shelf: ${err.message}` }));
  }
}

$('search').onclick = () => loadLibrary($('q').value.trim());
$('q').onkeydown = (e) => {
  if (e.key === 'Enter') loadLibrary($('q').value.trim());
};
$('listall').onclick = () => {
  $('q').value = '';
  loadLibrary();
};

paintPlayer();
paintCoach();
loadKids();
loadPending();
loadLibrary();
