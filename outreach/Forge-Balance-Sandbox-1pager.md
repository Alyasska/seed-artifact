# The Forge — Balance Sandbox

*A design sample for SEED's Game Systems & Mechanics Designer role.*
Aliaskar Bekishev · github.com/Alyasska · alyasska.github.io · lyasskar@gmail.com
**Live:** https://alyasska.github.io/seed-artifact/ · **Code:** github.com/Alyasska/seed-artifact

---

**What it is.** An in-silico playtest for one Forge system — territory control,
the bridge momentum layer, player classes, and a siege endgame. The same rules
engine runs the watchable live match *and* thousands of headless matches, so it's
a designer/GM pre-flight rig, not a demo game.

**Why.** You can't cheaply playtest a 500-person, 90-minute field game — every run
costs a venue, a crowd, and the whole comms rig. So you tune the ruleset in
simulation and spend the expensive on-field pilots on what sim can't see: whether
real humans have fun. The deliverable your post asks for — *living design doc +
balance logic + playtest frameworks* — is exactly this.

**What's in it**
- live match on a **real DEM** (Lake San Antonio / the LIB site); the reservoir &
  creeks become the bridge-gated ravine, travel-time follows real slope
- **10 balance levers**, each with an **honesty ledger** (intent / trade-off /
  failure mode)
- **Monte Carlo** playtest: faction fairness, dominant-strategy detection,
  snowball vs comeback, dead-time, siege rate, matchup matrix
- **self-play RL** playtester (CEM, no GPU; gym-microrts/PPO skeleton included)
- fog-of-war intel layer; presence-by-pulse capture (NFC-tap-shaped events)

**What it found**
1. **Self-play found an exploit the heuristics missed** — a policy trained from
   scratch beats all four hand-written bots (~85% on the test board). RL here is a
   *better playtester*, not a gimmick.
2. **Terrain flips balance.** The same ruleset that's fine on a symmetric board
   goes aggressor-dominant (~75%) on real Lake San Antonio terrain. Balance is
   per-venue, not one-and-done — that's the recurring service.
3. **Pure turtling is non-viable**, siege fires but rarely decides — surfaced as
   design calls, with the levers to change them.

**Stack.** Plain ES-module JS (no build step, deploys to GitHub Pages) · Python +
Pillow for the DEM pull · all numbers seeded & reproducible (`node test/smoke.mjs`).

**Scope, honestly.** One system, finished small. Classes/intel/parley are designed
in full (see the design doc) but only partly wired. Bots ≠ humans — they map the
structural balance envelope, not the feel.

**End vision.** The pre-flight for The Forge: tune economy, class weights, and
phase timings per venue in sim → ship a near-balanced rulebook → use the few real
pilots to validate human behavior, not to discover that turtling is broken with
500 people on a field.
