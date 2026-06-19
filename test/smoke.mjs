// Headless sanity checks for The Forge v0.2. Run: node test/smoke.mjs
import { buildBoard } from "../sim/board.js";
import { defaultParams } from "../sim/params.js";
import { runMatch } from "../sim/core.js";
import { POLICIES } from "../sim/bots.js";
import { runMonteCarlo } from "../sim/montecarlo.js";

let fails = 0;
const ok = (c, m) => { console.log(`${c ? "  ok  " : " FAIL "} ${m}`); if (!c) fails++; };
const board = buildBoard();
console.log("board:", board.sectors.length, "sectors,", board.strongholds.length, "strongholds, towers:", board.strongholds.map((s) => s.tower).join(","));

const m = runMatch(board, defaultParams(), 42, { red: POLICIES.expander, blue: POLICIES.aggressor });
console.log("\nsample (expander R vs aggressor B):", JSON.stringify(m));
ok(m.ticks > 0 && m.ticks <= defaultParams().sessionTicks, "match terminates within the session");
ok(["red", "blue", "tie"].includes(m.winner), "match has a winner");

const mirror = runMonteCarlo(board, defaultParams(), { policies: ["expander"], games: 200 });
console.log("\nmirror (expander vs expander):", mirror.factionWinPct);
ok(Math.abs(mirror.factionWinPct.red - mirror.factionWinPct.blue) <= 16, "mirror is roughly side-neutral");

const mc = runMonteCarlo(board, defaultParams(), { games: 600 });
console.log("\nfull Monte Carlo (", mc.total, "games ):");
console.log("  faction :", mc.factionWinPct);
console.log("  strategy:", mc.policyWinPct, "best", mc.bestPolicy, "spread", mc.dominanceSpread);
console.log("  snowball", mc.snowballPct, "comeback", mc.comebackPct, "leadChg", mc.avgLeadChanges, "dead%", mc.deadTimePct);
console.log("  siege fired%", mc.siegeFiredPct, " siege win%", mc.siegeWinPct);
ok(Math.abs(mc.factionWinPct.red - mc.factionWinPct.blue) <= 12, "full-field faction win% is side-neutral (the key correctness signal)");
ok(Math.abs(mc.snowballPct + mc.comebackPct - 100) <= 1, "snowball + comeback partition decided games");
// turtle is expected to be weak (it can't cross the ravine); we only guard
// against an *absurd* single-strategy lock, which would be a real bug.
ok(mc.policyWinPct[mc.bestPolicy] <= 75, "no absurdly dominant strategy (best ≤ 75%)");

// the comeback lever does what the ledger claims
const noAid = runMonteCarlo(board, { ...defaultParams(), comebackAid: 0 }, { games: 300 });
const bigAid = runMonteCarlo(board, { ...defaultParams(), comebackAid: 0.8 }, { games: 300 });
console.log("\ncomeback lever — comeback%  aid0:", noAid.comebackPct, " aid0.8:", bigAid.comebackPct);
ok(bigAid.comebackPct >= noAid.comebackPct, "more comeback aid → more comebacks");

// faster battering → siege fires/wins more
const slowB = runMonteCarlo(board, { ...defaultParams(), batterRate: 0.4 }, { games: 300 });
const fastB = runMonteCarlo(board, { ...defaultParams(), batterRate: 5 }, { games: 300 });
console.log("\nbatter lever — siege win%  slow:", slowB.siegeWinPct, " fast:", fastB.siegeWinPct);
ok(fastB.siegeWinPct >= slowB.siegeWinPct, "faster battering → at least as many siege wins");

console.log(`\n${fails === 0 ? "ALL CHECKS PASSED" : fails + " CHECK(S) FAILED"}`);
process.exit(fails === 0 ? 0 : 1);
