// Strategy policies — the "captains". Simple, distinct, legible: the point is not
// clever AI but four different strategies so the Monte Carlo can detect whether
// any one is dominant at the current levers.

import { dijkstra, issueOrder, tryBuildBridge, presenceAt, enemyOf, isBridged } from "./core.js";
import { COLS } from "./board.js";

const MID = COLS / 2;
const ownHalf = (sect, f) => (f === "red" ? sect.col < MID : sect.col >= MID);
const homeOf = (state, f) => (f === "red" ? state.board.homeRed : state.board.homeBlue);
const enemyHome = (state, f) => (f === "red" ? state.board.homeBlue : state.board.homeRed);
const EPSILON = 0.18;

const hasPending = (state, id) => state.pendingOrders.some((o) => o.squadId === id);
function idleSquads(state, f) {
  return state.squads.filter((s) => s.faction === f && s.node !== null && s.node === s.dest && !hasPending(state, s.id));
}
function sectorsWhere(state, pred) {
  const out = [];
  for (let i = 0; i < state.board.sectors.length; i++) if (pred(state.board.sectors[i], state.owner[i], i)) out.push(i);
  return out;
}

// keep `reserve` squads home; FLOOD home if it's actually being sieged.
function commandIdle(state, f, reserve) {
  const home = homeOf(state, f);
  const idle = idleSquads(state, f);
  const underSiege = presenceAt(state, home).heads[enemyOf(f)];
  const need = Math.max(reserve, underSiege > 0 ? underSiege + 1 : 0);
  if (need <= 0) return idle;
  const { dist } = dijkstra(state, home);
  idle.sort((a, b) => dist[a.node] - dist[b.node]);
  for (const g of idle.slice(0, need)) issueOrder(state, g.id, home);
  return idle.slice(need);
}

function fanOut(state, f, squads, candidates) {
  if (!candidates.length) return;
  const claimed = new Set();
  for (const sq of squads) {
    const { dist } = dijkstra(state, sq.node);
    const reach = candidates.filter((c) => dist[c] !== Infinity).sort((a, b) => dist[a] - dist[b] || state.rng() - 0.5);
    if (!reach.length) continue;
    const fresh = reach.filter((c) => !claimed.has(c));
    const pool = fresh.length ? fresh : reach;
    const pick = state.rng() < EPSILON ? pool[Math.floor(state.rng() * pool.length)] : pool[0];
    claimed.add(pick);
    issueOrder(state, sq.id, pick);
  }
}

// route an Engineer to a gate and build when present; returns true if managing.
export function manageBridges(state, f) {
  if (state.phase.key < 2) return;
  const gates = state.board.gatedEdges.filter((id) => !isBridged(state, id));
  if (!gates.length) return;
  // build now if an engineer already sits at a gate endpoint
  for (const id of gates) {
    const e = state.board.edges[id];
    if (state.squads.some((s) => s.faction === f && s.cls === "engineer" && (s.node === e.a || s.node === e.b))) {
      if (tryBuildBridge(state, f, id)) return;
    }
  }
  if (state.resource[f] < state.params.bridgeCost * 0.8) return; // don't march until nearly affordable
  const eng = state.squads.find((s) => s.faction === f && s.cls === "engineer" && s.node !== null && !hasPending(state, s.id));
  if (!eng) return;
  const home = homeOf(state, f);
  const { dist } = dijkstra(state, home);
  const target = gates
    .map((id) => state.board.edges[id])
    .map((e) => (dist[e.a] <= dist[e.b] ? e.a : e.b))
    .sort((a, b) => dist[a] - dist[b])[0];
  if (target !== undefined) issueOrder(state, eng.id, target);
}

// Phase-4 siege: take the enemy delay tower, then mass on the stronghold.
function siegePush(state, f, squads) {
  const S = state.board.strongholds.find((s) => s.faction === enemyOf(f));
  if (!S) return false;
  const targets = state.owner[S.tower] === f ? [S.id, S.tower] : [S.tower];
  fanOut(state, f, squads, targets);
  return true;
}

// ---- the four policies ---------------------------------------------------

export function expander(state, f) {
  manageBridges(state, f);
  const idle = commandIdle(state, f, 1);
  if (state.phase.key >= 4) { siegePush(state, f, idle); return; }
  const neutral = sectorsWhere(state, (s, o) => o === null);
  const enemyHeld = sectorsWhere(state, (s, o) => o === enemyOf(f));
  fanOut(state, f, idle, neutral.length ? neutral : enemyHeld.length ? enemyHeld : [enemyHome(state, f)]);
}

export function aggressor(state, f) {
  manageBridges(state, f);
  const idle = commandIdle(state, f, 0);
  if (state.phase.key >= 4) { siegePush(state, f, idle); return; }
  const enemy = enemyOf(f);
  const enemyHeld = sectorsWhere(state, (s, o) => o === enemy);
  const neutral = sectorsWhere(state, (s, o) => o === null);
  const strike = idle.slice(0, Math.max(1, idle.length - 2));
  const grab = idle.slice(strike.length);
  fanOut(state, f, strike, enemyHeld.length ? enemyHeld : [enemyHome(state, f)]);
  fanOut(state, f, grab, neutral.length ? neutral : enemyHeld);
}

export function bridger(state, f) {
  manageBridges(state, f);
  const idle = commandIdle(state, f, 1);
  if (state.phase.key >= 4) { siegePush(state, f, idle); return; }
  const half = Math.ceil(idle.length / 2);
  const economy = idle.slice(0, half), flank = idle.slice(half);
  const ownNeutral = sectorsWhere(state, (s, o) => o === null && ownHalf(s, f));
  const anyNeutral = sectorsWhere(state, (s, o) => o === null);
  fanOut(state, f, economy, ownNeutral.length ? ownNeutral : anyNeutral);
  const enemySide = sectorsWhere(state, (s, o) => !ownHalf(s, f) && (o === null || o === enemyOf(f)));
  fanOut(state, f, flank, enemySide.length ? enemySide : [enemyHome(state, f)]);
}

export function turtle(state, f) {
  const idle = commandIdle(state, f, 2);
  if (state.phase.key >= 4) { siegePush(state, f, idle); return; } // must attack to win late
  const enemy = enemyOf(f);
  const intruders = sectorsWhere(state, (s, o) => ownHalf(s, f) && o === enemy);
  const ownNeutral = sectorsWhere(state, (s, o) => ownHalf(s, f) && o === null);
  const targets = intruders.length ? intruders : ownNeutral.length ? ownNeutral : [homeOf(state, f)];
  fanOut(state, f, idle, targets);
}

export const POLICIES = { expander, aggressor, bridger, turtle };
export const POLICY_NAMES = Object.keys(POLICIES);
