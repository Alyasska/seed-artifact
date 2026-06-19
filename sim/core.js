// THE RULES ENGINE — The Forge v0.2.
//
// Implements the real-life mechanics from docs/GAME-DESIGN.md:
//   - control meter -100..+100, presence-by-pulse capped at ±presenceCap,
//   - class-weighted presence (atk/def), uncontested decay, ±60 flip hysteresis,
//   - economy per minute with per-sector yield cap + Quartermaster bonus + comeback aid,
//   - the 4-phase 90-min arc; strongholds invulnerable until the Siege phase,
//   - Walls + battering + delay-tower gating (the reachable endgame),
//   - HQ order latency (you command intent, not micro).
//
// Same step() runs the live match and the headless Monte Carlo. Seeded → reproducible.

import { makeRng } from "./rng.js";
import { CONST, CLASSES, COMPOSITION, TICKS_PER_MIN, phaseOf } from "./params.js";

export const FACTIONS = ["red", "blue"];
export const enemyOf = (f) => (f === "red" ? "blue" : "red");
const BASE_SPEED = 0.25; // dist/tick before the class multiplier (travel time is real)

export function createState(board, params, seed = 1) {
  const nS = board.sectors.length;
  const owner = new Array(nS).fill(null);
  const meter = new Array(nS).fill(0);
  for (const s of board.strongholds) {
    owner[s.id] = s.faction;
    meter[s.id] = s.faction === "red" ? CONST.meterMax : -CONST.meterMax;
  }

  const squads = [];
  let sid = 0;
  for (const f of FACTIONS) {
    const home = f === "red" ? board.homeRed : board.homeBlue;
    for (let i = 0; i < params.squadCount; i++) {
      const cls = COMPOSITION[i % COMPOSITION.length];
      squads.push({ id: sid++, faction: f, cls, node: home, dest: home, edge: -1, from: -1, to: -1, progress: 0 });
    }
  }

  const wall = {};
  const siegeStreak = {};
  for (const s of board.strongholds) { wall[s.id] = CONST.strongholdWall; siegeStreak[s.id] = 0; }

  const rng = makeRng(seed);
  const edgeJitter = board.edges.map(() => rng() * 0.01); // tie-break paths symmetrically

  return {
    board, params, seed, rng, edgeJitter,
    tick: 0, maxTicks: params.sessionTicks,
    owner, meter, squads,
    wall, siegeStreak,
    resource: { red: 0, blue: 0 },
    score: { red: 0, blue: 0 },
    bridgesBuilt: { red: 0, blue: 0 },
    pendingOrders: [],
    phase: phaseOf(0, params.sessionTicks),
    won: null, winReason: null,
    events: [],
    metrics: { leadChanges: 0, leaderAtMid: null, deadTicks: 0, lastLeader: null, siegeFired: false },
    done: false,
  };
}

// ---- queries -------------------------------------------------------------

function classWeight(cls, isDef) { const c = CLASSES[cls]; return isDef ? c.def : c.atk; }

// weighted presence per faction at a sector (traveling squads don't count)
export function presenceAt(state, i) {
  const owner = state.owner[i];
  const w = { red: 0, blue: 0 };
  const heads = { red: 0, blue: 0 };
  for (const sq of state.squads) {
    if (sq.node !== i) continue;
    w[sq.faction] += classWeight(sq.cls, owner === sq.faction);
    heads[sq.faction]++;
  }
  return { w, heads };
}
export function quartermasterAt(state, i, f) {
  for (const sq of state.squads) if (sq.node === i && sq.faction === f && sq.cls === "quartermaster") return true;
  return false;
}

// bridges live on state (a per-state Set), never mutating the shared board
export function isBridged(state, edgeId) { return state.bridgedSet ? state.bridgedSet.has(edgeId) : false; }
export function edgePassable(state, edgeId) { const e = state.board.edges[edgeId]; return !e.gated || isBridged(state, edgeId); }

export function dijkstra(state, src) {
  const n = state.board.sectors.length;
  const dist = new Array(n).fill(Infinity), prev = new Array(n).fill(-1), vis = new Array(n).fill(false);
  dist[src] = 0;
  for (let it = 0; it < n; it++) {
    let u = -1, best = Infinity;
    for (let i = 0; i < n; i++) if (!vis[i] && dist[i] < best) { best = dist[i]; u = i; }
    if (u === -1) break;
    vis[u] = true;
    for (const { edge, to } of state.board.adjacency[u]) {
      const e = state.board.edges[edge];
      if (e.gated && !isBridged(state, edge)) continue;
      const nd = dist[u] + e.dist + state.edgeJitter[edge];
      if (nd < dist[to]) { dist[to] = nd; prev[to] = u; }
    }
  }
  return { dist, prev };
}
export function nextHop(state, src, dest) {
  if (src === dest) return -1;
  const { dist, prev } = dijkstra(state, src);
  if (dist[dest] === Infinity) return -1;
  let cur = dest;
  while (prev[cur] !== src && prev[cur] !== -1) cur = prev[cur];
  return prev[cur] === src ? cur : -1;
}

