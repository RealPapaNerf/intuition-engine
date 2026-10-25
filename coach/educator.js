// The educator's window (decisions 2026-10-25 §5): where the adult-only
// packet finally goes. The demo posts each kid's journal entries; the
// educator's page reads attempts and flags. Nothing new is detected here
// — the flags are exactly engine/journal.js's fingerprint / recommend /
// adultFlag, which the kid never sees (2026-10-19 §8).
//
// Entries are validated the only way that matters: replayed through
// record() into a real journal, so a malformed entry is refused at the
// door and every stat downstream is computed from a journal the engine
// itself accepted. Persistence is a JSONL file per store directory —
// kitchen-table grade, loaded on start, appended per entry. No auth yet:
// REVISIT before any classroom.

import { appendFileSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  makeJournal,
  record,
  calibration,
  trustCalibration,
  fingerprint,
  recommend,
  adultFlag,
  needsDebrief,
} from '../engine/journal.js';

const KID = /^[\p{L}\p{N}][\p{L}\p{N} '_-]{0,39}$/u;

export function makeEducatorLog({ dir = null } = {}) {
  const journals = new Map(); // kid → journal
  // How many consecutive looks the same signal has persisted, feeding
  // the response ladder's escalation (2026-10-19 §6).
  const persistence = new Map(); // kid → { signal, count }
  const file = dir ? join(dir, 'log.jsonl') : null;

  function journalOf(kid) {
    if (!journals.has(kid)) journals.set(kid, makeJournal());
    return journals.get(kid);
  }

  function checkKid(kid) {
    if (typeof kid !== 'string' || !KID.test(kid)) throw new Error('bad kid name');
  }

  function accept(kid, entry, { persist = true } = {}) {
    checkKid(kid);
    record(journalOf(kid), entry); // throws on a malformed entry
    if (persist && file) {
      mkdirSync(dir, { recursive: true }); // lazily: only a store that logs makes a dir
      appendFileSync(file, `${JSON.stringify({ kid, entry })}\n`);
    }
  }

  if (file) {
    let lines = [];
    try {
      lines = readFileSync(file, 'utf8').split('\n').filter(Boolean);
    } catch {
      /* first run: no log yet */
    }
    for (const line of lines) {
      try {
        const { kid, entry } = JSON.parse(line);
        accept(kid, entry, { persist: false });
      } catch {
        /* a bad line is skipped, never fatal */
      }
    }
  }

  // Record a batch; returns how many were accepted and why the rest
  // weren't. A bad entry never sinks the batch.
  function log(kid, entries) {
    checkKid(kid); // a bad name refuses the batch, not entry by entry
    let accepted = 0;
    const refused = [];
    for (const entry of Array.isArray(entries) ? entries : []) {
      try {
        accept(kid, entry);
        accepted++;
      } catch (e) {
        refused.push(e.message);
      }
    }
    return { accepted, refused };
  }

  function kids() {
    return [...journals.keys()];
  }

  // The adult-only view of one kid: the attempts and the flag with its
  // evidence attached. The signal's persistence is tracked across looks
  // so the response ladder can escalate only while it lasts.
  function flags(kid) {
    const j = journalOf(kid);
    const signal = fingerprint(j);
    const p = persistence.get(kid);
    let count = 0;
    if (signal !== null) {
      // Escalate only when the kid has played since the last look —
      // polling the page is not persistence.
      if (p?.signal === signal) count = p.count + (j.entries.length > p.seen ? 1 : 0);
      else count = 1;
    }
    persistence.set(kid, { signal, count, seen: j.entries.length });
    return {
      kid,
      entries: j.entries.length,
      alert: signal !== null,
      signal,
      recommendation: signal !== null ? recommend(j, { persistence: count }) : null,
      needsDebrief: needsDebrief(j),
      flag: adultFlag(j),
      calibration: calibration(j),
      trust: trustCalibration(j),
    };
  }

  function allFlags() {
    return kids().map((kid) => flags(kid));
  }

  function attempts(kid, n = 50) {
    return journalOf(kid).entries.slice(-n);
  }

  return { log, kids, flags, allFlags, attempts };
}
