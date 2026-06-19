# Stage 1 — real terrain (the Forge field)

**Decision:** the field is a **real festival venue that SEED services**, not
invented terrain. SEED's portfolio includes **Lightning in a Bottle**, so the
field is a real LIB site.

**Chosen site:** **Lake San Antonio, Bradley, CA** (Monterey County) — LIB's
historic home, the rugged "California Hills of Bradley." Oak-savanna hills around
a reservoir → real elevation, real chokepoints.
*Approx. centre:* `35.80° N, 120.88° W`. Demo bbox: a small ~2–4 km window
(start small → scale later).

**Swap option:** **Buena Vista Lake, Kern County, CA** (`35.19° N, 119.32° W`) —
LIB's *current* venue (2022–present). Flatter; use if "where they are now" beats
"best terrain."

> chitin-coast is **not** a data source here. It is referenced only as evidence of
> the skill ("I've built DEM/terrain pipelines with rasterio"). The data is real.

## Why real data is a feature, not decoration

The **lake and creeks at the venue become the "ravine"** that bridges cross. The
chokepoints aren't hand-drawn — they fall out of the real DEM. That is the
"bend the mechanic to the tool/data" principle made literal.

## Pipeline (uses real tools, nothing hand-rolled)

1. **Pick bbox** around the venue (small for the demo).
2. **Fetch DEM** — open data, no auth:
   - primary: **USGS 3DEP (10 m)** via OpenTopography API
   - easy fallback: **AWS Terrain Tiles** (Terrarium PNG → decode to elevation)
3. **Read it** with `rasterio` (the chitin-coast stack).
4. **Cost surface:** slope from elevation → traversal cost; water + too-steep =
   impassable → these are the natural **ravine / chokepoint** edges.
5. **Place sectors:** sample N control points on traversable land → Voronoi
   regions = sectors (use `scipy`/`networkx`, not custom code).
6. **Build the graph:** neighbouring sectors connected; **edge cost = least-cost
   path over real terrain** (true travel-time); edges crossing water/steep ground
   are **gated** (need a bridge).
7. **Export** `field.json` (sectors + edges + costs + gated flags) → consumed by
   BOTH the Python RL env and the web demo. One field, one source of truth.

## Scale story (your "start small → prove it scales")

Small bbox + ~12–30 sectors + 3v3 now → the *same* pipeline takes a bigger bbox,
finer DEM, and more sectors/agents with more compute. Nothing in the pipeline is
hardcoded to the small size — that's the scalability proof for an employer.