// ---- orders & actions ----------------------------------------------------

// HQ issues intent; it reaches the squad after orderLatency ticks (comms cost).
export function issueOrder(state, squadId, destNode) {
  state.pendingOrders.push({ squadId, dest: destNode, eta: state.tick + state.params.orderLatency });
}
export function setDest(state, squadId, destNode) { const sq = state.squads[squadId]; if (sq) sq.dest = destNode; }

export function tryBuildBridge(state, faction, edgeId) {
  const e = state.board.edges[edgeId];
  if (!e || !e.gated || isBridged(state, edgeId)) return false;
  if (state.phase.key < 2) return false; // bridges unlock in Contact phase
  if (state.resource[faction] < state.params.bridgeCost) return false;
  // an Engineer of this faction must be present at a gate endpoint
  const hasEng = state.squads.some((s) => s.faction === faction && s.cls === "engineer" && (s.node === e.a || s.node === e.b));
  if (!hasEng) return false;
  state.resource[faction] -= state.params.bridgeCost;
  if (!state.bridgedSet) state.bridgedSet = new Set();
  state.bridgedSet.add(edgeId);
  state.bridgesBuilt[faction]++;
  state.score[faction] += 5;
  state.events.push({ type: "bridge", faction, edge: edgeId });
  return true;
}

// ---- the tick ------------------------------------------------------------

