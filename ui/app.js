// Wiring for The Forge v0.2: live match, levers, honesty ledger, Monte Carlo.

import { buildBoard, buildBoardFromField } from "../sim/board.js";
import { LEVERS, STRUCTURAL_LEDGER, CLASSES, defaultParams, TICK_SECONDS } from "../sim/params.js";
import { createState, step, issueOrder, tryBuildBridge, isBridged } from "../sim/core.js";
import { POLICIES, POLICY_NAMES } from "../sim/bots.js";
import { runMonteCarlo } from "../sim/montecarlo.js";
import { makePolicy } from "../rl/policy.js";
import { computeLayout, draw, hitTest } from "./render.js";

// Load the real-DEM field (Lake San Antonio); fall back to the synthetic grid offline.
let board = buildBoard();
try {
  const res = await fetch("data/field.json");
  if (res.ok) board = buildBoardFromField(await res.json());
} catch { /* offline → synthetic board */ }
// Load the self-play-trained policy into the Monte Carlo pool, if present.
let policyMap = { ...POLICIES }, policyNames = [...POLICY_NAMES];
try {
  const rl = await (await fetch("data/rl-policy.json")).json();
  policyMap.rl = makePolicy(rl.genome); policyNames.push("rl");
} catch { /* no trained policy → heuristics only */ }
let params = defaultParams();
let seed = 1, state = createState(board, params, seed);
let running = true, speed = 6, autoRed = true, redBot = "expander", blueBot = "aggressor", fog = false;

const $ = (id) => document.getElementById(id);
const canvas = $("board"), ctx = canvas.getContext("2d");
let layout = computeLayout(canvas);

function restart() { seed++; state = createState(board, params, seed); }
const controllers = () => ({ red: autoRed ? POLICIES[redBot] : null, blue: POLICIES[blueBot] });
function fmtClock(t) { const s = t * TICK_SECONDS, m = Math.floor(s / 60); return `${m}:${String(s % 60).padStart(2, "0")}`; }

// ---- loop ----
let acc = 0, last = 0;
function frame(ts) {
  if (!last) last = ts; const dt = ts - last; last = ts;
  if (running && !state.done) {
    acc += dt; const stepEvery = 1000 / (speed * 8); let budget = 6;
    while (acc >= stepEvery && budget-- > 0 && !state.done) { step(state, controllers()); acc -= stepEvery; }
  }
  layout = computeLayout(canvas); draw(ctx, state, layout, { fog: fog ? "red" : null }); updateHud();
  requestAnimationFrame(frame);
}

function held(f) { let n = 0; for (let i = 0; i < board.sectors.length; i++) if (state.owner[i] === f) n++; return n; }
function updateHud() {
  $("score-red").textContent = state.score.red; $("score-blue").textContent = state.score.blue;
  $("held-red").textContent = held("red"); $("held-blue").textContent = held("blue");
  $("res-red").textContent = Math.round(state.resource.red); $("res-blue").textContent = Math.round(state.resource.blue);
  $("clock").textContent = fmtClock(state.tick) + " / " + fmtClock(state.maxTicks);
  $("phase").innerHTML = `<b>Phase ${state.phase.key}/4 · ${state.phase.name}</b> — ${state.phase.note}`;
  const banner = $("winner");
  if (state.done) {
    const w = state.won || (state.score.red > state.score.blue ? "red" : state.score.blue > state.score.red ? "blue" : "tie");
    banner.textContent = w === "tie" ? "DRAW" : `${w.toUpperCase()} WINS` + (state.won ? " — stronghold sieged!" : " on score");
    banner.className = "winner show " + w;
  } else banner.className = "winner";
}

// ---- human input (you are RED) ----
canvas.addEventListener("click", (e) => {
  if (autoRed) return;
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) * (canvas.width / rect.width), y = (e.clientY - rect.top) * (canvas.height / rect.height);
  const hit = hitTest(state, layout, x, y); if (!hit) return;
  if (hit.sector !== undefined) { for (const sq of state.squads) if (sq.faction === "red") issueOrder(state, sq.id, hit.sector); flash(`RED → sector ${hit.sector} (order in transit)`); }
  else if (hit.edge !== undefined) { const okb = tryBuildBridge(state, "red", hit.edge); flash(okb ? "RED built a bridge" : state.phase.key < 2 ? "Bridges unlock in Phase 2 (Contact)" : "Need an Engineer at the gate + 120 Supply"); }
});
let flashT = null;
function flash(m) { const el = $("flash"); el.textContent = m; el.classList.add("show"); clearTimeout(flashT); flashT = setTimeout(() => el.classList.remove("show"), 1300); }

