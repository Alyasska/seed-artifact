# The Forge — game design v0.2 (mechanical detail)

A real-world, festival-scale strategy game. This version is built on the honest
real-world constraints (see `REAL-WORLD.md`): players are civilians, not gamers;
custom IoT at scale is fragile; the field has no infra; safety/crowd-flow lead.
So the structure is a **megagame**, not a swarm of smart totems.

> **What changed from v0.1 (the improvements):**
> 1. **Command layer added.** Strategy is run by ~8 **captains** per faction, not
>    by 150 phones. Foot soldiers follow squad leaders. The complex layer
>    (economy/intel/parley) lives at HQ.
> 2. **Capture is presence-by-pulse with caps**, not vague "tapping." Distinct
>    bodies, stacking-capped, with decay — which kills blobbing, turtling, and
>    one-runner-cheese in one move.
> 3. **Strongholds are invulnerable until the siege phase** → early rush is
>    impossible (the sim showed rush dominance; this is the structural fix).
> 4. **Battering** makes the siege endgame reachable (the "third lever" the sim
>    found missing): you need bodies *and* a supply dump.
> 5. **Sensing is decoupled from rules.** A capture event is the same whether it
>    comes from an NFC tap, a marshal's headcount, or a beacon. The design never
>    bets on one fragile tech.
> 6. Foot-soldier engagement via **physical carry** (supply / intel / bridge-kit
>    tokens) → escort & interception gameplay, not just walking.

## Baseline numbers (one real run)

- **~150 players / faction**, 2–4 factions · **12 sectors** + 2–4 strongholds ·
  **90-minute session** · economy resolved per **minute**, control per **10 s**.
- Resource unit = **Supply**. Pilot scales this down (60 players, 8 sectors).

---

## 1. Control & capture  (the core mechanic, with numbers)

Each sector has a **control meter** from **−100 (blue)** to **+100 (red)**.

- A **presence pulse** = a *distinct* faction badge registered at the station
  (tap, or marshal headcount). A pulse counts as "present" for **60 s** (re-tap to
  stay). Rate-limited: 1 pulse / badge / station / 20 s (anti-spoof).
- **Net presence** `P = (red present − blue present)`, weighted by class, **capped
  at ±5** (a 6th body adds nothing → forces spreading out, kills blobbing).
- **Meter step (per 10 s):** `ΔC = P × capRate`, `capRate = 6`.
  → a 3-net edge flips a neutral sector in ~**55 s**. Feels like a real push.
- **Flip** ownership at **±60** (hysteresis → no flicker around 0).
- **Decay:** uncontested sectors drift toward 0 at **3 / 10 s** → you can't hold
  the whole map passively; holding everything means spreading thin = exposed.
  (Anti-snowball + anti-turtle, built into one rule.)

This is exactly the net-pressure model already in the sim — these are its levers.

## 2. Command layer  (how 150 people are playable)

- Faction = **~8 captains (HQ)** + foot soldiers in **squads of ~10** under a
  **squad leader**.
- HQ issues **orders** ("Squad 3 → take sector D"); the squad leader's app shows
  the order + a compass arrow; foot soldiers just follow.
- **Order latency ≈ 30–60 s** (comms cost). You set *intent*, you don't
  micromanage. The mesh/app latency becomes a **designed constraint**, not a bug.

## 3. Economy  (Supply)

| Source | Rate |
|---|---|
| held sector | +10 / min |
| stronghold | +30 / min |
| Quartermaster on a sector | +50% that sector |
| **per-sector yield cap** | flat regardless of how many stack (anti-snowball) |

| Sink | Cost |
|---|---|
| Build bridge | **120** (~2–3 min income) |
| Recon report (reveal a region 2 min) | 20 |
| Comms jam (black out enemy region 3 min) | 80 |
| Battering (siege, phase 4) | 10 Supply → −1 enemy Wall |
| Rally / Dig-In ability fuel | 15 |

Decision: **tempo** (spend to expand) vs **bank** (save for siege) vs **comeback**.

## 4. Classes  (composition matters)

| Class | Presence weight | Move | Ability (cost / cooldown) |
|---|---|---|---|
| **Runner** | 0.5 | fast | **Scout**: reveal a region to HQ (free, 60 s cd); carries intel chits 2× |
| **Anchor** | **2.0 def / 1.0 atk** | slow | **Dig In**: +50% defensive ΔC on this sector 90 s (15 Supply, 4 min cd) |
| **Engineer** | 1.0 | normal | **Build/Sabotage bridge** (kit + 120 Supply; sabotage closes one 3 min, 1×) |
| **Quartermaster** | 1.0 | normal | +50% yield on their sector; carries 2× supply tokens |
| **Herald** | 1.0 | normal | **Parley** (open a deal channel); **Rally**: +1 ally presence here 60 s (15, 5 min cd) |

