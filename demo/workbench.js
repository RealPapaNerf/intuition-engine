// The Workbench (decisions 2026-10-26 §8): where a grown-up puts a
// system in for a kid to pull apart.
//
// The owner's ask was an engine and an interface that can take a system
// in — a car, an RC car, a computer, a kidney, a virus — and let the kid
// play with it. The engine half is the format: three laws, wiring and
// numbers, checked by the same validateSystem the game uses, so nothing
// pasted here can get past the laws. This page is the other half, and it
// is the adult's because of what can still be wrong: a file can obey
// every law and still be a wrong model of the real kidney. So before a
// system reaches the shelf, the grown-up reads its answer key — every
// change a kid can make, run — against what they know of the real
// thing, and ticks that they have (invariant 7: an adult stays in the
// loop; the costume portal's tick is the precedent). The shelf is this
// device's, like saved costumes; Pull It Apart checks every entry again.
//
// A system can come from anywhere: started from a built-in, written by
// hand, or drafted in an AI chat from the prompt at the bottom of the
// page — which is the stricter road, since a model that composes a
// kidney can compose a wrong one, and is why the answer key comes before
// the save.

import { LAWS, LIMITS, TIME_UNITS, validateSystem, runSystem, normalsOf, pull, putGood, swapBad, addCopy, block, LIBRARY } from '../systems/index.js';
import { LIBRARY_DATA } from '../systems/library/index.js';
import { makeDiagram, frameAt, scalesFor } from './apart-draw.js';
import { eventWords, flowWords, onScale } from './apart-words.js';

