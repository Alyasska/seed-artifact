// Session 1 — turn the real DEM into a playable field graph.
//   sectors  = control points snapped onto traversable (non-water, low-slope) ground
//   edges    = grid adjacency; cost = real ground distance + a climb penalty
//   gated    = edges that cross water or a steep slope → the real "ravine" a
//              bridge must span. Chokepoints fall out of the terrain, not a pen.
// Output: field.json, consumed by both the browser demo and the engine.
// Run: node tools/build_field.mjs

import fs from "fs";
import path from "path";

const root = path.resolve(path.dirname(decodeURIComponent(new URL(import.meta.url).pathname)), "..");
const dem = JSON.parse(fs.readFileSync(path.join(root, "data", "lake-san-antonio.json")));
const { w: W, h: H, elev: E, min: LO, max: HI, span_m } = dem;
const norm = (e) => (e - LO) / (HI - LO);
const at = (cx, cy) => E[Math.max(0, Math.min(H - 1, cy)) * W + Math.max(0, Math.min(W - 1, cx))];

// water = lowest 12th percentile (the reservoir)
const sorted = [...E].sort((a, b) => a - b);
const waterElev = sorted[Math.floor(sorted.length * 0.12)];
const isWaterCell = (cx, cy) => at(cx, cy) <= waterElev;
const waterPct = (waterElev - LO) / (HI - LO);

// slope (gradient magnitude, metres per cell)
function slopeAt(cx, cy) {
  const dx = at(cx + 1, cy) - at(cx - 1, cy);
  const dy = at(cx, cy + 1) - at(cx, cy - 1);
  return Math.hypot(dx, dy) / 2;
}

const COLS = 5, ROWS = 3;
const idx = (c, r) => c * ROWS + r;
// require a real margin above the waterline so nodes sit on dry land, not the shore
const DRY = waterElev + (HI - LO) * 0.07;
const sectors = [];
for (let c = 0; c < COLS; c++)
  for (let r = 0; r < ROWS; r++) {
    // target cell in this grid zone, then snap to the lowest-slope DRY-LAND cell;
    // if the zone is all water/shore, take the driest (highest) cell instead.
    const tx = Math.round(((c + 0.5) / COLS) * (W - 1));
    const ty = Math.round(((r + 0.5) / ROWS) * (H - 1));
    const win = Math.round(W / (COLS * 1.5));
    let best = null, bestSlope = 1e9, driest = null, driestE = -1e9;
    for (let yy = ty - win; yy <= ty + win; yy++)
      for (let xx = tx - win; xx <= tx + win; xx++) {
        if (xx < 1 || yy < 1 || xx >= W - 1 || yy >= H - 1) continue;
        const e = at(xx, yy);
        if (e > driestE) { driestE = e; driest = [xx, yy]; }
        if (e < DRY) continue; // skip water + shoreline
        const sl = slopeAt(xx, yy);
        if (sl < bestSlope) { bestSlope = sl; best = [xx, yy]; }
      }
    const [bx, by] = best || driest || [tx, ty];
    const isRedHome = c === 0 && r === 1, isBlueHome = c === COLS - 1 && r === 1;
    sectors.push({
      id: idx(c, r), col: c, row: r,
      nx: bx / (W - 1), ny: by / (H - 1),     // normalized canvas position
      elev: Math.round(at(bx, by)), cell: [bx, by],
      isStronghold: isRedHome || isBlueHome,
      home: isRedHome ? "red" : isBlueHome ? "blue" : null,
      isTower: false, towerFor: null, baseYield: 1,
    });
  }
// delay towers: one step inward from each stronghold
const redTower = idx(1, 1), blueTower = idx(COLS - 2, 1);
sectors[redTower].isTower = true; sectors[redTower].towerFor = "red";
sectors[blueTower].isTower = true; sectors[blueTower].towerFor = "blue";

// edges (grid adjacency) with real cost + steepness, then gate the steepest ~22%
const raw = [];
const sampleLine = (a, b, fn) => {
  const N = 12; let acc = 0, mx = 0;
  for (let k = 0; k <= N; k++) {
    const x = Math.round(a.cell[0] + (b.cell[0] - a.cell[0]) * (k / N));
    const y = Math.round(a.cell[1] + (b.cell[1] - a.cell[1]) * (k / N));
    const v = fn(x, y); acc += v; mx = Math.max(mx, v);
  }
  return { mean: acc / (N + 1), max: mx };
};
for (let c = 0; c < COLS; c++)
  for (let r = 0; r < ROWS; r++) {
    const me = sectors[idx(c, r)];
    const nbrs = [];
    if (c + 1 < COLS) nbrs.push(sectors[idx(c + 1, r)]);
    if (r + 1 < ROWS) nbrs.push(sectors[idx(c, r + 1)]);
    for (const nb of nbrs) {
      const ground = Math.hypot((me.nx - nb.nx) * span_m, (me.ny - nb.ny) * span_m); // metres
      const climb = sampleLine(me, nb, (x, y) => Math.abs(at(x, y) - me.elev)).mean;
      const steep = sampleLine(me, nb, slopeAt).max;
      const crossesWater = sampleLine(me, nb, (x, y) => (isWaterCell(x, y) ? 1 : 0)).max > 0;
      // travel cost ≈ ground distance + a climb penalty, normalized to ~1 per short hop
      const dist = (ground + climb * 6) / (span_m / COLS);
      raw.push({ a: me.id, b: nb.id, dist: +dist.toFixed(2), steep, crossesWater });
    }
  }
const steepCut = [...raw].map((e) => e.steep).sort((a, b) => a - b)[Math.floor(raw.length * 0.78)];
const edges = raw.map((e, i) => ({ id: i, a: e.a, b: e.b, dist: e.dist, gated: e.crossesWater || e.steep >= steepCut }));

const field = {
  meta: { venue: dem.venue, source: dem.source, bbox: dem.bbox, span_m, zoom: dem.zoom },
  heightmap: { w: W, h: H, min: LO, max: HI, waterPct: +waterPct.toFixed(3), elev: E },
  sectors, edges,
  homeRed: redTower === idx(0, 1) ? idx(0, 1) : sectors.find((s) => s.home === "red").id,
  homeBlue: sectors.find((s) => s.home === "blue").id,
  gatedEdges: edges.filter((e) => e.gated).map((e) => e.id),
  strongholds: [
    { id: sectors.find((s) => s.home === "red").id, faction: "red", tower: redTower },
    { id: sectors.find((s) => s.home === "blue").id, faction: "blue", tower: blueTower },
  ],
};
fs.writeFileSync(path.join(root, "data", "field.json"), JSON.stringify(field));
console.log(`field.json: ${sectors.length} sectors, ${edges.length} edges, ${field.gatedEdges.length} gated (bridge points)`);
console.log("elev range on sectors:", Math.min(...sectors.map((s) => s.elev)), "..", Math.max(...sectors.map((s) => s.elev)), "m");
