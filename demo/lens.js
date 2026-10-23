// The Lens: negotiation practice with a question-only coach in the eye
// line (decisions 2026-10-22, the lens).
//
// Three phases. Prep: read your own brief, commit three calls about the
// other side (the predict gate), and they get pinned in the lens. Talk:
// the scripted counterpart (negotiation/counterpart.js) plays her hidden
// brief; every offer needs a reaction call first; the lens shows your
// notes and the coach's next question, and never the trust meter. Reveal:
// her brief, the deal judged against the Pareto frontier, the trust
// replay with the line where it turned, and your calls scored into the
// same journal as the bridge. Nothing in this file decides an outcome.

import {
  OFFER_LETTER as BRIEF,
  makeCounterpart,
  respond,
  remember,
  reactionClass,
  describeDeal,
  judgeDeal,
  points,
  priorities,
  party,
  turningPoint,
  commitPrep,
  scorePrep,
  reactionEntry,
  cue,
  pinnedNotes,
} from '../negotiation/index.js';
import { makeJournal, record, calibration } from '../engine/journal.js';

const $ = (id) => document.getElementById(id);
const ME = BRIEF.user;
const THEM = BRIEF.counterpart;
const them = party(BRIEF, THEM);
const me = party(BRIEF, ME);
const issue = (id) => BRIEF.issues.find((i) => i.id === id);
const names = {
  issue: (id) => issue(id).name,
  value: (v) => `$${v}k`,
  worry: (id) => BRIEF.worries.find((w) => w.id === id).text,
};

// --- Storage: per-viewer conveniences, wrapped; fine without them -------
const journal = makeJournal();
let memory = null;
try {
  const saved = JSON.parse(localStorage.getItem('lens-journal'));
  if (Array.isArray(saved)) for (const e of saved.slice(-200)) record(journal, e);
  memory = JSON.parse(localStorage.getItem('lens-memory'));
} catch {
  /* fresh */
}
function save() {
  try {
    localStorage.setItem('lens-journal', JSON.stringify(journal.entries.slice(-200)));
    localStorage.setItem('lens-memory', JSON.stringify(memory));
  } catch {
    /* fine */
  }
}

let prep = null;
let state = null;
let ranking = BRIEF.issues.map((i) => i.id);
let coachLine = '';
let turnCount = 0;

// --- The lens -----------------------------------------------------------
function drawLens(phase) {
  const notes = pinnedNotes(prep, names);
  $('lensPrep').innerHTML = notes.length
    ? notes.map((n) => `<div>${esc(n)}</div>`).join('')
    : '<div>— commit your read of Priya —</div><div>before you walk in</div>';
  $('lensCoach').textContent = coachLine;
  const c = calibration(journal);
  $('lensStatus').textContent = c.total ? `calls ${c.hits}/${c.total} · streak ${c.streak}` : 'calls —';
  $('lensPhase').textContent = phase;
}
function coach(moment) {
  coachLine = cue(moment, turnCount);
}
const esc = (s) => s.replace(/[&<>]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[ch]);

