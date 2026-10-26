// Pull It Apart: the systems pack's playable (decisions 2026-10-26 §9).
//
// The kid picks a system — the flashlight, the kidneys, a cell a flu
// virus has landed on, the car, or one a grown-up put in at the
// Workbench — and sees it working. Then they intervene, which is how
// children learn what causes what: take a part out, put a bad one in,
// add another, move a two-ended part beside or in line with another,
// block one flow. Every change opens the gate: a question made from the
// system and the bench (systems/questions.js), and nothing runs until
// the kid has answered it (invariant 2). Then the solver's run plays,
// with the cascade said as it happens; then the answer, the system as
// it was beside the system as it is now, and the follow-ups — what kind
// of wrong the Consultant was, why the kid thinks it happened when it
// surprised them, and the debrief when one is due. Nothing in this file
// decides an outcome.
//
// "Something's wrong" turns it round: a part is secretly bad, the
// symptom shows, and the kid checks parts (three checks, each a meter's
// honest reading beside a healthy one's) and swaps in good parts —
// calling each time whether it will fix it — until it works again.

import {
  LIBRARY,
  validateSystem,
  runSystem,
  normalsOf,
  wiring,
  pull,
  swapBad,
  putGood,
  addCopy,
  place,
  unplace,
  block,
  unblock,
  isBlocked,
  benchKey,
  instanceOf,
  instances,
  copiesOf,
  partState,
  isPresent,
  slotOf,
  ask,
  commit,
  score,
  consult,
  ANSWERS,
  mysteries,
  pickMystery,
  mysteryBench,
  probe,
  partName,
} from '../systems/index.js';
import { makeJournal, record, calibration, trustCalibration, debriefKind } from '../engine/journal.js';
import { makeDiagram, frameAt, scalesFor, drawChart } from './apart-draw.js';
import { makeVoice } from './speak.js';
import { caughtBy, callWords } from './advice.js';
import { debriefQuestion, debriefRecord } from './debrief.js';
import {
  changeWords,
  eventWords,
  truthWords,
  claimWords,
  wrongKinds,
  EXPLAIN_QUESTION,
  EXPLAIN_CHOICES,
  debriefChoicesFor,
  partWords,
  flowWords,
  timeWords,
  num,
  flowUnit,
} from './apart-words.js';

const $ = (id) => document.getElementById(id);
const KID = 'willitbreak-kid'; // the educator's window names the player (demo/educator.html)
const READER = 'willitbreak-reader'; // and flips the reader toggle
const SHELF = 'apart-shelf'; // systems a grown-up saved at the Workbench, on this device
const CHECKS = 3; // meter readings per mystery                REVISIT
const PLAY_SECONDS = 7; // a whole run, on screen
const LOOP_SECONDS = 9; // the shipped system, idling

// --- Storage: per-viewer conveniences, wrapped; fine without them -------
const load = (k, d) => {
  try {
    return JSON.parse(localStorage.getItem(k)) ?? d;
  } catch {
    return d;
  }
};
const save = (k, v) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* fine */
  }
};
const readKid = () => {
  try {
    return localStorage.getItem(KID) || 'friend';
  } catch {
    return 'friend';
  }
};
const readsNow = () => {
  try {
    return localStorage.getItem(READER) === 'true';
  } catch {
    return false;
  }
};

let kid = readKid();
let spoken = !readsNow(); // spoken-first until a grown-up says the kid reads
const voice = makeVoice({ enabled: spoken });

const journal = makeJournal();
for (const e of load('apart-journal', []).slice(-300)) {
  try {
    record(journal, e);
  } catch {
    /* a bad line is dropped */
  }
}
const saveJournal = () => save('apart-journal', journal.entries.slice(-300));

// The educator's window hears every call (decisions 2026-10-25 §5); the
// game plays on with nobody listening.
function logEntry(entry) {
  try {
    fetch('/educator/log', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kid, entries: [entry] }) }).catch(() => {});
  } catch {
    /* fine */
  }
}

// Systems a grown-up checked and saved at the Workbench, checked again
// here: a stored file is never trusted, and a bad one is skipped.
function shelfSystems() {
  const out = [];
  const raw = load(SHELF, []);
  for (const e of Array.isArray(raw) ? raw : []) {
    try {
      const s = validateSystem(e.system);
      if (!LIBRARY.some((b) => b.id === s.id) && !out.some((x) => x.id === s.id)) out.push(s);
    } catch {
      /* skipped, never fatal */
    }
  }
  return out;
}

