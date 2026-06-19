// Self-play policy optimization via the Cross-Entropy Method (CEM).
//
// The lightweight, dependency-free stand-in for the PPO pipeline: a population of
// candidate genomes is evaluated by win-rate against the opponent pool (the four
// heuristic bots + the running elite = self-play), the elite is kept, the sampling
// distribution is refit to it, repeat. Each generation we log the best win-rate →
// a real learning curve. Output: data/rl-policy.json + data/rl-curve.json.
//
// Run: node rl/selfplay.mjs

import fs from "fs";
import path from "path";
import { buildBoard } from "../sim/board.js";
import { defaultParams } from "../sim/params.js";
import { runMatch } from "../sim/core.js";
import { POLICIES } from "../sim/bots.js";
import { makePolicy, DIM, SEED_GENOME } from "./policy.js";
import { makeRng } from "../sim/rng.js";

const root = path.resolve(path.dirname(decodeURIComponent(new URL(import.meta.url).pathname)), "..");
const board = buildBoard();
const params = defaultParams();
const POP = 20, ELITE = 5, GENS = 12, SEEDS = 3;
const POOL = ["expander", "aggressor", "bridger", "turtle"];
const rng = makeRng(7);
function gauss() { const u = Math.max(1e-9, rng()), v = rng(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

// win-rate of a genome vs the opponent pool, both sides, SEEDS seeds each
function fitness(genome, gen) {
  const me = makePolicy(genome);
  let wins = 0, games = 0;
  for (const opp of POOL) {
    for (let s = 0; s < SEEDS; s++) {
      const seed = gen * 1000 + s * 7 + opp.length;
      const a = runMatch(board, params, seed, { red: me, blue: POLICIES[opp] });
      if (a.winner === "red") wins++; games++;
      const b = runMatch(board, params, seed + 1, { red: POLICIES[opp], blue: me });
      if (b.winner === "blue") wins++; games++;
    }
  }
  return wins / games;
}

// start from a BLANK genome so gen 0 is naive play — the curve has to earn its rise
let mean = new Array(DIM).fill(0);
let std = new Array(DIM).fill(1.0);
const curve = [];
let best = { g: [...mean], f: fitness(mean, 0) };

console.log(`CEM self-play · pop ${POP} · elite ${ELITE} · gens ${GENS} · pool [${POOL}]`);
console.log(`gen 0 (seed genome) win-rate vs pool: ${(best.f * 100).toFixed(0)}%`);

for (let gen = 1; gen <= GENS; gen++) {
  const pop = [];
  for (let i = 0; i < POP; i++) {
    const g = mean.map((m, k) => m + std[k] * gauss());
    pop.push({ g, f: fitness(g, gen) });
  }
  pop.sort((a, b) => b.f - a.f);
  const elite = pop.slice(0, ELITE);
  for (let k = 0; k < DIM; k++) {
    const vals = elite.map((e) => e.g[k]);
    mean[k] = vals.reduce((a, b) => a + b, 0) / ELITE;
    const variance = vals.reduce((a, b) => a + (b - mean[k]) ** 2, 0) / ELITE;
    std[k] = Math.max(0.05, Math.sqrt(variance)); // floor keeps a little exploration
  }
  if (pop[0].f > best.f) best = { g: [...pop[0].g], f: pop[0].f };
  const meanFit = fitness(mean, gen + 500);
  curve.push({ gen, best: Math.round(best.f * 100), elite: Math.round(elite[0].f * 100), mean: Math.round(meanFit * 100) });
  console.log(`gen ${String(gen).padStart(2)}  best ${(best.f * 100).toFixed(0)}%  gen-elite ${(elite[0].f * 100).toFixed(0)}%  mean ${(meanFit * 100).toFixed(0)}%`);
}

fs.writeFileSync(path.join(root, "data", "rl-policy.json"), JSON.stringify({ genome: best.g, winRate: Math.round(best.f * 100), dim: DIM }));
fs.writeFileSync(path.join(root, "data", "rl-curve.json"), JSON.stringify(curve));
console.log(`\nbest win-rate vs pool: ${(best.f * 100).toFixed(0)}%`);
console.log("genome:", best.g.map((x) => x.toFixed(2)).join(", "));
console.log("wrote data/rl-policy.json + data/rl-curve.json");