// --- Prep ---------------------------------------------------------------
function renderPrep() {
  $('title').textContent = BRIEF.title;
  const pts = BRIEF.issues
    .map((i) => `<tr><th>${i.name}</th><td>${i.options.map((o, k) => `${o} <b>${i.points[ME][k]}</b>`).join(' · ')}</td></tr>`)
    .join('');
  $('yourBrief').innerHTML =
    `<strong>Your brief (confidential)</strong>` +
    me.brief.map((p) => `<p>${esc(p)}</p>`).join('') +
    `<table><tr><th>Issue</th><th>Options and your points</th></tr>${pts}</table>` +
    `<p class="muted">Your walk-away: <b>${me.reservation}</b> points. Priya's sheet is hers; you will see it at the end.</p>`;
  renderRank();
  const vals = issue(BRIEF.headline).values;
  for (const id of ['wallLo', 'wallHi']) {
    $(id).innerHTML = vals.map((v) => `<option value="${v}">${names.value(v)}</option>`).join('');
  }
  $('wallLo').value = vals[0];
  $('wallHi').value = vals[vals.length - 1];
  $('worries').innerHTML = BRIEF.worries
    .map((w) => `<label style="display:block;margin:3px 0"><input type="radio" name="worry" value="${w.id}" /> ${esc(w.text)}</label>`)
    .join('');
}
function renderRank() {
  $('rank').innerHTML = ranking
    .map(
      (id, k) =>
        `<li><span class="pill">${k + 1}</span> <span style="min-width:120px">${names.issue(id)}</span>` +
        `<button data-up="${k}" ${k === 0 ? 'disabled' : ''}>▲</button><button data-down="${k}" ${k === ranking.length - 1 ? 'disabled' : ''}>▼</button></li>`,
    )
    .join('');
}
$('rank').addEventListener('click', (e) => {
  const up = e.target.dataset.up;
  const down = e.target.dataset.down;
  if (up != null) swap(Number(up), Number(up) - 1);
  if (down != null) swap(Number(down), Number(down) + 1);
});
function swap(a, b) {
  [ranking[a], ranking[b]] = [ranking[b], ranking[a]];
  renderRank();
}
$('commit').addEventListener('click', () => {
  const worry = document.querySelector('input[name=worry]:checked')?.value;
  try {
    if (!worry) throw new Error('pick what she is worried about');
    prep = commitPrep(BRIEF, THEM, {
      ranking,
      walkAway: { lo: Number($('wallLo').value), hi: Number($('wallHi').value) },
      worry,
    });
  } catch (err) {
    $('prepErr').textContent = err.message.replace(/^.*?: /, '');
    return;
  }
  $('prepErr').textContent = '';
  startTalk();
});

// --- Talk ---------------------------------------------------------------
function startTalk() {
  state = makeCounterpart(BRIEF, { memory });
  turnCount = 0;
  $('prep').classList.add('hidden');
  $('reveal').classList.add('hidden');
  $('talk').classList.remove('hidden');
  $('labelPick').innerHTML = BRIEF.worries.map((w) => `<option value="${w.id}">${esc(w.text)}</option>`).join('');
  $('questionPick').innerHTML = BRIEF.questions.map((q, k) => `<option value="${k}">${esc(q)}</option>`).join('');
  $('offer').innerHTML = BRIEF.issues
    .map((i) => `<label>${i.name} <select data-issue="${i.id}">${i.options.map((o, k) => `<option value="${k}">${o}</option>`).join('')}</select></label>`)
    .join('');
  for (const sel of $('offer').querySelectorAll('select')) {
    sel.addEventListener('change', () => {
      coach({ move: 'beforeOffer' });
      drawLens('talking');
    });
  }
  coach({ move: 'open' });
  renderTranscript();
  drawLens('talking');
}

function renderTranscript() {
  const box = $('transcript');
  box.innerHTML = state.transcript
    .map((t) => `<div class="line ${t.who === ME ? 'you' : 'them'}"><span class="who">${t.who === ME ? 'You' : them.name}</span>${esc(t.text)}</div>`)
    .join('');
  box.scrollTop = box.scrollHeight;
  $('takeIt').disabled = !state.counter || Boolean(state.done);
  $('talkErr').textContent = '';
}

function act(move, { predicted = null } = {}) {
  let r;
  try {
    r = respond(BRIEF, state, move);
  } catch (err) {
    $('talkErr').textContent = err.message;
    return;
  }
  state = r.state;
  turnCount++;
  if (predicted) {
    record(journal, reactionEntry(BRIEF, predicted, reactionClass(r.reply.reaction), { impasse: state.done === 'walked' }));
    save();
  }
  coach({ move: move.kind, reaction: r.reply.reaction });
  renderTranscript();
  drawLens('talking');
  if (state.done) setTimeout(reveal, 900);
}

$('mirror').addEventListener('click', () => act({ kind: 'mirror' }));
$('label').addEventListener('click', () => act({ kind: 'label', worry: $('labelPick').value }));
$('question').addEventListener('click', () => act({ kind: 'question', text: BRIEF.questions[Number($('questionPick').value)] }));
$('audit').addEventListener('click', () => act({ kind: 'audit' }));
$('pitch').addEventListener('click', () => act({ kind: 'pitch' }));
$('silence').addEventListener('click', () => act({ kind: 'silence' }));
$('pressure').addEventListener('click', () => act({ kind: 'pressure' }));
$('takeIt').addEventListener('click', () => act({ kind: 'accept' }));
$('walk').addEventListener('click', () => act({ kind: 'walk' }));