export function step(state, controllers = null) {
  if (state.done) return state;
  state.events = [];
  const { params, board } = state;
  state.phase = phaseOf(state.tick, state.maxTicks);
  const phase4 = state.phase.key >= 4;

  // 1) deliver due orders
  if (state.pendingOrders.length) {
    const still = [];
    for (const o of state.pendingOrders) {
      if (o.eta <= state.tick) { const sq = state.squads[o.squadId]; if (sq) sq.dest = o.dest; }
      else still.push(o);
    }
    state.pendingOrders = still;
  }

  // 2) decisions (randomized faction order; play is simultaneous)
  if (controllers) {
    const order = state.rng() < 0.5 ? FACTIONS : [...FACTIONS].reverse();
    for (const f of order) { const c = controllers[f]; if (c) c(state, f); }
  }

  // 3) movement — class-weighted travel speed; travel time is real
  for (const sq of state.squads) {
    const spd = BASE_SPEED * CLASSES[sq.cls].speed;
    if (sq.node === null) {
      sq.progress += spd;
      if (sq.progress >= board.edges[sq.edge].dist) { sq.node = sq.to; sq.edge = -1; sq.progress = 0; }
    } else if (sq.dest !== sq.node) {
      const hop = nextHop(state, sq.node, sq.dest);
      if (hop !== -1) { const a = board.adjacency[sq.node].find((x) => x.to === hop); sq.from = sq.node; sq.to = hop; sq.edge = a.edge; sq.node = null; sq.progress = 0; }
    }
  }

  // 4) control resolution. The trailing faction captures harder (comeback aid /
  //    GM tipping the scales) — a rubber-band that actually moves the BOARD,
  //    because score is territory and extra resource alone can't retake ground.
  const behind = state.score.red < state.score.blue ? "red" : state.score.blue < state.score.red ? "blue" : null;
  let anyContested = false, anyCapturing = false, anyFlip = false;
  for (let i = 0; i < board.sectors.length; i++) {
    const sect = board.sectors[i];
    const isStrong = sect.isStronghold;
    const wallDown = isStrong ? state.wall[i] <= 0 : true;
    // strongholds are invulnerable until Siege phase AND Wall down
    if (isStrong && !(phase4 && wallDown)) {
      state.meter[i] = state.owner[i] === "red" ? CONST.meterMax : -CONST.meterMax;
      continue;
    }
    const { w } = presenceAt(state, i);
    if (w.red > 0 && w.blue > 0) anyContested = true;
    let net = w.red - w.blue;
    net = Math.max(-params.presenceCap, Math.min(params.presenceCap, net));
    if (net !== 0) {
      const pusher = net > 0 ? "red" : "blue";
      const aid = pusher === behind ? 1 + params.comebackAid : 1;
      state.meter[i] += net * params.capRate * aid;
      anyCapturing = true;
    } else {
      // uncontested / balanced → drift toward neutral
      if (state.meter[i] > 0) state.meter[i] = Math.max(0, state.meter[i] - params.decay);
      else if (state.meter[i] < 0) state.meter[i] = Math.min(0, state.meter[i] + params.decay);
    }
    state.meter[i] = Math.max(-CONST.meterMax, Math.min(CONST.meterMax, state.meter[i]));
    // ownership flip with hysteresis
    const m = state.meter[i], o = state.owner[i];
    let flipped = null;
    if (m >= CONST.flip && o !== "red") flipped = "red";
    else if (m <= -CONST.flip && o !== "blue") flipped = "blue";
    else if (m > -CONST.flip && m < CONST.flip && o !== null) flipped = null; // stays owned until pushed past flip on other side
    if (flipped) {
      const wasEnemyStrong = isStrong && sect.home === enemyOf(flipped);
      state.owner[i] = flipped; anyFlip = true;
      state.events.push({ type: "capture", faction: flipped, sector: i, stronghold: isStrong });
      if (wasEnemyStrong && !state.won) { state.won = flipped; state.winReason = "siege"; state.score[flipped] += CONST.scoreSiege; }
    }
  }

  // 5) siege pass (Phase 4): delay-tower hold → battering → Wall down
  if (phase4) {
    for (const S of board.strongholds) {
      const attacker = enemyOf(S.faction);
      // delay tower: attacker must hold it continuously
      if (state.owner[S.tower] === attacker) state.siegeStreak[S.id]++;
      else state.siegeStreak[S.id] = 0;
      const canSiege = state.siegeStreak[S.id] >= CONST.delayHoldTicks;
      if (!canSiege || state.wall[S.id] <= 0) continue;
      const { w } = presenceAt(state, S.id);
      const attNet = attacker === "red" ? w.red - w.blue : w.blue - w.red;
      if (attNet > 0 && state.resource[attacker] > 0) {
        const poured = Math.min(state.resource[attacker], 40);
        state.resource[attacker] -= poured;
        state.wall[S.id] -= (poured / 10) * params.batterRate;
        state.metrics.siegeFired = true;
        state.events.push({ type: "batter", faction: attacker, sector: S.id, wall: Math.max(0, state.wall[S.id]) });
      }
    }
  }

  // 6) economy + scoring, once per game-minute
  if (state.tick % TICKS_PER_MIN === 0) {
    for (const f of FACTIONS) {
      let gain = 0, sc = 0;
      for (let i = 0; i < board.sectors.length; i++) {
        if (state.owner[i] !== f) continue;
        const strong = board.sectors[i].isStronghold;
        let y = params.yieldNormal * (strong ? CONST.strongholdYieldMult : board.sectors[i].baseYield);
        if (quartermasterAt(state, i, f)) y *= 1 + CONST.quartermasterBonus;
        gain += y;
        sc += strong ? CONST.scorePerStrongholdMin : CONST.scorePerSectorMin;
      }
      state.resource[f] += gain;
      state.score[f] += sc;
    }
  }

  // 7) metrics + clock
  const leader = state.score.red > state.score.blue ? "red" : state.score.blue > state.score.red ? "blue" : null;
  if (leader && leader !== state.metrics.lastLeader) {
    if (state.metrics.lastLeader !== null) state.metrics.leadChanges++;
    state.metrics.lastLeader = leader;
  }
  if (state.tick === Math.floor(state.maxTicks / 2)) state.metrics.leaderAtMid = leader;
  if (!(anyContested || anyCapturing || anyFlip || state.events.some((e) => e.type === "bridge" || e.type === "batter"))) state.metrics.deadTicks++;

  state.tick++;
  if (state.won || state.tick >= state.maxTicks) state.done = true;
  return state;
}

export function score(state) { return { red: state.score.red, blue: state.score.blue }; }

export function runMatch(board, params, seed, controllers) {
  const state = createState(board, params, seed);
  while (!state.done) step(state, controllers);
  const s = score(state);
  const winner = state.won || (s.red > s.blue ? "red" : s.blue > s.red ? "blue" : "tie");
  return {
    winner, winReason: state.won ? state.winReason : "score",
    score: s, resource: { red: Math.round(state.resource.red), blue: Math.round(state.resource.blue) },
    bridgesBuilt: { ...state.bridgesBuilt }, siegeFired: state.metrics.siegeFired,
    leaderAtMid: state.metrics.leaderAtMid, leadChanges: state.metrics.leadChanges,
    deadTicks: state.metrics.deadTicks, ticks: state.tick,
  };
}
