# The Forge — Territory & Bridges: design pass + balance findings

**A design sample for SEED's *Game Systems & Mechanics Designer* role.** The
posting is explicit: *"The output isn't code. It's a living design document,
playtest frameworks, balance logic, and rule structures that a production team
can execute against."* So this is that document — and the playable sandbox next
to it is the **playtest framework**, not the product.

The wedge: **you cannot cheaply playtest a 500-body, 90-minute game on a field.**
Every real test costs a field, a crowd, and full production. So the highest-value
thing a (remote) designer can deliver early is an **in-silico playtest** — model
one system, run it thousands of times, and read the balance off the aggregate
*before* anyone books a venue. That is exactly what this is.

I scoped it to **one system that interacts with itself**: territory control + a
resource economy + the **bridge** momentum mechanic. (Per the brief: small and
finished over big and rough.)

---

## 1. The system, in Forge terms

| The Forge (from the posting) | In this model |
|---|---|
| Territory control on GPS-mapped open terrain | A graph of **sectors**; hold one and it pays resource each tick |
| Resource economy | Owned sectors yield resource; resource builds bridges (and, in the full game, classes/sieges) |
| **Bridge-building that connects territories and shifts momentum** | A central **ravine** splits the field in two; a sector is reachable across it only once a faction spends resource on a **bridge** |
| Siege / Stronghold endgame | Each faction has a **stronghold**; enough sustained capture pressure takes it = instant win |
| Scoring across a 90-min session | Score = territory-held-over-time (+ a little banked resource); ~540 ticks ≈ 90:00 |
| Real-world travel across terrain | Squads **travel along edges at a finite speed** — distance is real (see §4) |

The bridge is the centrepiece on purpose: it's the Forge's signature momentum
lever, and it maps one-to-one onto the *voloks/portages* (trade-gating
chokepoints) in my own world-sim, **chitin-coast** — so this is a system I've
already reasoned about, rebuilt in your vocabulary.

---

## 2. The one rule that makes it a game: capture is **net pressure**

A sector flips toward `(attacker squads − defender squads) × captureRate` per
tick. Two consequences fall out of that single choice, and they *are* the game:

- **A stronghold can't be hard-locked by one body.** You take ground by
  *out-committing* the holder; the holder defends by committing back. Offense vs.
  defense becomes a real allocation problem with a fixed squad budget.
- **No eliminations.** You take ground by standing on it, not by removing people.
  This is a deliberate *festival-safe* choice — every attendee plays the full 90
  minutes, nobody gets benched. (Trade-off in the ledger.)

The other deliberate structural choice: **bridges are shared infrastructure.**
Once you build one, the enemy can cross it too. Your attack route is also your
exposure — so "should I be the one who pays for the bridge?" is a real decision,
not free upside.

---

## 3. The levers and the honesty ledger

Every lever is in the live UI with an **honesty ledger** entry — *intent*,
*trade-off*, and *failure mode*. That panel is the deliverable; here's the spine:

| Lever | Intent | Failure mode it guards against |
|---|---|---|
| Capture rate | make taking ground a real, timed action | too fast → flip-flop churn; too slow → first-mover locks the map |
| Resource yield | reward holding; fund bridges | too high → snowball; too low → dead economy |
| Bridge cost | make the momentum swing a commitment | too cheap → ravine stops mattering; too dear → two halves play solitaire |
| Travel speed | make space & positioning a skill | too slow → walking simulator; too fast → position is free |
| Siege threshold | give a decisive endgame | too low → turn-1 rush invalidates everything; too high → siege never fires |
| Squads / faction | set how many decisions a side juggles | too few → empty field; too many → micro soup |
| **Comeback aid** | rubber-band: the trailing side gets income | too high → the lead is meaningless; too low → snowball |
| Session length | fit the whole arc into 90 min | too short → pure rush; too long → victory-lap tail |

---

## 4. What the playtest actually found