function readOffer() {
  const deal = {};
  for (const sel of $('offer').querySelectorAll('select')) deal[sel.dataset.issue] = Number(sel.value);
  return deal;
}
function sendOffer(kind) {
  const predicted = document.querySelector('input[name=react]:checked')?.value;
  if (!predicted) {
    $('talkErr').textContent = 'Say how she will react first. Nothing is said until you have.';
    return;
  }
  for (const r of document.querySelectorAll('input[name=react]')) r.checked = false;
  act({ kind, deal: readOffer() }, { predicted });
}
$('sendOffer').addEventListener('click', () => sendOffer('offer'));
$('sendUltimatum').addEventListener('click', () => sendOffer('ultimatum'));

// --- Reveal -------------------------------------------------------------
function reveal() {
  $('talk').classList.add('hidden');
  $('reveal').classList.remove('hidden');
  memory = remember(state);
  const impasse = state.done === 'walked';
  const scored = scorePrep(BRIEF, prep, { impasse });
  for (const e of scored.entries) record(journal, e);
  save();
  coach({ move: impasse ? 'walked' : 'closed' });
  drawLens('replay');

  const pill = (ok, yes, no) => `<span class="pill ${ok ? 'good' : 'bad'}">${ok ? yes : no}</span>`;
  if (impasse) {
    $('outcome').textContent = 'No deal.';
    $('dealJudge').innerHTML = `<p>You walk back to the other offer: about <b>${me.reservation}</b> points to you, and Priya's seat stays open.</p>`;
  } else {
    const j = judgeDeal(BRIEF, state.deal);
    $('outcome').textContent = state.done === 'accepted' ? 'She said yes.' : 'You took her offer.';
    const left = j.moneyOnTheTable;
    $('dealJudge').innerHTML =
      `<p><b>${esc(describeDeal(BRIEF, state.deal))}</b></p>` +
      `<p>You: <b>${j.points[ME]}</b> (walk-away ${me.reservation}) ${pill(j.aboveReservation[ME], 'above your line', 'under your own walk-away')} · ` +
      `Priya: <b>${j.points[THEM]}</b> (walk-away ${them.reservation}) ${pill(j.aboveReservation[THEM], 'above hers', 'under hers')}</p>` +
      `<p>Joint value <b>${j.joint}</b> of a possible <b>${j.maxJoint}</b> (${Math.round(j.efficiency * 100)}%). ` +
      (j.onFrontier
        ? pill(true, 'on the frontier: nothing left on the table', '')
        : `${pill(false, '', 'money on the table')} — <i>${esc(describeDeal(BRIEF, left))}</i> would have been no worse for either of you and better for ${
            points(BRIEF, ME, left) > j.points[ME] && points(BRIEF, THEM, left) > j.points[THEM] ? 'both' : points(BRIEF, ME, left) > j.points[ME] ? 'you' : 'her'
          }.`) +
      `</p>` +
      `<p>${state.labeled ? pill(true, '“That’s right.” You named what she was actually afraid of.', '') : pill(false, '', 'She never said “that’s right”: her real worry stayed hidden.')}</p>`;
  }

  const actual = priorities(BRIEF, THEM);
  $('theirBrief').innerHTML =
    `<p><b>Position:</b> ${esc(them.position)}</p><p><b>Interest:</b> ${esc(them.interest)}</p><p><b>Fear:</b> ${esc(them.fear)}</p>` +
    them.brief.map((p) => `<p class="muted">${esc(p)}</p>`).join('') +
    `<table><tr><th>Issue</th><th>Options and her points</th></tr>` +
    BRIEF.issues
      .map((i) => `<tr><th>${i.name}</th><td>${i.options.map((o, k) => `${o} <b>${i.points[THEM][k]}</b>${i.cap?.[THEM] === k ? ' (cap)' : ''}`).join(' · ')}</td></tr>`)
      .join('') +
    `</table><p class="muted">Her walk-away: <b>${them.reservation}</b>. Her priorities, by how much each issue could swing: ${actual.map(names.issue).join(' › ')}.</p>`;

  drawTrace();

  const r = scored.ranking;
  const okRank = r.footrule === 0;
  $('calls').innerHTML =
    `<p>${pill(r.predicted[0] === r.actual[0], 'Top priority: called it', 'Top priority: missed')} you said <b>${names.issue(r.predicted[0])}</b>; it was <b>${names.issue(r.actual[0])}</b>. ` +
    `Your order was ${okRank ? 'exact' : `off by ${r.footrule} place${r.footrule === 1 ? '' : 's'} in total`}.</p>` +
    `<p>${pill(scored.wall.hit, 'Her wall: inside your band', 'Her wall: outside your band')} you said ${names.value(scored.wall.predicted.lo)}–${names.value(scored.wall.predicted.hi)}; it is ${names.value(scored.wall.actual)}.</p>` +
    `<p>${pill(scored.worry.hit, 'Her worry: called it', 'Her worry: missed')} you said “${esc(names.worry(scored.worry.predicted))}”.</p>` +
    reactionSummary() +
    `<p class="muted">Calibration across everything you have called here: ${(() => {
      const c = calibration(journal);
      return `${c.hits}/${c.total}, streak ${c.streak}`;
    })()}.</p>`;
}