// --- State ---------------------------------------------------------------
let systems = [...LIBRARY, ...shelfSystems()];
let S = null; // the system on the bench
let H = null; // its run as shipped
let N = {}; // what each flow carries as shipped
let diagram = null;
let mode = load('apart-mode', 'apart'); // 'apart' | 'mystery'
let depth = load('apart-depth', 'feel'); // 'feel' | 'measure'
let consultantPref = load('apart-consultant', null); // null: follow the depth
const consultantOn = () => consultantPref ?? depth === 'measure';
let bench = {};
let current = null; // the run of the bench as it stands, worked out and kept out of sight
let selected = null;
let lastTouched = null;
let repairing = false; // the last change put something back the way it ships
let phase = 'look'; // 'look' | 'gate' | 'playing' | 'result'
let lastVerdict = null; // how the last scored run on this system ended
let pending = null; // the open call: question, answer, advice, trust
let skip = 0; // "ask me something else"
let play = null; // the playback
let picking = null; // a tap on the diagram answers something
let mystery = null;
let held = null; // an entry waiting on its follow-ups before the adult hears it
const rounds = load('apart-rounds', {});
const mysteryRounds = load('apart-mysteries', {});
const mysteryPools = new Map();

const levelId = () => (mode === 'mystery' && mystery ? mystery.level : `sys:${S.id}`);
const seenKeys = () => new Set(['', ...journal.entries.filter((e) => e.level === `sys:${S.id}` && typeof e.setup === 'string').map((e) => e.setup)]);

// --- Choosing a system ------------------------------------------------------
function renderShelf() {
  const row = $('shelf');
  row.replaceChildren();
  for (const s of systems) {
    const b = document.createElement('button');
    b.setAttribute('aria-pressed', String(S?.id === s.id));
    const icon = document.createElement('span');
    icon.className = 's-icon';
    icon.textContent = s.icon;
    const name = document.createElement('span');
    name.textContent = s.title + (LIBRARY.includes(s) ? '' : ' ✎');
    b.append(icon, name);
    b.title = s.model;
    b.onclick = () => choose(s.id);
    row.appendChild(b);
  }
}

function renderAbout() {
  $('modelwhat').textContent = S.model;
  const list = (id, items) => {
    $(id).replaceChildren(
      ...items.map((t) => {
        const li = document.createElement('li');
        li.textContent = t;
        return li;
      }),
    );
  };
  list('modelnotes', S.notes.length ? S.notes : ['It does not say.']);
  list('modelsources', S.sources.length ? S.sources : ['It does not say.']);
}

function choose(id) {
  S = systems.find((s) => s.id === id) ?? systems[0];
  save('apart-system', S.id);
  H = runSystem(S, {});
  N = normalsOf(H);
  diagram = makeDiagram($('diagram'), S, { onPick, normal: N, scales: scalesFor(S, H), hideFaults: mode === 'mystery' });
  closeFollowups();
  bench = {};
  selected = null;
  lastTouched = null;
  repairing = false;
  lastVerdict = null;
  pending = null;
  play = null;
  picking = null;
  mystery = null;
  renderShelf();
  renderAbout();
  $('introtext').textContent = S.intro;
  voice.say(S.intro);
  if (mode === 'mystery') startMystery();
  else lookAtShipped();
  renderModes();
  renderStats();
}

function lookAtShipped() {
  bench = {};
  current = H;
  diagram.setBench(bench);
  phase = 'look';
  hide('gate', 'result');
  hint('It is working. Tap a part to take it out, swap it, add another or move it — or block something it does.');
  renderPart();
}

// --- Modes -----------------------------------------------------------------
function renderModes() {
  $('apart').setAttribute('aria-pressed', String(mode === 'apart'));
  $('mystery').setAttribute('aria-pressed', String(mode === 'mystery'));
  $('feel').setAttribute('aria-pressed', String(depth === 'feel'));
  $('measure').setAttribute('aria-pressed', String(depth === 'measure'));
  $('consultant').setAttribute('aria-pressed', String(consultantOn()));
  $('checksbox').hidden = mode !== 'mystery';
}
$('apart').onclick = () => setMode('apart');
$('mystery').onclick = () => setMode('mystery');
$('feel').onclick = () => setDepth('feel');
$('measure').onclick = () => setDepth('measure');
$('consultant').onclick = () => {
  consultantPref = !consultantOn();
  save('apart-consultant', consultantPref);
  renderModes();
  if (phase === 'gate') openGate();
};
function setMode(m) {
  if (phase === 'playing') return;
  mode = m;
  save('apart-mode', m);
  choose(S.id);
}
function setDepth(d) {
  if (phase === 'playing') return;
  depth = d;
  save('apart-depth', d);
  renderModes();
  if (phase === 'gate') openGate();
}

