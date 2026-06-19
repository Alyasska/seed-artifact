# The Forge — balance report (what the sandbox found)

One Forge system (Territory + Bridges + classes + siege), played in silico. Each
number is from the headless Monte Carlo (600 matches, all strategy matchups, both
sides, seeded). Two fields: a **symmetric test board** and the **real Lake San
Antonio DEM** (the LIB venue). The four heuristics (expander / aggressor /
bridger / turtle) plus a **self-play-trained policy (`rl`)** are in the pool.

## Headline findings

**1. Self-play finds an exploit the heuristics never did.**
On the symmetric board the trained policy wins **~85%** against the whole
heuristic pool — it taught itself to weight the Phase-4 siege tower and forward
pressure and to *stop* sitting on owned ground (see the learned weights in
`rl/curve.html`). A scripted bot pool would have called this ruleset "balanced";
the RL playtester shows it isn't. *This is the point of RL here — not flashy AI, a
better playtester.*

**2. Terrain changes balance. A lot.**
The exact same ruleset:

| | symmetric board | real Lake San Antonio |
|---|---|---|
| faction win% (map fairness) | 49 / 51 ✓ | **45 / 55** ⚠ side bias |
| aggressor win% | 56 | **~76** ⚠ dominant |
| rl win% | 85 | 74 |
| turtle win% | 9 | 11 |
| siege fires | 75% | 62% |

The reservoir cuts the real map into bridge-gated halves, and those chokepoints
make the **aggressive rush dominant (~76%)** where it was only mild (56%) on open
ground. **You cannot balance The Forge once and ship it to every venue — each
field needs its own pass.** That's the recurring service the tool provides.

**3. The RL policy doesn't fully transfer between maps (and that's the lesson).**
Trained on the symmetric board, `rl` slips from ~85% → ~74% on real terrain — a
real transfer gap. A policy (or a balance) tuned on one layout isn't fully valid
on the next; you retrain / re-tune per venue. Cheap to find in sim; expensive on a field.

**4. Pure turtling is non-viable (~10%) on both maps** — it can't cross the
ravine without bridging. A real design decision, not a bug: give defense a path,
or accept that The Forge punishes passivity.

## Lever notes (what to turn, and what it costs)

- **Snowball ~85%** (lead persists). Raising `comebackAid` claws it toward the
  trailing side (0 → 0.8 moves comeback% ~4 → ~16) at the cost of softening the
  reward for early play.
- **Aggression dominant on real terrain** → nerf candidates: `capRate` ↓ (slower
  flips, defense has time) or `decay` ↑ (overreach slips faster).
- **Siege**: reachable now (fires 60–75%) because of battering + the delay tower.
  Wins stay low (~8%) — competent defenders still mostly hold, so score usually
  decides. That's a healthy "siege is a threat, not a coin flip."

## How to reproduce

```bash
node test/smoke.mjs            # invariants (map fairness, lever directions)
node rl/selfplay.mjs           # retrain the policy → data/rl-policy.json (+ curve)
python3 tools/fetch_dem.py     # re-pull the venue DEM
node tools/build_field.mjs     # rebuild the field graph → data/field.json
```
Open the live demo → **Playtest** tab → *Run* to reproduce these on either field.