All-Anchor can't take ground (atk 1.0, slow); all-Runner can't hold (0.5). Forces a mix.

## 5. Intel warfare  (physical + concrete)

- HQ map is **fogged**: a sector's control is known only if you're present **or**
  scouted it in the last **2 min**.
- **Scout** (Runner) / **Recon report** (20 Supply) reveal.
- **Intel chits**: a held sector drops a physical "sigint" token every **3 min**;
  a Runner carries it to HQ → cash for a reveal or +5 Supply → **escort &
  interception** gameplay for foot soldiers.
- **Comms jam** (80): an enemy region goes dark on their map 3 min (captains blind).
- **Deception**: don't tap when passing → stay hidden; Herald can plant a **feint
  flag** that shows false activity to scouts.

## 6. Bridges

Fixed crossing gates, closed by default. **Build** = Engineer present + bridge-kit
prop (carried from HQ) + 120 Supply → marshal opens it; **shared** (anyone
crosses). **Sabotage** closes it 3 min. Opens a flank → shortens the path to enemy
ground → momentum swing.

## 7. Siege & endgame  (reachable, paced)

- Strongholds have **Wall = 100** and are **uncapturable while Wall > 0** AND only
  batterable in **Phase 4** (so no early rush — the structural fix).
- **Delay tower:** before you may batter a stronghold you must **hold a nearby
  delay tower for 3 continuous minutes** ("lower the drawbridge"). Paces the
  endgame, stops a chaotic instant rush.
- **Battering:** with net presence at the stronghold, pour Supply: **10 → −1
  Wall**. At Wall 0 it's capturable by control. Taking it = **+50** + the region's
  income; holding ALL enemy strongholds = instant win.

## 8. Parley & diplomacy

Heralds open a **deal channel** between HQs: truce (no contest on a named sector
for N min), trade (Supply/intel), or a **gang-up** on the leader. GM adjudicates;
**betrayal allowed**. Social rubber-band when 3–4 factions.

## 9. Scoring

Per minute: **+1 / held sector, +3 / stronghold.** Objectives: GM supply-drop
**+15**, intel chit cashed **+2**, bridge built **+5**, stronghold captured **+50**.
Highest at 90 min wins (or hold-all-strongholds = instant). Live on the LED board.

## 10. The 90-minute arc  (concrete triggers)

| Time | Phase | Unlocks / events |
|---|---|---|
| 0–15 | **Muster & landgrab** | strongholds safe; neutrals open; income ramps |
| 15–45 | **Contact** | bridges buildable; intel war; GM drops a supply crate midfield |
| 45–70 | **Escalation** | comms-jam + parley unlock; GM drops a high-value objective; leader visible → gang-up pressure |
| 70–90 | **Siege** | GM **rings the bell** → Walls batterable; delay towers gate strongholds |

GM **balance valve**: if a faction's lead > threshold, GM posts a **bounty** —
that faction's sectors worth 2× to capture. Transparent, designed rubber-band.

## 11. Anti-degenerate design  (the levers ↔ the failure modes)

| Failure | The rule that prevents it |
|---|---|
| **Blob** (pile on one point) | ±5 presence cap + per-sector yield cap |
| **Turtle** (sit and hold) | uncontested decay + territory-over-time scoring |
| **Rush** (early stronghold kill) | strongholds invulnerable until Phase 4 |
| **Snowball** (leader runs away) | yield cap + decay (must spread thin) + GM bounty + parley gang-up |
| **Runner-cheese** (one cycler holds map) | control needs *distinct present bodies* (quorum) |

## 12. Edge cases & rulings

- Net 0 on a sector → meter holds, slow-decays. Hysteresis stops flicker.
- **Station offline** → marshal falls back to paper headcount; control tent
  reconciles. (Graceful degradation — the decoupling point.)
- Dead phone / lost band → marshal taps the player in manually; foot soldiers
  never strictly need a phone.
- Faction-switching / spectators → badges faction-locked at onboarding.

## 13. Why this is the sim's job

Every number above is a **lever**: capRate, presence cap, yields, sink costs, Wall,
battering rate, phase timings, class weights, bounty threshold. You cannot tune 13
interacting levers on a 150-person field. You tune them in the sandbox
(Monte-Carlo + RL self-play), ship a near-balanced rulebook, and spend the real
pilots on what the sim can't see: whether civilians have fun.