// --- The kid's hands: changes to the bench ----------------------------------
function onPick(what) {
  if (phase === 'playing') return;
  // A tap may answer something first (a move's target, "which stops
  // first"); one it can't use falls through to choosing a part.
  if (picking && picking(what)) return;
  if (what.none) {
    selected = null;
  } else if (what.flow) {
    selected = ownerOf(what.flow);
  } else if (what.part) {
    selected = what.part;
  }
  diagram.select(selected);
  renderPart();
}

const ownerOf = (flowId) => (wiring(S, bench).flows.find((f) => f.id === flowId) ?? {}).part ?? null;

function change(next, focus, { repair = false } = {}) {
  bench = next;
  lastTouched = focus;
  repairing = repair;
  play = null;
  closeFollowups();
  hide('result');
  diagram.setBench(bench);
  // The run of this bench is worked out now and kept out of sight until
  // the kid has called it.
  current = runSystem(S, bench, { normal: N });
  showStart();
  if (selected && !instances(S, bench).includes(selected)) selected = null;
  diagram.select(selected);
  renderPart();
  skip = 0;
  openGate();
}

const tryChange = (fn, focus, opts) => {
  try {
    change(fn(), focus, opts);
  } catch (err) {
    hint(err.message);
  }
};

function renderPart() {
  const panel = $('partpanel');
  if (!selected || phase === 'playing') {
    panel.hidden = true;
    return;
  }
  panel.hidden = false;
  const { part, copy } = instanceOf(S, selected);
  const st = partState(S, bench, selected);
  const here = isPresent(S, bench, selected);
  const hidden = mode === 'mystery'; // a secret fault stays secret
  const state = !here ? ' — out' : st.broken ? ' — broken 💥' : st.as === 'bad' && !hidden ? ` — ${part.faults.find((f) => f.id === st.fault)?.name}` : '';
  $('parttitle').textContent = `${part.icon} ${partName(S, selected)}${state}`;
  const w = partWords(S, wiring(S, bench), selected);
  $('partsays').textContent = w.says;
  $('partwired').textContent = w.wired.length ? `Wired: ${w.wired.join(' · ')}` : '';
  const acts = $('partacts');
  acts.replaceChildren();
  const flows = $('flows');
  flows.replaceChildren();
  const button = (label, fn, parent = acts) => {
    const b = document.createElement('button');
    b.textContent = label;
    b.onclick = fn;
    parent.appendChild(b);
    return b;
  };

  if (mode === 'mystery') {
    if (mystery?.solved) return;
    const c = button(`🔍 Check it (${mystery?.checks ?? 0} left)`, () => checkPart(selected));
    c.disabled = !mystery || mystery.checks <= 0 || !here;
    button('🔧 Put a good one in', () => tryChange(() => putGood(S, bench, selected), selected, { repair: true }));
    return;
  }
  if (here && !part.keep) button(copy ? '✋ Take this one out' : '✋ Take it out', () => tryChange(() => pull(S, bench, selected), selected));
  if (!here && st.as === 'out' && copy === null) button('↩️ Put it back', () => tryChange(() => putGood(S, bench, selected), selected, { repair: part.installed }));
  if (here && (st.as === 'bad' || st.broken)) button('🔧 Put a good one in', () => tryChange(() => putGood(S, bench, selected), selected, { repair: true }));
  if (here && part.faults.length) {
    const more = button('⚠️ Put in a bad one…', () => {
      more.remove();
      for (const f of part.faults) button(`${f.icon ?? '⚠️'} ${f.name}`, () => tryChange(() => swapBad(S, bench, selected, f.id), selected));
    });
  }
  if (here && copy === null && part.copies > copiesOf(S, bench, part.id).length) {
    button('➕ Add another', () => tryChange(() => addCopy(S, bench, part.id), part.id));
  }
  if (here && !part.keep && slotOf(S, selected)) {
    button('↔️ Move it…', () => startMove(selected));
    if (st.at) button('🏠 Back to its own spot', () => tryChange(() => unplace(S, bench, selected), selected, { repair: true }));
  }
  if (here) {
    const own = wiring(S, bench).flows.filter((f) => f.part === selected);
    for (const f of own) {
      const blocked = isBlocked(bench, f.id);
      button(blocked ? `✅ Unblock: ${flowWords(S, f.id)}` : `⛔ Block: ${flowWords(S, f.id)}`, () =>
        tryChange(() => (blocked ? unblock(S, bench, f.id) : block(S, bench, f.id)), selected, { repair: blocked }),
      flows);
    }
  }
  if (part.keep) {
    const p = document.createElement('p');
    p.className = 'hint';
    p.textContent = 'This one is the stage the rest stands on: it stays in. You can still block what it does.';
    acts.appendChild(p);
  }
}

