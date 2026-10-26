// The words of Pull It Apart: what the kid did, what happened, and what
// the Consultant claims, said back in the system's own names. Pure, so
// test/apart-words.test.js can hold it to the page's rules: the cascade
// says what the solver found and nothing it didn't; the questions after
// a surprise ask, and never tell; nothing adult-only is ever said here.

import { instanceOf, partName, jobOf } from '../systems/index.js';

const nodeName = (system, id) => {
  const base = system.nodes.find((n) => n.id === id.replace(/#\d+$/, ''));
  if (base) return id === base.id ? base.name : `${base.name} (${id.split('#')[1]})`;
  return 'the join between two parts'; // a junction a move made
};
const levelUnit = (system, nodeId) => {
  const base = system.nodes.find((n) => n.id === nodeId.replace(/#\d+$/, ''));
  return base ? system.substances.find((s) => s.id === base.substance).level : '';
};
const flowOf = (system, flowId) => {
  const id = flowId.replace(/#\d+$/, '');
  for (const p of system.parts) {
    const f = p.flows.find((x) => x.id === id);
    if (f) return { part: p, flow: f };
  }
  return null;
};

// A reading on its instrument's grid: as many decimals as the step has.
export function onScale(v, resolution, unit = '') {
  if (!Number.isFinite(v)) return '—';
  const decimals = Math.max(0, -Math.floor(Math.log10(resolution) + 1e-9));
  const s = v.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return unit ? `${s} ${unit}` : s;
}

export function num(v, unit = '') {
  if (!Number.isFinite(v)) return '—';
  const a = Math.abs(v);
  const s = a >= 1000 ? Math.round(v).toLocaleString('en-US') : a >= 100 ? v.toFixed(0) : a >= 10 ? v.toFixed(1) : a >= 1 ? v.toFixed(2) : a === 0 ? '0' : v.toPrecision(2);
  return unit ? `${s} ${unit}` : s;
}

// Model time, in the system's unit, with days spelled out once hours
// get long.
export function timeWords(t, unit) {
  const n = Number(t.toFixed(t < 10 ? 1 : 0));
  if (unit === 'h' && t >= 48) return `${n} h (day ${Math.floor(t / 24) + 1})`;
  if (unit === 'min' && t >= 120) return `${n} min (${(t / 60).toFixed(1)} h)`;
  return `${n} ${unit}`;
}

// What a flow does, in a phrase: what moves, from where, to where.
export function flowWords(system, flowId) {
  const hit = flowOf(system, flowId);
  if (!hit) return flowId;
  const { flow } = hit;
  if (flow.law === 'react') {
    const ins = Object.keys(flow.inputs).map((n) => nodeName(system, n));
    const outs = Object.keys(flow.outputs).map((n) => nodeName(system, n));
    if (!ins.length) return `making ${outs.join(' and ')}`;
    if (!outs.length) return `using up ${ins.join(' and ')}`;
    return `${ins.join(' and ')} → ${outs.join(' and ')}`;
  }
  return `${nodeName(system, flow.from)} → ${nodeName(system, flow.to)}`;
}

// One change on the bench, said back.
export function changeWords(system, c) {
  if (c.blocked) return `⛔ You blocked ${partName(system, c.part)}: ${flowWords(system, c.flow)}.`;
  const { part } = instanceOf(system, c.part);
  const name = partName(system, c.part);
  if (c.as === 'out') return `You took out ${name}.`;
  const fault = c.as === 'bad' ? part.faults.find((f) => f.id === c.fault) : null;
  const where = c.at ? ` ${c.at.how === 'beside' ? 'beside' : 'in line with'} ${partName(system, c.at.part)}` : '';
  if (fault) return `You put in ${fault.name}${where}.`;
  if (c.copy) return `You added another ${part.name}${where || ''}.`;
  if (c.at) return `You moved ${name}${where}.`;
  if (c.broken) return `${name} is broken from last time.`;
  return `You put ${name} in.`;
}

const why = (system, w) => {
  if (!w) return '';
  if (w.missing) return `it needs ${instanceOf(system, w.missing).part.name}`;
  if (w.gone) return `${nodeName(system, w.gone)} is gone`;
  if (w.low) return `${nodeName(system, w.low)} got too low (under ${num(w.atLeast, levelUnit(system, w.low))})`;
  if (w.high) return `${nodeName(system, w.high)} got too high (over ${num(w.atMost, levelUnit(system, w.high))})`;
  if (w.dry) return `${nodeName(system, w.dry)} ran out`;
  if (w.idle) return w.idle === true ? 'it had nothing to work on' : `there was no ${nodeName(system, w.idle)} to work on`;
  if (w.open) return 'nothing could get through any more';
  if (w.slow) return 'it slowed almost to nothing';
  return '';
};

// A line of the cascade, from the solver's event: when, what, and the
// reason it found. Changes the kid made are said by changeWords.
export function eventWords(system, e) {
  const at = `At ${timeWords(e.t, system.time.unit)}:`;
  if (e.kind === 'stopped') return `${at} ${partName(system, e.part)} stopped — ${why(system, e.why)}.`;
  if (e.kind === 'broke') {
    const r = e.rating;
    if (r.flow) return `${at} 💥 ${partName(system, e.part)} broke: too much through it (${num(e.value, flowUnit(system, r.flow))}; it can take ${num(r.above, flowUnit(system, r.flow))}).`;
    const over = r.above !== null && e.value > r.above;
    return `${at} 💥 ${partName(system, e.part)} broke: ${nodeName(system, r.node)} went ${over ? 'past' : 'under'} ${num(over ? r.above : r.below, levelUnit(system, r.node))}.`;
  }
  if (e.kind === 'goal') return `${at} ${system.goal.checks[e.check].fails}`;
  return '';
}

export function flowUnit(system, flowId) {
  const hit = flowOf(system, flowId);
  if (!hit) return '';
  const node = hit.flow.law === 'react' ? Object.keys(hit.flow.outputs)[0] ?? Object.keys(hit.flow.inputs)[0] : hit.flow.from;
  const base = system.nodes.find((n) => n.id === node);
  return system.substances.find((s) => s.id === base.substance).flow;
}

// What actually happened, for the question that was asked.
export function truthWords(system, question, truth) {
  switch (question.type) {
    case 'direction': {
      const unit = question.about.node !== undefined ? levelUnit(system, question.about.node) : flowUnit(system, question.about.flow);
      const said = { up: 'went up', down: 'went down', same: 'stayed about the same' }[truth.value];
      return `It ${said}: ${num(truth.before, unit)} before, ${num(truth.after, unit)} after.`;
    }
    case 'first':
      return truth.value === 'nothing' ? 'Nothing else stopped.' : `First to stop: ${truth.set.map((id) => partName(system, id)).join(' and ')}.`;
    case 'keeps':
      return truth.value === 'yes' ? `${partName(system, question.about.part)} kept working.` : `${partName(system, question.about.part)} stopped.`;
    case 'job':
      return `What ${partName(system, question.about.part)} does: it ${truth.job}.`;
    case 'reading':
      return truth.maxed ? `More than the scale goes: past ${onScale(question.max, question.resolution, question.unit)}.` : `It was ${onScale(truth.value, question.resolution, question.unit)}.`;
    case 'when':
      return truth.maxed ? 'It never stopped doing its job.' : `It stopped doing its job at about ${timeWords(truth.value, system.time.unit)}.`;
    default:
      return truth.value === 'works' ? `It still works: ${system.goal.says}` : 'It stopped doing its job.';
  }
}

// What the Consultant claims, in its own confident voice. No tells: the
// wrong ones read exactly like the right ones (decisions 2026-10-19 §2).
export function claimWords(system, question, advice) {
  if (!advice) return '';
  const say = (s) => `🤖 The Consultant says: “${s}”`;
  if (question.type === 'works') return say(advice.claim === 'works' ? 'It will still do its job.' : 'It will stop doing its job.');
  if (question.type === 'direction') {
    const what = question.asks.replace(/^What happens to /, '').replace(/: more, less, or about the same\?$/, '');
    return say({ up: `${cap(what)} will go up.`, down: `${cap(what)} will go down.`, same: `${cap(what)} will stay about the same.` }[advice.claim]);
  }
  return say(`About ${onScale(advice.claim, question.resolution, question.unit)}.`);
}
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// The postmortem's choices: the kinds of wrong this question can carry,
// and "it was right". Choosing between real possibilities is the lesson.
const KINDS = {
  works: [
    ['ignored-spare', 'It forgot a spare was doing the same job'],
    ['buffer-forever', 'It forgot that what was stored would run out (or fill up)'],
    ['confident-nonsense', 'Sure of itself, and just wrong'],
  ],
  direction: [
    ['wrong-direction', 'It had the direction backwards'],
    ['no-effect', 'It said nothing would change, but that part is wired right to it'],
    ['ignored-spare', 'It forgot a spare was doing the same job'],
    ['confident-nonsense', 'Sure of itself, and just wrong'],
  ],
  reading: [
    ['magnitude', 'Ten times too big'],
    ['unit-slip', 'Ten times too small'],
    ['no-way-out', 'It said it settles, but nothing takes it out any more'],
    ['limiting-case', 'A number for something that can make none'],
  ],
};
export function wrongKinds(question) {
  return [...(KINDS[question.type] ?? []).map(([id, label]) => ({ id, label })), { id: 'none', label: 'It was right' }];
}

// After a surprise, the explain step (predict, observe, explain): a
// question, and the kinds of reason a system gives — never this one's
// answer. Free to skip; what the kid says goes to the grown-up.
export const EXPLAIN_QUESTION = 'That surprised you. Why do you think it happened?';
export const EXPLAIN_CHOICES = Object.freeze([
  { icon: '🔗', label: 'something it needed was gone', said: 'Something it needed was gone.' },
  { icon: '⏳', label: 'something ran out, or filled up', said: 'Something ran out or filled up.' },
  { icon: '👯', label: 'there was a spare', said: 'There was a spare doing the same job.' },
  { icon: '🌊', label: 'too much of something', said: 'There was too much of something.' },
  { icon: '🔁', label: 'something kept it steady', said: 'Something kept it steady.' },
  { icon: '🤷', label: 'not sure', said: "I don't know why." },
]);

// The debrief's answers for a system (decisions 2026-10-25, the debrief
// §5): what changed between a fix that failed and one that held, or what
// an experiment was for. "Not sure" is always there, and costs nothing.
export const DEBRIEF_RESOLVED = Object.freeze([
  { icon: '🔧', label: 'replaced what broke', said: 'I replaced the part that broke.' },
  { icon: '🎯', label: 'fixed what caused it', said: 'I fixed what was causing it.' },
  { icon: '↩️', label: 'put back what I took out', said: 'I put back a part I took out.' },
  { icon: '👯', label: 'added a spare', said: 'I added a spare.' },
  { icon: '🤷', label: 'not sure', said: "I don't know what was different." },
]);
export const DEBRIEF_FOR = Object.freeze([
  { icon: '🔍', label: 'what that part does', said: 'I wanted to find out what that part does.' },
  { icon: '👯', label: 'what two of them do', said: 'I wanted to find out what two of them do.' },
  { icon: '⛔', label: 'what blocking it does', said: 'I wanted to find out what blocking it does.' },
  { icon: '🧪', label: 'just trying it', said: 'I was just trying something out.' },
  { icon: '🤷', label: 'not sure', said: "I don't know what I was trying to find out." },
]);
export const debriefChoicesFor = (kind) => (kind === 'resolved' ? DEBRIEF_RESOLVED : DEBRIEF_FOR);

// A part's card, said: what it is, and what it is wired to — structure
// and behavior. Its job is not on the card: that is what pulling it out
// is for (a question asks it, and the run shows it).
export function partWords(system, wiringOf, id) {
  const { part } = instanceOf(system, id);
  const lines = [];
  for (const f of wiringOf.flows.filter((x) => x.part === id)) {
    if (f.passive) lines.push(`${nodeName(system, f.from)} → ${nodeName(system, f.to)}`);
    else {
      const ins = f.inputs.map(([n]) => nodeName(system, n));
      const outs = f.outputs.map(([n]) => nodeName(system, n));
      lines.push(ins.length && outs.length ? `${ins.join(' + ')} → ${outs.join(' + ')}` : ins.length ? `uses ${ins.join(' + ')}` : `→ ${outs.join(' + ')}`);
    }
  }
  if (part.holds.length) lines.push(`holds ${part.holds.map((n) => nodeName(system, n)).join(' and ')}`);
  return { says: part.says, wired: lines };
}

export { jobOf };
