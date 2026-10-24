// The credit line under the game (decisions 2026-10-22 §6: CC BY
// attribution on the level screen). Every imported model once, TASL
// style: its title linked to its page, each license to its deed, the
// library it came through, and the change made to it — a 3D model drawn
// as a picture. Built from text nodes, never markup: a manifest's words
// are data, whoever wrote them.

import { costumeCredits } from '../engine/index.js';

export function writeCredits(el, skin) {
  const doc = el.ownerDocument;
  const link = (text, href) => {
    if (!href) return text;
    const a = doc.createElement('a');
    a.textContent = text;
    a.href = href;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    return a;
  };
  el.replaceChildren(`Costume: ${skin.name} — ${skin.attribution}.`);
  const models = costumeCredits(skin);
  for (const m of models) {
    const line = doc.createElement('span');
    if (m.attribution) line.title = m.attribution; // the library's own words, on hover
    line.append(link(`“${m.title}”`, m.source), ' by ');
    m.people.forEach((p, k) => {
      line.append(`${k > 0 ? '; ' : ''}${p.who}${p.role ? ` (${p.role})` : ''}, `, link(p.license.name, p.license.url));
    });
    line.append(` — via ${m.via}.`);
    el.append(doc.createElement('br'), line);
  }
  if (models.length > 0) el.append(doc.createElement('br'), 'Pictures drawn from the 3D models by the costume portal.');
}
