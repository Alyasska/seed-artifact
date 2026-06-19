# The Forge — Balance Sandbox

A playable, in-silico playtest for one system of SEED's **The Forge** (a
festival-scale, real-world strategy game): territory control + the bridge momentum
layer + player classes + a siege endgame — wrapped in the two things the design
role actually ships: **balance levers** and a **headless Monte-Carlo + self-play
playtest**.

> The role's brief: *"the output isn't code — it's a living design document,
> balance logic, and playtest frameworks."* You can't cheaply playtest a
> 500-person, 90-minute field game, so this models one system and balances it
> **before** anyone books a venue. Same rules engine runs the live match and the
> headless sims.

**Read first:** [`docs/GAME-DESIGN.md`](docs/GAME-DESIGN.md) (the design + numbers) ·
[`docs/BALANCE-REPORT.md`](docs/BALANCE-REPORT.md) (what the sim found) ·
[`docs/REAL-WORLD.md`](docs/REAL-WORLD.md) (how it runs on a real field).

**Styled docs (tabletop-rulebook theme):** the docs also render as D&D-rulebook PDFs via
[`docs/rulebook.css`](docs/rulebook.css) — the showpiece is
[`docs/The-Forge-Field-Manual.pdf`](docs/The-Forge-Field-Manual.pdf) (classes as stat blocks, the
90-min arc as a table, levers as rules sidebars); the one-page attachment is
[`outreach/Forge-Balance-Sandbox.pdf`](outreach/Forge-Balance-Sandbox.pdf); every other doc is in
[`docs/pdf/`](docs/pdf/). Regenerate with `node tools/md2rulebook.mjs` + Chrome's print-to-pdf.

## Run

```bash
cd seed-artifact
python3 -m http.server 8765      # → http://localhost:8765  (ES modules need a server)
node test/smoke.mjs              # balance invariants (map fairness, lever directions)
```

## Built across 4 sessions (image evidence in [`docs/img/`](docs/img))

1. **Real terrain** — pulls the Lake San Antonio DEM and derives the sector graph;
   the reservoir becomes the bridge-gated ravine. → `tools/fetch_dem.py`,
   `tools/build_field.mjs`, [`s1-real-terrain.png`](docs/img/s1-real-terrain.png)
2. **Mechanics** — classes, presence-by-pulse capture, the 90-min phase arc,
   walls + battering + delay towers, intel/fog (red POV). → [`s2-fog.png`](docs/img/s2-fog.png)
3. **Self-play RL** — a policy trained from a blank genome to ~100% vs the
   heuristics (CEM, no GPU); gym-microrts/PPO skeleton for the scale path. →
   `rl/`, [`s3-rl-curve.png`](docs/img/s3-rl-curve.png)
4. **Balance verdict** — the learned policy + heuristics in the Monte Carlo, on
   real terrain. → [`s4-money-shot.png`](docs/img/s4-money-shot.png)

## Structure

```
sim/        screen-agnostic engine + balance logic (core, bots, montecarlo, params, board)
rl/         policy.js (learnable policy) · selfplay.mjs (CEM) · forge_env.py (gym/PPO skeleton) · curve.html
tools/      fetch_dem.py (DEM pull) · build_field.mjs (DEM → field graph)
data/       lake-san-antonio.json (DEM) · field.json · rl-policy.json · rl-curve.json
ui/         canvas render + DOM wiring (the only screen-aware code)
docs/       GAME-DESIGN · BALANCE-REPORT · REAL-WORLD · DESIGN-IO · TERRAIN · BUILD-PLAN · img/
outreach/   the SEED follow-up email + 1-page attachment
test/       headless sanity checks
```

## Deploy (GitHub Pages)

Static site → push, enable Pages on the branch root. `.nojekyll` is included so
`sim/`, `ui/`, `rl/`, `data/` serve verbatim.

---
*Aliaskar Bekishev · [github.com/Alyasska](https://github.com/Alyasska) ·
[alyasska.github.io](https://alyasska.github.io) · lyasskar@gmail.com*