// ---- levers ----
function buildLevers() {
  const wrap = $("levers");
  for (const [k, L] of Object.entries(LEVERS)) {
    const row = document.createElement("div"); row.className = "lever";
    row.innerHTML = `<div class="lever-head"><label>${L.label}</label><output id="out-${k}">${params[k]}${L.unit ? " " + L.unit : ""}</output></div>
      <input type="range" id="lev-${k}" min="${L.min}" max="${L.max}" step="${L.step}" value="${params[k]}"><div class="lever-help">${L.help}</div>`;
    wrap.appendChild(row);
    const inp = row.querySelector("input");
    inp.addEventListener("input", () => { params[k] = parseFloat(inp.value); $(`out-${k}`).textContent = `${params[k]}${L.unit ? " " + L.unit : ""}`; if (k === "squadCount" || k === "sessionTicks") restart(); });
  }
}

// ---- class legend ----
function buildClasses() {
  $("classes").innerHTML = Object.values(CLASSES).map((c) => `<span class="cls"><i style="background:${c.color}"></i>${c.label} <em>${c.role}</em></span>`).join("");
}

// ---- ledger ----
function buildLedger() {
  const card = (t, l) => `<div class="ledger-card"><h4>${t}</h4>
    <p><span class="tag intent">intent</span>${l.intent}</p><p><span class="tag trade">trade-off</span>${l.tradeoff}</p><p><span class="tag fail">failure</span>${l.failure}</p></div>`;
  let h = '<p class="muted">Every rule states what it buys and what it costs — the deliverable, not the code.</p>';
  for (const L of Object.values(LEVERS)) h += card(L.label, L.ledger);
  h += '<h3 class="ledger-sub">Structural rules</h3>';
  for (const s of STRUCTURAL_LEDGER) h += card(s.rule, s);
  $("ledger").innerHTML = h;
}

// ---- playtest ----
function bar(l, p, cls) { return `<div class="bar-row"><span class="bar-label">${l}</span><span class="bar-track"><span class="bar-fill ${cls || ""}" style="width:${Math.max(2, p)}%"></span></span><span class="bar-val">${p}%</span></div>`; }
function matrix(mc) {
  const ps = mc.policies;
  let h = '<table class="matrix"><tr><th></th>' + ps.map((p) => `<th>${p.slice(0, 4)}</th>`).join("") + "</tr>";
  for (const r of ps) { h += `<tr><th>${r.slice(0, 4)}</th>`; for (const c of ps) { const cell = mc.matchupMatrix[r][c]; const v = cell.games ? Math.round((100 * cell.winsA) / cell.games) : 0; h += `<td style="background:hsl(${v >= 50 ? 130 : 0} 45% ${22 + Math.abs(v - 50) * 0.5}%)">${v}</td>`; } h += "</tr>"; }
  return h + "</table>";
}
function runPlaytest() {
  const games = parseInt($("mc-games").value, 10);
  $("mc-overlay").classList.add("show"); $("btn-mc").disabled = true;
  setTimeout(() => {
    const t0 = performance.now(); const mc = runMonteCarlo(board, params, { games, policyMap, policies: policyNames }); const ms = Math.round(performance.now() - t0);
    renderPlaytest(mc, ms); $("mc-overlay").classList.remove("show"); $("btn-mc").disabled = false;
  }, 40);
}
function renderPlaytest(mc, ms) {
  const f = [];
  if (Math.abs(mc.factionWinPct.red - mc.factionWinPct.blue) > 12) f.push(`⚠ Side imbalance: Red ${mc.factionWinPct.red}% / Blue ${mc.factionWinPct.blue}%.`);
  else f.push(`✓ Side-neutral: Red ${mc.factionWinPct.red}% / Blue ${mc.factionWinPct.blue}% — fair map.`);
  if (mc.bestPolicy === "rl") f.push(`⚠ EXPLOIT: self-play RL wins ${mc.policyWinPct.rl}% — it beats every hand-written strategy. The ruleset has a hole the heuristics never found.`);
  else if (mc.policyWinPct[mc.bestPolicy] >= 65) f.push(`⚠ ${mc.bestPolicy} leads at ${mc.policyWinPct[mc.bestPolicy]}% — aggressive openings favored; nerf candidates: capRate ↓, decay ↑.`);
  else f.push(`✓ No strong dominant strategy (best ${mc.bestPolicy} ${mc.policyWinPct[mc.bestPolicy]}%).`);
  if (mc.policyWinPct.rl !== undefined && mc.bestPolicy !== "rl") f.push(`◆ Self-play RL: ${mc.policyWinPct.rl}% (trained on the symmetric board — the transfer gap to this terrain is itself a finding).`);
  const turt = mc.policyWinPct.turtle;
  if (turt !== undefined && turt < 25) f.push(`◆ Pure turtling is non-viable (${turt}%) — it can't cross the ravine. Design call: give defense a path, or accept it.`);
  if (mc.siegeFiredPct === 0) f.push(`⚠ Siege never even fires (0%) — delay-tower + Wall too strong; lower batter cost or delayHold.`);
  else f.push(`Siege fires in ${mc.siegeFiredPct}% of games, wins ${mc.siegeWinPct}%.`);
  f.push(`Lead persistence ${mc.snowballPct}% / comeback ${mc.comebackPct}% — raise comeback aid to claw it back.`);

  $("mc-results").innerHTML = `
    <div class="mc-meta">${mc.total} matches · ${mc.policies.length}² matchups · ${ms}ms · seeded</div>
    <div class="findings">${f.map((x) => `<div class="finding ${x.startsWith("⚠") ? "warn" : x.startsWith("✓") ? "good" : ""}">${x}</div>`).join("")}</div>
    <h4>Win rate by strategy</h4>${mc.policies.map((p) => bar(p, mc.policyWinPct[p], p === mc.bestPolicy ? "hot" : "")).join("")}
    <h4>Faction fairness</h4>${bar("Red", mc.factionWinPct.red, "red")}${bar("Blue", mc.factionWinPct.blue, "blue")}
    <div class="mc-cols"><div><h4>Engagement</h4>
      <div class="stat"><b>${mc.snowballPct}%</b> lead persists</div><div class="stat"><b>${mc.comebackPct}%</b> comeback</div>
      <div class="stat"><b>${mc.avgLeadChanges}</b> lead changes</div><div class="stat"><b>${mc.deadTimePct}%</b> dead-time</div>
      <div class="stat"><b>${mc.siegeFiredPct}%</b> siege fires</div></div>
      <div><h4>Matchup matrix</h4>${matrix(mc)}</div></div>`;
}