// Moving a two-ended part: tap the spot it should go in, then say
// beside it or in line with it.
function startMove(id) {
  const mine = slotOf(S, id);
  const targets = instances(S, bench).filter((t) => t !== id && slotOf(S, t)?.substance === mine.substance && !partState(S, bench, t).at);
  diagram.setPickable(targets);
  hint(`Tap the part whose spot ${partName(S, id)} should go in.`);
  picking = (what) => {
    if (!what.part || !targets.includes(what.part)) {
      picking = null;
      diagram.setPickable(null);
      hint('Moving cancelled.');
      return true;
    }
    const target = what.part;
    picking = null;
    diagram.setPickable(null);
    const acts = $('partacts');
    acts.replaceChildren();
    const ask2 = document.createElement('span');
    ask2.className = 'label';
    ask2.textContent = `Where, by ${partName(S, target)}?`;
    acts.appendChild(ask2);
    for (const [how, label] of [
      ['beside', '⇉ Beside it (side by side)'],
      ['inline', '→→ In line with it (one after the other)'],
    ]) {
      const b = document.createElement('button');
      b.textContent = label;
      b.onclick = () => tryChange(() => place(S, bench, id, target, how), id);
      acts.appendChild(b);
    }
    return true;
  };
}

// --- The gate: nothing runs until the kid has said what will happen ---------
function openGate() {
  phase = 'gate';
  show('gate');
  hide('result');
  $('gateerr').textContent = '';
  const key = benchKey(S, bench);
  // A setup already called can't be called again unchanged — except a
  // repair after a failure, even one that puts it back the way it ships:
  // "does that fix it?" is the troubleshooter's own question.
  if (mode === 'apart' && seenKeys().has(key) && !(repairing && lastVerdict === 'fails')) {
    pending = null;
    picking = null;
    $('advice').textContent = '';
    $('trustrow').replaceChildren();
    $('question').textContent = key ? 'You have seen this one. Change something to make a new call.' : 'This is how it ships. Change something, then call it.';
    $('options').replaceChildren();
    $('bandrow').hidden = true;
    $('run').disabled = !key;
    $('run').textContent = '▶ Watch it again';
    $('another').hidden = true;
    return;
  }
  $('run').textContent = '▶ Run it';
  $('another').hidden = mode === 'mystery';
  const round = (rounds[S.id] ?? 0) + skip;
  const question =
    mode === 'mystery'
      ? {
          type: 'works',
          kind: 'binary',
          about: null,
          asks: `Swap ${partName(S, lastTouched)} for a good one: will it work again?`,
          options: [
            { id: 'works', label: 'Yes, that fixes it', icon: '🔧' },
            { id: 'fails', label: 'No, still broken', icon: '🚫' },
          ],
        }
      : ask(S, bench, {
          mode: depth,
          round,
          seed: `${kid}:${S.id}:${key}`,
          focus: lastTouched,
          // mending after a failure, the troubleshooter's question is the one
          kind: repairing && lastVerdict === 'fails' && depth === 'feel' ? 'works' : null,
        });
  pending = { question, key, bench, answer: null, advice: null, trust: null, run: current };
  hint(question.type === 'first' ? 'Tap the part on the diagram, or pick it below — then run it.' : 'Say what will happen — then run it.');
  $('gate').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  if (consultantOn() && ANSWERS.includes(question.type)) {
    pending.advice = consult({ system: S, bench, question, seed: `${kid}:${S.id}:${key}:${question.type}:${round}`, result: current, healthy: H });
  }
  renderGate();
  voice.say(question.asks);
}

