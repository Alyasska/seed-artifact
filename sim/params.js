// The Forge v0.2 — levers, classes, phases. ONE source of truth for the sliders,
// the sim, and the honesty ledger. Numbers are the game-design defaults from
// docs/GAME-DESIGN.md (control per 10 s tick; economy per minute = 6 ticks).

export const TICK_SECONDS = 10;
export const TICKS_PER_MIN = 60 / TICK_SECONDS; // 6

// ---- balance levers (the tunable dials) ----------------------------------
export const LEVERS = {
  capRate: {
    label: "Capture rate", help: "Meter change per net body per 10 s tick.",
    min: 1, max: 20, step: 1, default: 6, unit: "/net",
    ledger: { intent: "Make taking a sector a ~minute-long push, not an instant flip.",
      tradeoff: "Fast = raid-y, map churns; slow = ground sticks, positioning matters.",
      failure: "Too fast → sectors flicker; too slow → first-mover locks the map." },
  },
  presenceCap: {
    label: "Presence cap", help: "Max net bodies that count on one sector (the anti-blob cap).",
    min: 2, max: 12, step: 1, default: 5, unit: "bodies",
    ledger: { intent: "Stop one giant blob from steamrolling — and stop dangerous crushes.",
      tradeoff: "Low cap spreads people into fronts; high cap rewards deathball.",
      failure: "Too high → one stack wins everything; too low → numbers stop mattering." },
  },
  decay: {
    label: "Uncontested decay", help: "Meter drift back toward 0 when nobody contests, per tick.",
    min: 0, max: 10, step: 1, default: 3, unit: "/tick",
    ledger: { intent: "You can't hold the whole map passively — ground you leave slips.",
      tradeoff: "High decay punishes overreach; low decay lets you bank territory and turtle.",
      failure: "Too high → nothing stays held; too low → take-and-forget turtling." },
  },
  yieldNormal: {
    label: "Sector yield", help: "Supply/min from a held sector (stronghold = 3×).",
    min: 2, max: 30, step: 1, default: 10, unit: "/min",
    ledger: { intent: "Reward holding ground; fund bridges, intel, and sieges.",
      tradeoff: "More yield = faster everything, including the leader pulling ahead.",
      failure: "Too high → snowball; too low → sinks are unaffordable, nothing happens." },
  },
  bridgeCost: {
    label: "Bridge cost", help: "Supply for an Engineer to open a ravine gate.",
    min: 20, max: 400, step: 10, default: 120, unit: "Supply",
    ledger: { intent: "Make opening a new front a real commitment.",
      tradeoff: "A bridge is SHARED — the enemy crosses it too.",
      failure: "Too cheap → ravine stops mattering; too dear → two halves play solitaire." },
  },
  batterRate: {
    label: "Battering rate", help: "Stronghold Wall removed per 10 Supply poured (siege phase).",
    min: 0.2, max: 5, step: 0.2, default: 1, unit: "/10sup",
    ledger: { intent: "Make the siege endgame REACHABLE — bodies AND a supply dump.",
      tradeoff: "Fast battering = decisive, scary; slow = sieges are rare set-pieces.",
      failure: "Too fast → a rich faction buys a stronghold; too slow → sieges never finish." },
  },
  comebackAid: {
    label: "Comeback aid", help: "Bonus Supply for whichever faction is behind (rubber-band).",
    min: 0, max: 0.8, step: 0.05, default: 0.3, unit: "×behind",
    ledger: { intent: "Keep the last 30 minutes alive for the trailing side.",
      tradeoff: "Negative feedback fights snowball but softens the reward for early play.",
      failure: "Too high → the lead is meaningless; too low → decided by minute 30." },
  },
  squadCount: {
    label: "Squads / faction", help: "Units per faction (each ≈ a 10-player field squad).",
    min: 4, max: 16, step: 1, default: 10, unit: "",
    ledger: { intent: "Set how many fronts a faction can run at once.",
      tradeoff: "Few = chess; many = logistics, attention is the bottleneck.",
      failure: "Too few → empty field; too many → micro soup." },
  },
  orderLatency: {
    label: "Order latency", help: "Ticks before an HQ order reaches a squad (comms cost).",
    min: 0, max: 8, step: 1, default: 2, unit: "ticks",
    ledger: { intent: "You command intent, not micro — the mesh/app delay is a real constraint.",
      tradeoff: "Low = crisp control; high = you must pre-position and trust squads.",
      failure: "Too high → orders arrive stale, captains lose the field." },
  },
  sessionTicks: {
    label: "Session length", help: "Match length in 10 s ticks (540 ≈ the 90-minute session).",
    min: 180, max: 900, step: 60, default: 540, unit: "ticks",
    ledger: { intent: "Fit the whole arc (muster → contact → escalation → siege) in 90 min.",
      tradeoff: "Short = punchy, snowbally; long = comebacks possible, late game can sag.",
      failure: "Too short → pure rush; too long → decided early, the rest is a lap." },
  },
};

