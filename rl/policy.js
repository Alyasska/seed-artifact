// A parameterized, learnable policy — the "smart playtester".
//
// Same controller(state, faction) interface as the hand-written bots, but instead
// of fixed rules it scores every candidate target sector for each idle squad with
// a linear value head over hand-built features, and sends the squad to the argmax.
// The weight vector (genome) is what self-play optimizes (rl/selfplay.mjs).
//
// This is the lightweight stand-in for a PPO policy: same idea (a parameterized
// policy improved against opponents), tractable without a GPU. The gymnasium /
// PPO skeleton for the full version is rl/forge_env.py.

import { dijkstra, issueOrder, enemyOf } from "../sim/core.js";
import { manageBridges } from "../sim/bots.js";

export const FEATURES = [
  "proximity",        // closer is cheaper to reach
  "neutral",          // unclaimed ground
  "enemyOwned",       // take from the enemy
  "ownOwned",         // reinforce / hold
  "enemyStronghold",  // the win condition
  "siegeTowerP4",     // enemy delay tower, in the Siege phase
  "contested",        // a fight is happening here
  "homeProximity",    // stay near home (defense)
  "isTower",          // delay towers matter
];
export const DIM = FEATURES.length;

const hasPending = (state, id) => state.pendingOrders.some((o) => o.squadId === id);

export function makePolicy(genome) {
  return function policy(state, f) {
    manageBridges(state, f); // learned policy still uses the bridge subsystem
    const enemy = enemyOf(f);
    const home = f === "red" ? state.board.homeRed : state.board.homeBlue;
    const eStrong = state.board.strongholds.find((s) => s.faction === enemy);
    const phase4 = state.phase.key >= 4;
    const N = state.board.sectors.length;

    const { dist: dHome } = dijkstra(state, home);
    const maxD = Math.max(1, ...Object.values(dHome).filter((x) => isFinite(x)));

    const idle = state.squads.filter((s) => s.faction === f && s.node !== null && s.node === s.dest && !hasPending(state, s.id));
    for (const sq of idle) {
      const { dist } = dijkstra(state, sq.node);
      let bestC = -1, bestV = -Infinity;
      for (let c = 0; c < N; c++) {
        if (dist[c] === Infinity || c === sq.node) continue;
        const o = state.owner[c], sect = state.board.sectors[c];
        const both = state.meter[c] !== 0; // crude "active" proxy
        const fv = [
          1 - Math.min(1, dist[c] / maxD),
          o === null ? 1 : 0,
          o === enemy ? 1 : 0,
          o === f ? 1 : 0,
          sect.isStronghold && sect.home === enemy ? 1 : 0,
          phase4 && c === eStrong?.tower ? 1 : 0,
          both ? 1 : 0,
          1 - Math.min(1, dHome[c] / maxD),
          sect.isTower ? 1 : 0,
        ];
        let v = 0; for (let k = 0; k < DIM; k++) v += genome[k] * fv[k];
        if (v > bestV) { bestV = v; bestC = c; }
      }
      if (bestC !== -1) issueOrder(state, sq.id, bestC);
    }
  };
}

// a hand-set "sane" genome, used as the self-play seed (so gen 0 isn't random noise)
export const SEED_GENOME = [1.2, 1.0, 0.8, -0.2, 1.5, 1.3, 0.4, 0.2, 0.5];