function renderGate() {
  const { question, advice } = pending;
  $('advice').textContent = advice ? claimWords(S, question, advice) : '';
  const trust = $('trustrow');
  trust.replaceChildren();
  if (advice) {
    for (const [call, label] of [
      ['trusted', 'Trust it 👍'],
      ['doubted', 'Doubt it 🤨'],
      ['deferred', 'Can’t tell — run it 🔍'],
    ]) {
      const b = document.createElement('button');
      b.textContent = label;
      b.setAttribute('aria-pressed', String(pending.trust === call));
      b.onclick = () => {
        pending.trust = call;
        renderGate();
      };
      trust.appendChild(b);
    }
  }
  $('question').textContent = question.asks;
  const opts = $('options');
  opts.replaceChildren();
  $('bandrow').hidden = question.kind !== 'band';
  if (question.kind === 'binary') {
    for (const o of question.options) {
      const b = document.createElement('button');
      b.className = `pick${pending.answer === o.id ? ' chosen' : ''}`;
      b.setAttribute('aria-pressed', String(pending.answer === o.id));
      if (o.icon) {
        const i = document.createElement('span');
        i.className = 'picon';
        i.textContent = o.icon;
        b.appendChild(i);
      }
      const l = document.createElement('span');
      l.className = 'plabel';
      l.textContent = o.label;
      b.appendChild(l);
      b.onclick = () => {
        pending.answer = o.id;
        renderGate();
      };
      opts.appendChild(b);
    }
    // "Which stops first" can be answered on the diagram itself.
    if (question.type === 'first') {
      const ids = question.options.map((o) => o.id);
      picking = (what) => {
        if (!what.part || !ids.includes(what.part)) return false;
        pending.answer = what.part;
        renderGate();
        return true;
      };
    } else picking = null;
  } else {
    picking = null;
    $('bandunit').textContent = `${question.unit} (0 to ${question.max}, in steps of ${question.resolution})`;
    $('lo').step = String(question.resolution);
    $('hi').step = String(question.resolution);
    $('lo').max = String(question.max);
    $('hi').max = String(question.max);
  }
  const answered = question.kind === 'band' ? $('lo').value !== '' && $('hi').value !== '' : pending.answer !== null;
  $('run').disabled = !answered || (advice && !pending.trust);
}
$('lo').oninput = () => pending && renderGate();
$('hi').oninput = () => pending && renderGate();
$('another').onclick = () => {
  skip++;
  openGate();
};

$('run').onclick = () => {
  if (!pending) {
    if (current && benchKey(S, bench)) startPlayback(current, null); // watch again, nothing scored
    return;
  }
  const q = pending.question;
  try {
    pending.commitment = commit(q, q.kind === 'band' ? { lo: Number($('lo').value), hi: Number($('hi').value) } : pending.answer);
  } catch (err) {
    $('gateerr').textContent = err.message;
    return;
  }
  picking = null;
  startPlayback(pending.run, pending);
};

// --- Playback ------------------------------------------------------------------
function showStart() {
  // The bench before it runs: stores as they start, nothing moving yet.
  const f = frameAt(current, 0);
  for (const k of Object.keys(f.flows)) f.flows[k] = 0;
  diagram.setFrame(f);
  $('clock').textContent = '';
  $('captions').replaceChildren();
}

function startPlayback(result, call) {
  phase = 'playing';
  hint('');
  hide('gate', 'partpanel');
  closeFollowups();
  const firstTrouble = result.events.find((e) => e.kind === 'broke' || e.kind === 'goal');
  play = { result, call, i: 0, said: 0, slowAt: firstTrouble ? firstTrouble.t : null };
  $('captions').replaceChildren();
}

function advance(seconds) {
  const r = play.result;
  const n = r.trace.t.length;
  let rate = (n - 1) / PLAY_SECONDS;
  const t = r.trace.t[Math.floor(play.i)];
  // Slow motion as it goes wrong, the way the bridge's break plays.
  if (play.slowAt !== null && Math.abs(t - play.slowAt) < 0.06 * r.time.end) rate *= 0.3;
  play.i = Math.min(n - 1, play.i + seconds * rate);
  const i = Math.floor(play.i);
  diagram.setFrame(frameAt(r, i));
  $('clock').textContent = timeWords(r.trace.t[i], S.time.unit);
  const now = r.trace.t[i];
  const due = r.events.filter((e) => e.t <= now + 1e-9);
  if (due.length > play.said) {
    for (const e of due.slice(play.said)) caption(e.kind === 'changed' ? changeWords(S, e) : eventWords(S, e));
    play.said = due.length;
  }
  if (play.i >= n - 1) finish();
}

function caption(text) {
  if (!text) return;
  const box = $('captions');
  const d = document.createElement('div');
  d.textContent = text;
  box.appendChild(d);
  while (box.children.length > 3) box.firstChild.remove();
}

