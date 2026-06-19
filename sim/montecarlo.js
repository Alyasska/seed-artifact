// The headless playtest. This is the artifact's reason to exist.
//
// You cannot cheaply playtest a 500-body, 90-minute game on a real field. So we
// play it in silico thousands of times and read the balance off the aggregate:
//   - faction win% ......... is the map/params side-neutral? (should be ~50/50)
//   - per-strategy win% .... is any one strategy dominant? (the cardinal sin)
//   - snowball vs comeback . does an early lead just convert to a win?
//   - lead changes ......... is the match a contest or a procession?
//   - dead-time ............ what fraction of the session is nothing happening?
//   - siege rate ........... does the decisive endgame actually fire?
//
// Same engine as the live match (core.js). Reproducible: every game is seeded.

import { runMatch } from "./core.js";
import { POLICIES, POLICY_NAMES } from "./bots.js";

export function runMonteCarlo(board, params, opts = {}) {
  // opts.policyMap lets callers inject extra controllers (e.g. the learned RL
  // policy) alongside the four heuristics, keyed by name.
  const pols = opts.policyMap || POLICIES;
  const policies = opts.policies && opts.policies.length ? opts.policies : Object.keys(pols);
  const targetGames = opts.games ?? 400;
  const seedBase = opts.seedBase ?? 1;

  const pairs = [];
  for (const a of policies) for (const b of policies) pairs.push([a, b]); // ordered: covers both sides
  const perPair = Math.max(1, Math.ceil(targetGames / pairs.length));

  const factionWins = { red: 0, blue: 0, tie: 0 };
  const byPolicy = {};
  for (const p of policies) byPolicy[p] = { games: 0, wins: 0 };
  // matchup[a][b] = { games, winsA } aggregated over BOTH orientations (side-neutral)
  const matchup = {};
  for (const a of policies) {
    matchup[a] = {};
    for (const b of policies) matchup[a][b] = { games: 0, winsA: 0 };
  }

  let snowball = 0; // leader at half-time went on to win
  let comeback = 0; // trailing-at-half-time faction won
  let decided = 0; // games with a non-tie winner and a recorded mid leader
  let leadChangesSum = 0;
  let deadFracSum = 0;
  let siegeWins = 0;
  let siegeFired = 0; // games where battering actually happened
  let total = 0;
  let seed = seedBase;

  for (const [pa, pb] of pairs) {
    for (let g = 0; g < perPair; g++) {
      const r = runMatch(board, params, seed++, { red: pols[pa], blue: pols[pb] });
      total++;
      factionWins[r.winner === "red" ? "red" : r.winner === "blue" ? "blue" : "tie"]++;

      byPolicy[pa].games++;
      byPolicy[pb].games++;
      if (r.winner === "red") byPolicy[pa].wins++;
      else if (r.winner === "blue") byPolicy[pb].wins++;

      // side-neutral matchup tally (record pa's result vs pb)
      matchup[pa][pb].games++;
      if (r.winner === "red") matchup[pa][pb].winsA++;

      leadChangesSum += r.leadChanges;
      deadFracSum += r.ticks ? r.deadTicks / r.ticks : 0;
      if (r.winReason === "siege" && r.winner !== "tie") siegeWins++;
      if (r.siegeFired) siegeFired++;

      if (r.winner !== "tie" && r.leaderAtMid) {
        decided++;
        if (r.leaderAtMid === r.winner) snowball++;
        else comeback++;
      }
    }
  }

  const pct = (n, d) => (d ? Math.round((100 * n) / d) : 0);

  return {
    total,
    policies,
    perPair,
    factionWinPct: { red: pct(factionWins.red, total), blue: pct(factionWins.blue, total), tie: pct(factionWins.tie, total) },
    policyWinPct: Object.fromEntries(policies.map((p) => [p, pct(byPolicy[p].wins, byPolicy[p].games)])),
    // dominance spread: gap between best and worst strategy. ~0 = balanced.
    dominanceSpread: (() => {
      const vals = policies.map((p) => pct(byPolicy[p].wins, byPolicy[p].games));
      return Math.max(...vals) - Math.min(...vals);
    })(),
    bestPolicy: policies.reduce((a, b) => (pct(byPolicy[a].wins, byPolicy[a].games) >= pct(byPolicy[b].wins, byPolicy[b].games) ? a : b)),
    matchupMatrix: matchup, // matchup[row][col].winsA / .games = row's win% vs col
    snowballPct: pct(snowball, decided),
    comebackPct: pct(comeback, decided),
    avgLeadChanges: total ? +(leadChangesSum / total).toFixed(1) : 0,
    deadTimePct: total ? Math.round((100 * deadFracSum) / total) : 0,
    siegeWinPct: pct(siegeWins, total),
    siegeFiredPct: pct(siegeFired, total),
  };
}
