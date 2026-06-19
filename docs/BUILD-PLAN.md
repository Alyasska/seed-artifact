# Build plan — 4 sessions, checkpoint + image evidence after each

Rule: every session ends with (a) a working, runnable checkpoint and (b) a
screenshot saved under `docs/img/`. No session is "done" without the image.

| # | Session | Builds | Image evidence |
|---|---|---|---|
| **1** | **Real terrain field** | Pull a real DEM of Lake San Antonio → derive sector graph (water/steep = gated ravine, edge cost = real slope) → **swap the abstract grid in the working sandbox for the real field**. Add the resource readout + 90-min phase clock. | live match running on the real hillshade, with sectors/bridges/squads |
| **2** | **Game-design mechanics** | Implement the design doc: **classes** (capture weights/abilities), **intel/fog** (see only scouted sectors), **resource sinks** (bridge/intel/siege), and the **phase-gated 90-min arc** (land-grab → contact → siege bell). | fogged map + class roster + phase banner + resource ledger |
| **3** | **RL playtesters** | Wrap the engine as a gym/PettingZoo env with a **microrts-style observation tensor + command action**; train **PPO self-play** at small scale (3v3, ~14 sectors); export trained-agent episodes. | learning curve climbing + an RL episode replay + the strategy it found |
| **4** | **Balance verdict + polish** | **OpenSpiel-style** metrics (fairness, matchup matrix, exploitability), wire RL + heuristics into the Monte Carlo, link findings to the honesty ledger, polish UI, finalize the design doc. | the full "money-shot" screen with **real data** (not a mockup) |

Each checkpoint is committable and shippable on its own — if we stop after any
session, there's still a coherent artifact.

**Known risk (Session 1):** fetching real elevation data depends on network/tool
access in the build environment. Primary source: USGS 3DEP via OpenTopography;
fallback: AWS Terrain Tiles (Terrarium PNG → decode). If both are blocked, I'll
use a real DEM file you drop in `data/` — the pipeline is identical either way.