function reactionSummary() {
  const mine = journal.entries.filter((e) => e.about === 'reaction').slice(-state.offers);
  if (!mine.length) return '<p class="muted">You made no offers, so no reaction calls to score.</p>';
  const hits = mine.filter((e) => e.prediction === e.outcome).length;
  return `<p>${hits === mine.length ? '<span class="pill good">Every reaction called</span>' : `<span class="pill">Reactions: ${hits}/${mine.length}</span>`} ${mine
    .map((e) => `${e.prediction}→${e.outcome}`)
    .join(', ')}.</p>`;
}

function drawTrace() {
  const c = $('trace');
  const ctx = c.getContext('2d');
  const t = state.meter.trace;
  const W = c.width;
  const H = c.height;
  ctx.clearRect(0, 0, W, H);
  const lo = Math.min(-3, ...t.map((p) => p.trust));
  const hi = Math.max(7, ...t.map((p) => p.trust));
  const x = (i) => 30 + (i * (W - 50)) / Math.max(1, t.length - 1);
  const y = (v) => H - 20 - ((v - lo) * (H - 40)) / (hi - lo);
  ctx.strokeStyle = '#b8ab8f';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(30, y(0));
  ctx.lineTo(W - 20, y(0));
  ctx.stroke();
  ctx.fillStyle = '#6b6354';
  ctx.font = '11px system-ui';
  ctx.fillText('0', 14, y(0) + 4);
  ctx.strokeStyle = '#2b2620';
  ctx.lineWidth = 2;
  ctx.beginPath();
  t.forEach((p, i) => (i ? ctx.lineTo(x(i), y(p.trust)) : ctx.moveTo(x(i), y(p.trust))));
  ctx.stroke();
  const tp = turningPoint(state.meter);
  t.forEach((p, i) => {
    ctx.fillStyle = tp && tp.turn === p.turn && i ? '#c0392b' : '#2b2620';
    ctx.beginPath();
    ctx.arc(x(i), y(p.trust), tp && tp.turn === p.turn && i ? 6 : 3, 0, Math.PI * 2);
    ctx.fill();
    if (i && p.delta) {
      ctx.fillStyle = '#6b6354';
      ctx.fillText(p.why, Math.min(x(i) - 18, W - 24 - ctx.measureText(p.why).width), y(p.trust) + (p.delta > 0 ? -10 : 16));
    }
  });
  $('turning').textContent = tp
    ? `The line where it turned: turn ${tp.turn}, ${tp.why} (${tp.delta > 0 ? '+' : ''}${tp.delta}). The meter is shown only here, never while you talk.`
    : 'The meter never moved.';
}

$('again').addEventListener('click', () => {
  prep = null;
  state = null;
  coachLine = '';
  $('reveal').classList.add('hidden');
  $('prep').classList.remove('hidden');
  renderPrep();
  drawLens('prep');
});

renderPrep();
drawLens('prep');