export function defaultParams() {
  const p = {};
  for (const k of Object.keys(LEVERS)) p[k] = LEVERS[k].default;
  return p;
}

// ---- player classes ------------------------------------------------------
// presence weight is what the control meter actually reads; def = when standing
// on a sector your faction owns (you're the defender).
export const CLASSES = {
  runner:       { label: "Runner",       atk: 0.5, def: 0.5, speed: 1.6, color: "#8fd6ff", role: "scout / intel" },
  anchor:       { label: "Anchor",       atk: 1.0, def: 2.0, speed: 0.6, color: "#e8c34a", role: "hold ground" },
  engineer:     { label: "Engineer",     atk: 1.0, def: 1.0, speed: 1.0, color: "#d98a4a", role: "bridges" },
  quartermaster:{ label: "Quartermaster",atk: 1.0, def: 1.0, speed: 1.0, color: "#7ad6a0", role: "+50% yield" },
  herald:       { label: "Herald",       atk: 1.0, def: 1.0, speed: 1.0, color: "#c79bf2", role: "rally / parley" },
};
// default faction composition, cycled to fill squadCount squads.
export const COMPOSITION = ["anchor", "runner", "engineer", "quartermaster", "anchor", "runner", "herald", "anchor", "runner", "quartermaster"];

// ---- the 90-minute arc ---------------------------------------------------
// fractions of the session; gates what is unlocked.
export const PHASES = [
  { key: 1, name: "Muster & landgrab", frac: 0.0,  note: "strongholds safe · grab neutral ground" },
  { key: 2, name: "Contact",           frac: 1 / 6, note: "bridges buildable · intel war begins" },
  { key: 3, name: "Escalation",        frac: 1 / 2, note: "comms-jam + parley · leader gets ganked" },
  { key: 4, name: "Siege",             frac: 7 / 9, note: "siege bell · Walls batterable · delay towers" },
];
export function phaseOf(tick, maxTicks) {
  const f = tick / maxTicks;
  let cur = PHASES[0];
  for (const p of PHASES) if (f >= p.frac) cur = p;
  return cur;
}

// ---- internal constants (not player-facing levers) -----------------------
export const CONST = {
  flip: 60,           // |meter| to flip ownership (hysteresis around 0)
  meterMax: 100,
  strongholdWall: 100,
  delayHoldTicks: 18, // 3 min holding the delay tower before you may batter
  strongholdYieldMult: 3,
  quartermasterBonus: 0.5,
  scorePerSectorMin: 1,
  scorePerStrongholdMin: 3,
  scoreSiege: 50,     // capturing an enemy stronghold
};

// structural ledger (rules that aren't sliders)
export const STRUCTURAL_LEDGER = [
  { rule: "Presence by pulse", intent: "Control = distinct bodies seen recently (a tap lasts 60 s). Robust on real hardware AND makes holding an active job.",
    tradeoff: "Adds a 're-tap to hold' rhythm; rewards patrolling over camping.",
    failure: "If presence were a one-time claim, a single runner could 'own' the map." },
  { rule: "Strongholds invulnerable until Siege", intent: "No early rush can end the game; the economy/territory game gets to happen first.",
    tradeoff: "The endgame is back-loaded into one tense phase.",
    failure: "Without it, a turn-1 rush invalidates every other system (the sim proved this)." },
  { rule: "Battering + delay tower", intent: "A stronghold falls only to bodies + a supply dump + holding the delay tower 3 min — a reachable but earned endgame.",
    tradeoff: "Several conditions to line up; the GM paces it with the siege bell.",
    failure: "A high Wall alone is unreachable under competent defense (the missing third lever)." },
  { rule: "Sensing decoupled from rules", intent: "A capture event is the same whether it's an NFC tap, a marshal headcount, or a beacon.",
    tradeoff: "The model is abstract about *how* presence is sensed.",
    failure: "Betting the design on one fragile sensing tech is how field games die." },
];
