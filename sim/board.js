// The board: a graph of SECTORS joined by EDGES, mirror-symmetric so any
// win-rate skew is a parameter problem, not a map problem.
//
//  - normal edges  — passable; crossing costs travel time (= distance).
//  - gated edges    — the central ravine; impassable until an Engineer builds a
//                     BRIDGE (the momentum lever).
//
// Plus v0.2 structure: two STRONGHOLDS (the siege targets, each with a Wall) and
// two DELAY TOWERS — a sector an attacker must hold for 3 min before it may
// besiege the matching stronghold.

export const COLS = 4;
export const ROWS = 3;

// Build the board from a real-DEM field.json (Session 1). Same shape as the
// synthetic board, plus per-sector nx/ny/elev and a heightmap for the hillshade.
export function buildBoardFromField(field) {
  const sectors = field.sectors.map((s) => ({ ...s }));
  const edges = field.edges.map((e) => ({ ...e, bridged: false }));
  const adjacency = sectors.map(() => []);
  for (const e of edges) { adjacency[e.a].push({ edge: e.id, to: e.b }); adjacency[e.b].push({ edge: e.id, to: e.a }); }
  return {
    sectors, edges, adjacency,
    homeRed: field.homeRed, homeBlue: field.homeBlue,
    gatedEdges: field.gatedEdges, strongholds: field.strongholds,
    heightmap: field.heightmap, meta: field.meta, real: true,
  };
}

export function buildBoard() {
  const sectors = [];
  const index = (col, row) => col * ROWS + row;

  for (let col = 0; col < COLS; col++) {
    for (let row = 0; row < ROWS; row++) {
      const isRedHome = col === 0 && row === 1;
      const isBlueHome = col === COLS - 1 && row === 1;
      sectors.push({
        id: index(col, row), col, row, x: col, y: row,
        isStronghold: isRedHome || isBlueHome,
        home: isRedHome ? "red" : isBlueHome ? "blue" : null,
        isTower: false,           // set below
        towerFor: null,           // which stronghold this tower gates
        baseYield: 1,             // multiplied by yieldNormal; strongholds handled separately
      });
    }
  }

  // delay towers: to besiege RED's stronghold you hold the central sector on
  // red's side (id of col1,row1); symmetric for blue (col2,row1).
  const redTower = index(1, 1);
  const blueTower = index(COLS - 2, 1);
  sectors[redTower].isTower = true; sectors[redTower].towerFor = "red";
  sectors[blueTower].isTower = true; sectors[blueTower].towerFor = "blue";

  const edges = [];
  const addEdge = (a, b, dist, gated) => edges.push({ id: edges.length, a, b, dist, gated, bridged: false });
  const mid = COLS / 2; // ravine between col mid-1 and mid

  for (let col = 0; col < COLS; col++)
    for (let row = 0; row < ROWS; row++) {
      const me = index(col, row);
      if (col + 1 < COLS) { const gated = col + 1 === mid; addEdge(me, index(col + 1, row), gated ? 2 : 1, gated); }
      if (row + 1 < ROWS) addEdge(me, index(col, row + 1), 1, false);
    }

  const adjacency = sectors.map(() => []);
  for (const e of edges) { adjacency[e.a].push({ edge: e.id, to: e.b }); adjacency[e.b].push({ edge: e.id, to: e.a }); }

  const homeRed = sectors.find((s) => s.home === "red").id;
  const homeBlue = sectors.find((s) => s.home === "blue").id;

  return {
    sectors, edges, adjacency, homeRed, homeBlue,
    gatedEdges: edges.filter((e) => e.gated).map((e) => e.id),
    strongholds: [
      { id: homeRed, faction: "red", tower: redTower },
      { id: homeBlue, faction: "blue", tower: blueTower },
    ],
  };
}