// ---- controls + tabs ----
function buildControls() {
  $("btn-play").addEventListener("click", () => { running = !running; $("btn-play").textContent = running ? "⏸ Pause" : "▶ Play"; last = 0; });
  $("btn-restart").addEventListener("click", restart);
  $("speed").addEventListener("input", (e) => (speed = parseFloat(e.target.value)));
  const auto = $("auto-red"); auto.checked = autoRed;
  const sync = () => { $("red-bot").disabled = !autoRed; $("hint").style.display = autoRed ? "none" : "block"; };
  auto.addEventListener("change", () => { autoRed = auto.checked; sync(); });
  $("fog").addEventListener("change", (e) => (fog = e.target.checked));
  const rs = $("red-bot"), bs = $("blue-bot");
  for (const p of POLICY_NAMES) { rs.add(new Option(p, p)); bs.add(new Option(p, p)); }
  rs.value = redBot; bs.value = blueBot;
  rs.addEventListener("change", () => (redBot = rs.value)); bs.addEventListener("change", () => (blueBot = bs.value));
  for (const t of ["levers", "ledger", "playtest"]) $(`tab-${t}`).addEventListener("click", () => {
    for (const u of ["levers", "ledger", "playtest"]) { $(`tab-${u}`).classList.toggle("active", u === t); $(`panel-${u}`).classList.toggle("active", u === t); }
  });
  $("btn-mc").addEventListener("click", runPlaytest);
  sync();
}

if (board.meta) $("venue").innerHTML = `Field: <b>${board.meta.venue}</b> · real DEM (${board.meta.source}) · ${board.gatedEdges.length} terrain chokepoints`;
buildLevers(); buildClasses(); buildLedger(); buildControls();
// dev aid: #ff=300&fog=1 fast-forwards + toggles fog before drawing
const hp = new URLSearchParams(location.hash.slice(1));
if (hp.get("fog") === "1") { fog = true; $("fog").checked = true; }
const ff = parseInt(hp.get("ff") || "0", 10);
for (let i = 0; i < ff && !state.done; i++) step(state, controllers());
requestAnimationFrame(frame);