Numbers below are from the headless Monte Carlo at **default levers** (~800
matches, all four bot strategies playing every matchup, seeded & reproducible).
They move a little run-to-run; the *shape* is the point.

**✓ The map is fair.** Faction win rate ≈ **Red 44 / Blue 49 / 7 tie** — within
noise of 50/50. (Getting here surfaced a genuine bug: equal-length paths all
tie-broke toward low-index = Red-side sectors, handing Blue a ~70/30 edge that
*looked* like a map problem. Fixed with tiny per-match edge jitter. A balance
tool's first job is to not lie to you.)

**✓ No single dominant strategy — but passivity loses.** Aggressive and
bridge-forward openings cluster at **~54–59%**, expander ~49%, and **pure
turtling craters at ~25%**. That's a healthy meta: several viable openings, and
"sit back and defend" is correctly punished.

**⚠ The siege endgame never fires (0%) under competent defense.** This is the
headline finding. Because defenders flood their stronghold to match attackers,
and there are no eliminations, a stronghold **cannot fall** at the default siege
threshold — the endgame lever is *inert*. You only make sieges possible by
dropping the threshold low enough to allow rushes, and when you do, the cost is
immediate: at threshold 100 sieges fire ~11% of the time **but the aggressive
opening jumps to ~65% win rate** — the rush eats the whole strategy game.

> **Open design question for the team:** a reachable siege endgame and a balanced
> strategy meta are in direct tension here. Resolving it needs a *third* lever
> the current model doesn't have — e.g. a siege "battering" resource sink,
> limited respawns, or attacker-supply decay — not just a threshold tweak. This
> is exactly the kind of thing you want to discover in a simulation for the price
> of nothing, not on a field with 500 people and a costumed GM waiting for an
> endgame that never triggers.

**Snowball is real but tunable.** At default comeback-aid (0.3) the early leader
wins ~**75%** of decided games. Slide comeback-aid up and snowball drops while
comeback% and lead-changes rise — the rubber-band trades "reward for early play"
against "the last 30 minutes still matter." That trade is a *product* decision
(how punishing should The Forge feel?), and the tool lets you dial it with data.

---

## 5. How this answers "how do you run remote playtests?"

This *is* the remote playtest loop:

1. The rules engine ([`sim/core.js`](sim/core.js)) is **decoupled from any
   screen** — the same `step()` runs the watchable match and the headless sims.
2. The bots ([`sim/bots.js`](sim/bots.js)) are four *distinct, legible*
   strategies, with seeded exploration so they're not optimautomata and so each
   seed plays out differently (real players aren't optimal either).
3. The Monte Carlo ([`sim/montecarlo.js`](sim/montecarlo.js)) answers the only
   questions that matter for balance: *is the map fair, is any strategy dominant,
   does the endgame fire, and is the match a contest or a procession?*

On-field playtests then validate against human behaviour and feed new numbers
back in. The sim narrows the search space so the expensive tests are few and
pointed.

## 6. Bridge to the hardware layer

The posting's tech stack (NFC / BLE / Firebase / React Native) is secondary, but
the model is built to meet it: **every capture is an event** with a contest
window — on the field that's an *NFC tap*; here it's a click. The whole match is
one serialisable `state` object, which is exactly what a **Firebase** real-time
sync would hold and what a **BLE/ESP-NOW** mesh would update from field readers.
I didn't fake hardware; I shaped the data model so the hardware drops in.

## 7. Honest limits of this abstraction

It models territory + economy + bridges + a siege endgame. It does **not** yet
model: player classes, the intel/fog layer, parley/diplomacy, physical
challenges, or true GPS terrain (the graph is a clean grid). Bots ≠ humans — they
establish the *structural* balance envelope, not the feel. These are the next
systems to layer in, each as its own small, instrumented model.

---

*Aliaskar Bekishev — github.com/Alyasska · alyasska.github.io · lyasskar@gmail.com*