// --- The answer ------------------------------------------------------------------
function finish() {
  const { result, call, symptom } = play;
  play = null;
  phase = 'result';
  bench = result.after; // what broke stays broken
  diagram.setBench(bench);
  diagram.setFrame(frameAt(result, result.trace.t.length - 1));
  show('result');
  hint(mode === 'mystery' ? 'Tap a part to check it or put a good one in.' : 'Change something else, or put it all back.');
  $('nextmystery').hidden = true;
  $('reset').hidden = mode === 'mystery';
  if (mode === 'mystery' && mystery) mystery.last = result; // the meters read the latest run
  if (!call) {
    if (symptom) {
      // the symptom has played: say what is wrong, and hand over the tools
      $('verdict').textContent = '🩺 Something’s wrong.';
      $('truth').textContent = `${S.goal.checks[result.failure?.check ?? 0].fails} Find the bad part and fix it. You have ${CHECKS} checks: tap a part, then 🔍.`;
      voice.say($('truth').textContent);
    } else {
      $('verdict').textContent = 'Here it is again.';
      $('truth').textContent = '';
    }
    $('callwords').textContent = '';
    drawResultChart(result, null);
    drawCascade(result);
    renderPart();
    return;
  }
  const { question, commitment, advice, trust } = call;
  const consultant = advice ? { wrong: advice.wrong, call: trust, caught: advice.wrong && trust === 'doubted' ? 'before' : null } : null;
  const { entry, hit, truth } = score(S, question, commitment, result, H, { bench: call.bench, repair: repairing, consultant, level: levelId(), setup: call.key });
  record(journal, entry);
  saveJournal();
  lastVerdict = result.verdict;
  repairing = false; // the flag was the change's, and the run has answered it
  rounds[S.id] = (rounds[S.id] ?? 0) + 1;
  save('apart-rounds', rounds);
  held = entry;
  const verdict = hit ? '✅ Called it!' : '❌ Not this time.';
  $('verdict').textContent = verdict;
  $('truth').textContent = truthWords(S, question, truth);
  $('callwords').textContent = advice ? callWords(advice, trust) : '';
  voice.say(`${verdict} ${truthWords(S, question, truth)}`);
  drawResultChart(result, question, commitment);
  drawCascade(result);
  renderStats();

  if (mode === 'mystery' && result.verdict === 'works') {
    mystery.solved = true;
    const names = mystery.pick.map((m) => `${partName(S, m.part)} (${instanceOf(S, m.part).part.faults.find((f) => f.id === m.fault).name})`).join(' and ');
    $('truth').textContent += ` It was ${names}.`;
    diagram.setHideFaults(false);
    $('nextmystery').hidden = false;
  }

  // The follow-ups, one at a time, before the grown-up hears the call:
  // what kind of wrong the Consultant was, then — after a surprise — why
  // the kid thinks it happened, then the debrief if one is due.
  // One reflection at a time, never a toll: a due debrief stands in for
  // the "why?" (it asks about the kid's own attempts, which is the
  // deeper question), and a kid who called it is not asked why.
  const due = debriefKind(journal);
  const queue = [];
  if (advice) queue.push(() => askPostmortem(entry, question, advice, trust));
  if (!hit && !due) queue.push(() => askExplain(entry));
  queue.push(() => {
    if (due) askDebrief(entry, due); // the grown-up hears it once the debrief is answered
    else closeFollowups();
  });
  followups = queue;
  nextFollowup();
  renderPart();
}

let followups = [];
function nextFollowup() {
  const f = followups.shift();
  if (f) f();
}

function closeFollowups() {
  if (held) {
    logEntry(held); // a call is never lost to a closed panel
    held = null;
  }
  followups = [];
  $('followup').hidden = true;
}

function followup(question, choices, onAnswer, { typed = true, skipLabel = 'Skip' } = {}) {
  $('followup').hidden = false;
  $('followq').textContent = question;
  $('followout').textContent = '';
  voice.say(question);
  const picks = $('followpicks');
  picks.replaceChildren();
  for (const c of choices) {
    const b = document.createElement('button');
    b.className = 'pick';
    if (c.icon) {
      const i = document.createElement('span');
      i.className = 'picon';
      i.textContent = c.icon;
      b.appendChild(i);
    }
    const l = document.createElement('span');
    l.className = 'plabel';
    l.textContent = c.label;
    b.appendChild(l);
    b.onclick = () => onAnswer(c);
    picks.appendChild(b);
  }
  $('followtyped').hidden = !typed || spoken; // a kid who cannot read cannot type
  $('followtext').value = '';
  $('followsend').onclick = () => {
    const said = $('followtext').value.trim();
    if (said) onAnswer({ said });
  };
  $('followskip').textContent = skipLabel;
  $('followskip').onclick = () => onAnswer(null);
}

