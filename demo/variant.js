// What the demo needs to know about a level that has been granted into
// (decisions 2026-10-25: the coach arrives §2, the fixture library,
// free items §1). A grant makes a new frozen level — a variant — and
// the UI has to follow it without ever asking the physics to change:
//
//   the cargo ladder grows, in sorted order, so a costume's pictures no
//   longer line up with it index for index — cargoDress() is that map,
//   and a granted creature renders generically (name + blob);
//   an incoming fixture occupies grid points the kid may already have
//   built on — collidingLinks() is who has to move aside.
//
// Pure data work, no DOM: everything here is testable in node, and
// nothing here decides an outcome.

import { linkKey } from '../engine/index.js';

// The cargo ladder's costume map, one entry per mass in level.cargo, in
// the level's own order: { mass, costume, name }. `costume` indexes the
// skin's cargo pictures (a base cargo the archetype and every skin
// agree on); `name` is a granted creature's display-only name, and its
// costume is null — granted cargo renders generically until someone
// authors a picture for it (coach arrives §6).
//
// This reproduces applyGrant's own ordering: it appends the granted
// mass and sorts, and Array.prototype.sort is stable, so a granted
// creature of exactly a base cargo's weight sits after it.
export function cargoDress(level, base) {
  let dress = base.cargo.map((mass, costume) => ({ mass, costume, name: null }));
  for (const { name, mass } of level.grantedCargo ?? []) {
    dress = [...dress, { mass, costume: null, name }].sort((a, b) => a.mass - b.mass);
  }
  return dress;
}

// Where a mass sits on the level's cargo ladder — the closest rung, so
// a grant that grows the ladder leaves the kid looking at the same
// creature rather than whatever index they were on.
export function cargoIndexOf(level, mass) {
  let best = 0;
  for (let i = 1; i < level.cargo.length; i++) {
    if (Math.abs(level.cargo[i] - mass) < Math.abs(level.cargo[best] - mass)) best = i;
  }
  return best;
}

// The world's own members of a built model, by identity: scenery to
// draw as what it is made of, and never the kid's to send home.
export function worldMembers(built) {
  return new Set([...built.worldKeys].map((k) => built.memberOf.get(k)));
}

// Who the lazy colony may send home: not the walkway the cargo crosses
// on, and never the world's own members — a granted branch is scenery
// the kid may be standing on, not a lazy ant of theirs (fixture library
// §4.8).
export function shedRemovable(built, walkway) {
  const world = worldMembers(built);
  return (m) => !walkway.has(m) && !world.has(m);
}

// The kid's links that an incoming fixture's members would sit on top
// of. One link per point pair, whatever it is made of — so these go
// back to the jar before the fixture lands, out loud (fixture library
// §4.7). The world wins the spot; the kid gets the ants back.
export function collidingLinks(bp, members = []) {
  const taken = new Set(members.map((m) => linkKey(m.a, m.b)));
  return bp.links.filter(([p, q]) => taken.has(linkKey(p, q)));
}
