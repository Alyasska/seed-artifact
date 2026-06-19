// Canvas rendering + hit-testing for The Forge v0.2. Pure view: reads state only.
// Renders the REAL DEM hillshade (cached offscreen) when the board carries one.

import { COLS, ROWS } from "../sim/board.js";
import { isBridged } from "../sim/core.js";
import { CLASSES, CONST } from "../sim/params.js";

const C = {
  red: "#e0563f", blue: "#3d92e0", neutral: "#3a4150",
  field: "#10131a", grid: "#2a3344", ravine: "#e0563f", bridge: "#f2c14e",
  wall: "#dfe6f0", tower: "#f2c14e",
};

export function computeLayout(canvas) {
  const W = canvas.width, H = canvas.height;
  const pad = Math.min(W, H) * 0.1;
  return { W, H, pad, r: Math.min(W, H) * 0.028 };
}
// canvas position of a sector: real terrain coords (nx,ny) if present, else grid
function sp(layout, s) {
  const { W, H, pad } = layout;
  if (s.nx != null) return { x: pad + s.nx * (W - 2 * pad), y: pad + s.ny * (H - 2 * pad) };
  return { x: pad + (s.col / (COLS - 1)) * (W - 2 * pad), y: pad + (s.row / (ROWS - 1)) * (H - 2 * pad) };
}

// ---- cached hillshade of the real DEM --------------------------------------
let _hs = null, _hsKey = null;
function ensureHillshade(board, W, H) {
  const hm = board.heightmap;
  if (!hm) return null;
  const key = `${W}x${H}:${hm.w}x${hm.h}`;
  if (_hs && _hsKey === key) return _hs;
  const off = document.createElement("canvas"); off.width = W; off.height = H;
  const octx = off.getContext("2d"), img = octx.createImageData(W, H), D = img.data;
  const { w: hw, h: hh, min: LO, max: HI, waterPct, elev } = hm;
  const E = (cx, cy) => elev[Math.max(0, Math.min(hh - 1, cy)) * hw + Math.max(0, Math.min(hw - 1, cx))];
  const lerp = (a, b, t) => a + (b - a) * t;
  for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) {
    const cx = Math.floor((px / W) * hw), cy = Math.floor((py / H) * hh);
    const e = E(cx, cy), n = (e - LO) / (HI - LO), p = (py * W + px) * 4;
    if (n <= waterPct) { const d = 0.5 + 0.5 * (n / waterPct); D[p] = 22 + d * 16; D[p + 1] = 78 + d * 38; D[p + 2] = 122 + d * 44; D[p + 3] = 255; continue; }
    const gx = E(cx + 1, cy) - E(cx - 1, cy), gy = E(cx, cy + 1) - E(cx, cy - 1);
    let sh = 0.66 - (gx - gy) * 0.06; sh = Math.max(0.32, Math.min(1.18, sh));
    D[p] = lerp(96, 198, n) * sh; D[p + 1] = lerp(112, 178, n) * sh; D[p + 2] = lerp(66, 120, n) * sh; D[p + 3] = 255;
  }
  octx.putImageData(img, 0, 0);
  _hs = off; _hsKey = key; return off;
}

// Intel layer: which sectors a faction can "see" — where it has a squad, plus
// adjacent sectors (Runners, with their reach, push this outward). Everything
// else is fog: you know you don't hold it, not what the enemy is doing there.
function visibleSet(state, faction) {
  const seen = new Set();
  for (const sq of state.squads) {
    if (sq.faction !== faction || sq.node === null) continue;
    seen.add(sq.node);
    const reach = sq.cls === "runner" ? 2 : 1; // scouts see further
    let frontier = [sq.node];
    for (let d = 0; d < reach; d++) {
      const next = [];
      for (const n of frontier) for (const { to } of state.board.adjacency[n]) if (!seen.has(to)) { seen.add(to); next.push(to); }
      frontier = next;
    }
  }
  return seen;
}