function askPostmortem(entry, question, advice, trust) {
  followup(
    'The Consultant said that before it ran. What kind of wrong was it — or was it right?',
    wrongKinds(question).map((k) => ({ id: k.id, label: k.label })),
    (c) => {
      const pick = c?.id ?? null;
      entry.consultant = { ...entry.consultant, caught: caughtBy(advice, pick, trust) };
      saveJournal();
      $('followout').textContent = !advice.wrong
        ? '🤖 That one was true — the Consultant is right about four times in five.'
        : pick === advice.errorType
          ? '✅ Caught it — that is exactly the kind of wrong it was.'
          : `❌ It was wrong, the ${wrongKinds(question).find((k) => k.id === advice.errorType)?.label.toLowerCase() ?? 'other'} kind.`;
      setTimeout(nextFollowup, 1600);
    },
    { typed: false, skipLabel: 'I don’t know' },
  );
}

function askExplain(entry) {
  followup(EXPLAIN_QUESTION, EXPLAIN_CHOICES, (c) => {
    entry.explain = c ? { said: String(c.said).slice(0, 200) } : { said: null };
    saveJournal();
    nextFollowup();
  });
}

function askDebrief(entry, kind) {
  followup(
    debriefQuestion(kind),
    debriefChoicesFor(kind),
    (c) => {
      entry.debrief = debriefRecord(kind, c ? c.said : null); // a skip is a skip
      saveJournal();
      closeFollowups();
    },
    { skipLabel: 'I’d rather keep going' },
  );
}

function drawResultChart(result, question, commitment = null) {
  // What to chart: what the question was about, else what the goal reads.
  let read = question?.about?.node !== undefined || question?.about?.flow !== undefined ? question.about : null;
  if (!read && question?.type === 'reading') read = S.measure.read;
  if (!read) read = S.goal.checks.find((c) => c.read)?.read ?? (S.measure && !S.measure.read.lasts ? S.measure.read : null);
  const svg = $('chart');
  if (!read) {
    svg.replaceChildren();
    return;
  }
  const pick = (r) => (read.node !== undefined ? r.trace.nodes[read.node] : r.trace.flows[read.flow].map(Math.abs));
  const sub = read.node !== undefined ? S.substances.find((s) => s.id === S.nodes.find((n) => n.id === read.node)?.substance) : null;
  const unit = sub ? sub.level : flowUnit(S, read.flow);
  const color = sub?.color ?? '#2b2620';
  const lines = S.goal.checks
    .filter((c) => c.read && (c.read.node === read.node && read.node !== undefined || (c.read.flow === read.flow && read.flow !== undefined)))
    .flatMap((c) => [c.above, c.below].filter((v) => v !== null).map((y) => ({ y, label: `the line: ${num(y, unit)}` })));
  const band = question?.type === 'reading' && commitment ? commitment.call : null;
  const marks = result.failedAt !== null && result.failedAt < result.time.end ? [{ t: result.failedAt, label: 'it failed here' }] : [];
  drawChart(svg, {
    series: [
      { t: H.trace.t, v: pick(H), color: '#8a8170', label: 'as it ships', dashed: true },
      { t: result.trace.t, v: pick(result), color, label: 'after your change' },
    ],
    lines,
    band,
    marks,
    unit,
    timeUnit: S.time.unit,
    end: result.time.end,
  });
}

function drawCascade(result) {
  const list = $('cascade');
  list.replaceChildren();
  for (const e of result.events) {
    const li = document.createElement('li');
    li.textContent = e.kind === 'changed' ? changeWords(S, e) : eventWords(S, e);
    list.appendChild(li);
  }
  if (!result.events.some((e) => e.kind !== 'changed')) {
    const li = document.createElement('li');
    li.textContent = 'Nothing stopped, nothing broke.';
    list.appendChild(li);
  }
}

$('keepgoing').onclick = () => {
  closeFollowups();
  hide('result');
  if (mode === 'mystery' && !mystery?.solved) {
    phase = 'look';
    hint('Check a part, or put a good one in where you think the trouble is.');
    return;
  }
  if (mode === 'mystery') return;
  current = runSystem(S, bench, { normal: N });
  showStart();
  openGate();
};
$('reset').onclick = () => {
  closeFollowups();
  lookAtShipped();
};
$('nextmystery').onclick = () => {
  closeFollowups();
  mysteryRounds[S.id] = (mysteryRounds[S.id] ?? 0) + 1;
  save('apart-mysteries', mysteryRounds);
  startMystery();
};