const $ = (id) => document.getElementById(id);
const SHELF = 'apart-shelf';
const load = () => {
  try {
    const v = JSON.parse(localStorage.getItem(SHELF));
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
};
const store = (v) => {
  try {
    localStorage.setItem(SHELF, JSON.stringify(v));
    return true;
  } catch {
    return false;
  }
};

let checked = null; // the system as validated, when the text checks out
let raw = null; // the text's object, as written
let healthy = null;
let diagram = null;
let keyRun = 0; // the answer key in progress; a newer check abandons it

// --- 1. Starting points ----------------------------------------------------------
function starters() {
  const row = $('starters');
  for (const data of LIBRARY_DATA) {
    const b = document.createElement('button');
    b.textContent = `${data.icon} ${data.title}`;
    b.onclick = () => {
      $('source').value = JSON.stringify(data, null, 2);
      check();
    };
    row.appendChild(b);
  }
  const blank = document.createElement('button');
  blank.textContent = '✎ A new one (from the bathtub)';
  blank.onclick = () => {
    const tub = LIBRARY_DATA.find((d) => d.id === 'bathtub');
    $('source').value = JSON.stringify({ ...tub, id: 'my-system', title: 'My system' }, null, 2);
    check();
  };
  row.appendChild(blank);
}

// --- 2. Check it ------------------------------------------------------------------
function check() {
  keyRun++;
  checked = null;
  $('preview').hidden = true;
  $('keycard').hidden = true;
  $('savecard').hidden = true;
  $('looked').checked = false;
  $('save').disabled = true;
  $('saved').textContent = '';
  const status = $('status');
  try {
    raw = JSON.parse($('source').value);
  } catch (err) {
    status.className = 'err';
    status.textContent = `That is not JSON yet: ${err.message}`;
    return;
  }
  try {
    checked = validateSystem(raw);
  } catch (err) {
    status.className = 'err';
    status.textContent = err.message;
    return;
  }
  const flows = checked.parts.reduce((n, p) => n + p.flows.length, 0);
  const stores = checked.nodes.filter((n) => n.kind === 'store').length;
  status.className = 'ok';
  status.textContent = `✓ It checks out: ${checked.parts.length} parts, ${flows} flows, ${stores} stores, ${checked.substances.length} substances.`;
  preview();
  answerKey();
}
$('check').onclick = check;

// --- 3. What it looks like, and what it does --------------------------------------
function preview() {
  healthy = runSystem(checked, {});
  diagram = makeDiagram($('diagram'), checked, { normal: normalsOf(healthy), scales: scalesFor(checked, healthy) });
  diagram.setBench({});
  $('preview').hidden = false;
  const goal = healthy.verdict === 'works'
    ? `As it ships, it does its job: “${checked.goal.says}”`
    : `As it ships, it FAILS its own goal at ${healthy.failedAt} ${checked.time.unit}: “${checked.goal.checks[healthy.failure.check].fails}”`;
  const reading = checked.measure ? ` Its instrument reads ${onScale(healthy.reading.value, checked.measure.resolution, checked.measure.unit)}${healthy.reading.maxed ? ' — pinned at the top of the scale' : ''}.` : '';
  $('healthy').textContent = goal + reading;
  const warn = [];
  if (healthy.verdict !== 'works') warn.push('A kid starts from a system that works. Is the goal or a number off?');
  for (const b of healthy.broke) {
    warn.push(`As it ships, ${b.part} breaks at ${b.t} ${checked.time.unit} — and stays broken, so the kid’s next run starts from a broken one. Is its rating or a number off?`);
  }
  if (LIBRARY.some((b) => b.id === checked.id) && JSON.stringify(raw) !== JSON.stringify(LIBRARY_DATA.find((d) => d.id === checked.id))) {
    warn.push(`The id “${checked.id}” is a built-in system’s: give yours its own id before saving.`);
  }
  if (healthy.diag.unsettled) warn.push('The solver could not settle some one-way flows: check the drops and the wiring.');
  if (healthy.diag.clamped > 1e-6) warn.push('Something was pushed below empty and held at zero: a step may be too long for how fast things move.');
  const ul = $('warnings');
  ul.replaceChildren(
    ...warn.map((w) => {
      const li = document.createElement('li');
      li.textContent = w;
      return li;
    }),
  );
}

let looping = 0;
function loop(ts) {
  if (diagram && healthy) {
    const n = healthy.trace.t.length;
    looping = (looping + 1) % (n * 3);
    diagram.setFrame(frameAt(healthy, Math.floor(looping / 3)));
    diagram.tick(1 / 60);
  }
  requestAnimationFrame(loop);
}

// --- 4. The answer key ------------------------------------------------------------------
function rowsFor(s, withBlocks) {
  const rows = [];
  for (const p of s.parts) {
    if (p.installed && !p.keep) rows.push([`Take out ${p.name}`, () => pull(s, {}, p.id), p.id]);
    if (!p.installed) rows.push([`Put in ${p.name}`, () => putGood(s, {}, p.id), p.id]);
    for (const f of p.faults) rows.push([`${p.name}: ${f.name}`, () => swapBad(s, {}, p.id, f.id), p.id]);
    if (p.copies) rows.push([`Another ${p.name}`, () => addCopy(s, {}, p.id), p.id, 'copy']);
    if (withBlocks) for (const f of p.flows) rows.push([`Block ${p.name}: ${flowWords(s, f.id)}`, () => block(s, {}, f.id), p.id]);
  }
  return rows;
}

async function answerKey() {
  const mine = keyRun;
  const s = checked;
  const table = $('key');
  table.replaceChildren();
  const head = table.insertRow();
  for (const h of ['Change', 'Still does its job?', s.measure ? s.measure.says : 'Reading', 'What happens first']) {
    const th = document.createElement('th');
    th.textContent = h;
    head.appendChild(th);
  }
  $('keycard').hidden = false;
  const rows = rowsFor(s, $('withblocks').checked);
  const normal = normalsOf(healthy);
  const sameAsShipped = (r) =>
    Object.entries(healthy.stats.node).every(([id, st]) => Math.abs((r.stats.node[id]?.end ?? NaN) - st.end) <= 1e-9 * Math.max(1, Math.abs(st.end)) || (!Number.isFinite(st.end) && !Number.isFinite(r.stats.node[id]?.end)));
  const notes = [];
  for (let i = 0; i < rows.length; i++) {
    if (mine !== keyRun) return; // a newer check took over
    $('keystatus').textContent = `Running ${i + 1} of ${rows.length}…`;
    await new Promise((r) => setTimeout(r, 0));
    const [label, make, partId, kind] = rows[i];
    let r;
    try {
      r = runSystem(s, make(), { normal, samples: 2 });
    } catch (err) {
      notes.push(`${label}: ${err.message}`);
      continue;
    }
    const row = table.insertRow();
    row.insertCell().textContent = label;
    const v = row.insertCell();
    v.textContent = r.verdict === 'works' ? 'yes' : `no — ${s.goal.checks[r.failure.check].fails}`;
    v.className = r.verdict;
    row.insertCell().textContent = s.measure ? `${onScale(r.reading.value, s.measure.resolution, s.measure.unit)}${r.reading.maxed ? '+' : ''}` : '—';
    const first = r.events.find((e) => e.kind !== 'changed');
    row.insertCell().textContent = first ? eventWords(s, first) : 'nothing stops, nothing breaks';
    if (kind === 'copy') {
      // A copy that takes over nothing when the first one is gone is not
      // wired to what the first one feeds (a battery whose charge nothing
      // draws on). One that changes nothing beside a healthy first one is
      // a spare, which is a lesson.
      const alone = runSystem(s, pull(s, {}, partId), { samples: 2 });
      const withCopy = runSystem(s, addCopy(s, pull(s, {}, partId), partId), { samples: 2 });
      const own = (run) => JSON.stringify(s.nodes.map((n) => run.stats.node[n.id])); // the system's own stores, not the copy's
      if (!s.parts.find((p) => p.id === partId).keep && own(alone) === own(withCopy)) {
        notes.push(`Another ${instanceName(s, partId)} takes over nothing when the first is pulled: its copy is not wired to what the first one feeds.`);
      }
    } else if (sameAsShipped(r)) notes.push(`${label} changes nothing at all. If that is the lesson, good; if not, check its numbers.`);
    if (r.diag.unsettled || r.diag.clamped > 1e-6) notes.push(`${label}: the solver struggled (try a shorter step).`);
  }
  if (mine !== keyRun) return;
  $('keystatus').textContent = `${rows.length} changes, each run for ${s.time.run} ${s.time.unit}.`;
  if (notes.length) {
    const ul = $('warnings');
    for (const n of notes) {
      const li = document.createElement('li');
      li.textContent = n;
      ul.appendChild(li);
    }
  }
  $('savecard').hidden = false;
}
const instanceName = (s, id) => s.parts.find((p) => p.id === id)?.name ?? id;
$('withblocks').onchange = () => checked && answerKey();

// --- 5. Save -------------------------------------------------------------------------
$('looked').onchange = () => {
  $('save').disabled = !($('looked').checked && checked);
};
$('save').onclick = () => {
  if (!checked || !$('looked').checked) return;
  if (LIBRARY.some((b) => b.id === checked.id)) {
    $('saved').textContent = `“${checked.id}” is a built-in system’s id: give yours its own.`;
    return;
  }
  const shelf = load().filter((e) => e?.system?.id !== checked.id);
  shelf.push({ system: raw, savedAt: new Date().toISOString() });
  $('saved').textContent = store(shelf) ? `Saved “${checked.title}”. Pull It Apart shows it now.` : 'This browser would not save it.';
  renderShelf();
};

function renderShelf() {
  const ul = $('shelf');
  ul.replaceChildren();
  const shelf = load();
  if (!shelf.length) {
    const li = document.createElement('li');
    li.className = 'muted';
    li.textContent = 'Nothing yet.';
    ul.appendChild(li);
  }
  for (const e of shelf) {
    const li = document.createElement('li');
    let ok = true;
    try {
      validateSystem(e.system);
    } catch {
      ok = false;
    }
    li.textContent = `${e.system?.icon ?? '⚙️'} ${e.system?.title ?? e.system?.id ?? '?'}${ok ? '' : ' (no longer checks out — the game skips it)'} `;
    const edit = document.createElement('button');
    edit.textContent = 'Open';
    edit.onclick = () => {
      $('source').value = JSON.stringify(e.system, null, 2);
      check();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    const remove = document.createElement('button');
    remove.textContent = 'Remove';
    remove.onclick = () => {
      store(load().filter((x) => x?.system?.id !== e.system?.id));
      renderShelf();
    };
    li.append(edit, ' ', remove);
    ul.appendChild(li);
  }
}

// --- The authoring prompt ---------------------------------------------------------------
// Written from the laws and limits themselves, so it never drifts from
// what the check accepts.
function authoringPrompt() {
  const tub = LIBRARY_DATA.find((d) => d.id === 'bathtub');
  return [
    'I want a model of a real system for a children’s learning game, written as one JSON object that a strict checker will accept. The kid pulls parts out, swaps in bad ones, adds another, blocks flows, and predicts what happens before a solver runs it. The model must be honest: right in direction and roughly right in size for the real thing, with what it leaves out said plainly.',
    '',
    'THE SYSTEM I WANT: <describe it here — e.g. “an RC car”, “a computer’s cooling”, “a lemonade stand’s supply line”, “the heart and lungs”>',
    '',
    'THE FORMAT',
    `- id (lowercase letters, digits, dashes), title, icon (one emoji), model (one line: what this is a model of), intro (for a child: the scene and the goal, no hints).`,
    `- time: { unit: one of ${Object.keys(TIME_UNITS).join(', ')}, step, run } — at most ${LIMITS.steps} steps; pick a step small next to how fast things change.`,
    '- substances: [{ id, name (kid words), amount (unit), level (unit), flow (optional display unit), color (#rrggbb) }].',
    '- nodes — where stuff is: { id, substance, name, kind: "store", capacity (amount per unit of level), start (amount), max? (room for machines only: a store a conduct or oneway flow touches may not have one — if it overflows, make the overflow a oneway flow out at the brim) } or { kind: "fixed", level } (the outside world: air, a drain, ground; level 0 or more — levels count up from empty, so for warmth count from below the coldest thing) or { kind: "junction" } (wires meeting; stores nothing). Give unheld nodes at: [column, row] for the diagram.',
    '- parts: [{ id, name, icon, says (what it is — not what it is for), job (what it is for, in kid words), at: [column, row], holds?: [store ids it contains], within?: part id it sits inside, keep?: true for the stage that cannot be pulled, installed?: false for a spare, copies?: how many more the kid may add (only if a copy would really connect the way a real extra one would), flows, gates?, ratings?, faults? }].',
    '',
    'THE ONLY LAWS (a flow chooses one; nothing else exists):',
    ...Object.entries(LAWS).map(([k, l]) => `- ${k}: ${l.says} Parameters: ${l.params.join(', ')}.`),
    '- pump: shorthand for a react moving one substance at a constant rate: { law: "pump", from: node or null (made here), to: node or null (used up), rate, by? }.',
    'A flow may also carry needs: [{ part }] or [{ node, atLeast?, atMost? }]. A part may carry gates: [{ flow, by: node, open: "above"|"below", at, band }] (a thermostat, a float valve) and ratings: [{ flow, above, for }] or [{ node, above?|below?, for }] (it breaks when pushed past them for longer than `for`).',
    '- faults: [{ id, name (kid words: "a clogged drain"), icon?, changes: [{ flow, scale: { param: factor } } | { flow, set: { param: value } } | { flow, reverse: true } | { node, start: factor } | { gate, stuck: "open"|"shut" } | { broken: true }] }] — only on the part’s own flows, gates and stores.',
    '- goal: { says, asks (a yes/no question), checks: [{ read: { node } | { flow }, above?, below?, when?: "always"|"end", fails: kid words } | { part, intact: true, fails }] } — it must pass as shipped.',
    '- measure (optional): { says (a question), read: { node | flow, stat: "max"|"min"|"end" }, unit, max, resolution } — max a whole number of resolutions.',
    '- notes: what the model leaves out, in plain words. sources: where the numbers come from.',
    '',
    'RULES: no formulas or code anywhere — only these laws and numbers. Every number in real units. Prefer fewer, truer parts. Say in notes where the model and the real thing differ. Output the JSON object only.',
    '',
    'AN EXAMPLE THAT CHECKS OUT:',
    JSON.stringify(tub, null, 2),
  ].join('\n');
}
$('prompt').textContent = authoringPrompt();
$('copyprompt').onclick = async () => {
  try {
    await navigator.clipboard.writeText(authoringPrompt());
    $('copied').textContent = 'Copied.';
  } catch {
    $('copied').textContent = 'Select the text below and copy it.';
  }
};

starters();
renderShelf();
$('source').value = JSON.stringify(LIBRARY_DATA.find((d) => d.id === 'bathtub'), null, 2);
check();
requestAnimationFrame(loop);