export function draw(ctx, state, layout, opts = {}) {
  const b = state.board, { W, H } = layout;
  const fog = opts.fog ? visibleSet(state, opts.fog) : null;
  ctx.clearRect(0, 0, W, H);
  const hs = ensureHillshade(b, W, H);
  if (hs) ctx.drawImage(hs, 0, 0);
  else { ctx.fillStyle = C.field; ctx.fillRect(0, 0, W, H); }

  // edges
  for (const e of b.edges) {
    const a = sp(layout, b.sectors[e.a]), c = sp(layout, b.sectors[e.b]);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(c.x, c.y);
    if (e.gated && !isBridged(state, e.id)) { ctx.strokeStyle = C.ravine; ctx.lineWidth = 2.5; ctx.setLineDash([3, 6]); ctx.globalAlpha = 0.55; }
    else if (e.gated) { ctx.strokeStyle = C.bridge; ctx.lineWidth = 4; ctx.setLineDash([]); ctx.globalAlpha = 1; }
    else { ctx.strokeStyle = C.grid; ctx.lineWidth = 1.5; ctx.setLineDash([]); ctx.globalAlpha = 0.7; }
    ctx.stroke();
  }
  ctx.setLineDash([]); ctx.globalAlpha = 1;

  // sectors
  for (const s of b.sectors) {
    const p = sp(layout, s), owner = state.owner[s.id], m = state.meter[s.id];
    const rr = s.isStronghold ? layout.r * 1.6 : layout.r;
    if (fog && !fog.has(s.id)) { // fogged: you don't know who holds it
      ctx.beginPath(); ctx.arc(p.x, p.y, rr, 0, Math.PI * 2); ctx.fillStyle = "#0b0e14"; ctx.globalAlpha = 0.62; ctx.fill(); ctx.globalAlpha = 1;
      ctx.fillStyle = "#5a6678"; ctx.font = `${Math.round(rr)}px sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("?", p.x, p.y + 1); ctx.textAlign = "start";
      continue;
    }
    const frac = Math.min(1, Math.abs(m) / CONST.meterMax);
    if (frac > 0.02) { ctx.beginPath(); ctx.arc(p.x, p.y, rr + 5, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2); ctx.strokeStyle = m >= 0 ? C.red : C.blue; ctx.lineWidth = 3; ctx.stroke(); }
    if (s.isTower) { ctx.beginPath(); ctx.arc(p.x, p.y, rr + 9, 0, Math.PI * 2); ctx.strokeStyle = C.tower; ctx.globalAlpha = 0.45; ctx.lineWidth = 1.5; ctx.setLineDash([2, 4]); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1; }
    ctx.beginPath();
    if (s.isStronghold) { ctx.moveTo(p.x, p.y - rr); ctx.lineTo(p.x + rr, p.y); ctx.lineTo(p.x, p.y + rr); ctx.lineTo(p.x - rr, p.y); ctx.closePath(); }
    else ctx.arc(p.x, p.y, rr, 0, Math.PI * 2);
    ctx.fillStyle = owner ? C[owner] : C.neutral; ctx.globalAlpha = owner ? 0.9 : 0.6; ctx.fill(); ctx.globalAlpha = 1;
    ctx.strokeStyle = "#0008"; ctx.lineWidth = 1; ctx.stroke();
    if (s.isStronghold) { const wv = state.wall[s.id] / CONST.strongholdWall; if (wv > 0) { ctx.beginPath(); ctx.arc(p.x, p.y, rr + 9, -Math.PI / 2, -Math.PI / 2 + wv * Math.PI * 2); ctx.strokeStyle = C.wall; ctx.globalAlpha = 0.75; ctx.lineWidth = 2.5; ctx.stroke(); ctx.globalAlpha = 1; } }
  }

  // squads — colored by CLASS, outlined by faction
  const perNode = {};
  for (const sq of state.squads) {
    // fog: you can't see enemy squads that aren't in a sector you can observe
    if (fog && sq.faction !== opts.fog && (sq.node === null || !fog.has(sq.node))) continue;
    let pt;
    if (sq.node !== null) { const base = sp(layout, b.sectors[sq.node]); const k = (perNode[sq.node] = (perNode[sq.node] || 0) + 1) - 1; const ang = k * 2.399, rad = 8 + (k % 3) * 5; pt = { x: base.x + Math.cos(ang) * rad, y: base.y + Math.sin(ang) * rad }; }
    else { const a = sp(layout, b.sectors[sq.from]), c = sp(layout, b.sectors[sq.to]), t = Math.min(1, sq.progress / b.edges[sq.edge].dist); pt = { x: a.x + (c.x - a.x) * t, y: a.y + (c.y - a.y) * t }; }
    ctx.beginPath(); ctx.arc(pt.x, pt.y, 3.8, 0, Math.PI * 2); ctx.fillStyle = CLASSES[sq.cls].color; ctx.fill(); ctx.strokeStyle = C[sq.faction]; ctx.lineWidth = 2; ctx.stroke();
  }
}

export function hitTest(state, layout, x, y) {
  const b = state.board;
  for (const s of b.sectors) { const p = sp(layout, s); const rr = (s.isStronghold ? layout.r * 1.6 : layout.r) + 6; if ((x - p.x) ** 2 + (y - p.y) ** 2 <= rr * rr) return { sector: s.id }; }
  for (const id of b.gatedEdges) { const e = b.edges[id]; const a = sp(layout, b.sectors[e.a]), c = sp(layout, b.sectors[e.b]); const mx = (a.x + c.x) / 2, my = (a.y + c.y) / 2; if ((x - mx) ** 2 + (y - my) ** 2 <= 16 * 16) return { edge: id }; }
  return null;
}