// --- Something's wrong ------------------------------------------------------------
function startMystery() {
  if (!mysteryPools.has(S.id)) mysteryPools.set(S.id, mysteries(S));
  const pool = mysteryPools.get(S.id);
  const index = mysteryRounds[S.id] ?? 0;
  const pick = pickMystery(S, `${kid}:${S.id}:${index}`, pool);
  diagram.setHideFaults(true);
  hide('gate', 'result');
  if (!pick) {
    hint('Nothing can go wrong here that you could see: everything has a spare.');
    lookAtShipped();
    return;
  }
  const hidden = mysteryBench(S, pick);
  const symptom = runSystem(S, hidden, { normal: N });
  mystery = { pick, level: `sys:${S.id}:mystery:${index}`, checks: CHECKS, last: symptom, solved: false };
  bench = hidden;
  current = symptom;
  diagram.setBench(bench);
  renderModes();
  $('checks').textContent = String(mystery.checks);
  // The symptom plays first: watching it go wrong is the first clue.
  startPlayback(symptom, null);
  play.symptom = true;
}

function checkPart(id) {
  if (!mystery || mystery.checks <= 0) return;
  mystery.checks--;
  $('checks').textContent = String(mystery.checks);
  const p = probe(S, mystery.last, H, id);
  const table = document.createElement('table');
  table.className = 'readings';
  const head = table.insertRow();
  for (const h of ['', 'now', 'a healthy one']) {
    const th = document.createElement('th');
    th.textContent = h;
    head.appendChild(th);
  }
  for (const r of p.readings) {
    const row = table.insertRow();
    const unit = r.kind === 'node' ? S.substances.find((s) => s.id === (S.nodes.find((n) => n.id === r.id.replace(/#\d+$/, '')) ?? {}).substance)?.level ?? '' : flowUnit(S, r.id);
    row.insertCell().textContent = r.kind === 'node' ? (S.nodes.find((n) => n.id === r.id.replace(/#\d+$/, ''))?.name ?? r.id) : `through it: ${flowWords(S, r.id)}`;
    row.insertCell().textContent = num(r.kind === 'flow' ? Math.abs(r.value) : r.value, unit);
    row.insertCell().textContent = num(r.kind === 'flow' ? Math.abs(r.normal) : r.normal, unit);
  }
  renderPart();
  const note = document.createElement('p');
  note.className = 'hint';
  note.textContent = `🔍 ${partName(S, id)}, at ${timeWords(p.t, S.time.unit)}:`;
  $('flows').replaceChildren(note, table);
}

// --- Words on the page ----------------------------------------------------------------
function hint(text) {
  $('hint').textContent = text;
}
function show(...ids) {
  for (const id of ids) $(id).hidden = false;
}
function hide(...ids) {
  for (const id of ids) $(id).hidden = true;
}

function renderStats() {
  const c = calibration(journal);
  $('calib').textContent = c.total ? `${c.hits}/${c.total} · streak ${c.streak}` : '—';
  const t = trustCalibration(journal);
  $('trust').textContent = t.judged || t.deferred ? `${t.correct}/${t.judged}${t.deferred ? ` · ran it ${t.deferred}×` : ''}` : '—';
}

// --- The loop -----------------------------------------------------------------------------
let lastTs = null;
let idleI = 0;
function loop(ts) {
  const seconds = lastTs === null ? 0 : Math.min(0.1, (ts - lastTs) / 1000);
  lastTs = ts;
  if (diagram) {
    if (play) {
      advance(seconds);
    } else if (phase === 'look' && benchKey(S, bench) === '') {
      // The shipped system idles through the second half of its run, steady.
      const n = H.trace.t.length;
      const from = Math.floor(n / 2);
      idleI = (idleI + (seconds * (n - from)) / LOOP_SECONDS) % (n - from);
      diagram.setFrame(frameAt(H, from + Math.floor(idleI)));
    }
    diagram.tick(seconds);
  }
  requestAnimationFrame(loop);
}

// The educator's window flips the reader toggle and names the player in
// another tab (same device, same origin); both arrive here as they happen.
addEventListener('storage', (e) => {
  if (e.key === READER || e.key === null) {
    spoken = !readsNow();
    voice.setEnabled(spoken);
    $('readintro').hidden = !spoken;
  }
  if (e.key === KID || e.key === null) kid = readKid();
  if (e.key === SHELF) {
    systems = [...LIBRARY, ...shelfSystems()];
    renderShelf();
  }
});
$('readintro').hidden = !spoken;
$('readintro').onclick = () => voice.say(S.intro);

choose(load('apart-system', LIBRARY[0].id));
requestAnimationFrame(loop);
