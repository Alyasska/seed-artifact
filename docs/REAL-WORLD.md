# The Forge — how it actually runs in real life

The design isn't exotic. It repurposes tech that **festivals already deploy**, run
by exactly the crews SEED already fields. Here's the physical realization.

## 0. It piggybacks on proven festival tech

- **NFC wristbands** — LIB-scale festivals already strap an NFC band on every
  attendee for cashless payment. The Forge reuses that band as your *identity +
  faction + class.* No new wearable to invent.
- **RFID/NFC gates & timing mats** — marathons and ski lifts already count
  thousands of taps reliably. Sector capture is the same proven pattern.
- **On-site comms/power** — generators, distro, radio nets, sometimes Starlink:
  SEED already builds this for every festival. The Forge is one more load on it.

## 1. What's physically on the field

- **Sector totems (~24–36):** weatherproof post ~1.5 m, each with an **NFC/BLE
  reader**, an **LED ring** (shows who holds it), a **LoRa/ESP-NOW radio**, and a
  **LiPo + small solar** panel. This is the control point.
- **Strongholds:** bigger, staffed totems (a tent + marshal) — the siege targets.
- **The "ravine":** NOT people wading a creek. It's a **marked impassable
  boundary** — the real creek bank / a fence line / flagged tape — that marshals
  enforce. The terrain decides where it is; safety decides that you don't cross it
  except at a bridge.
- **Bridges:** designated **gate points** on that boundary. An Engineer "builds"
  one by holding the crossing totem + spending resource → its LED turns green →
  marshals open that gate for passage. Physical, safe, and the "shared bridge"
  rule is literal (the gate is open to everyone once built).
- **Delay towers / LED arrays:** big visible countdowns + scoreboard so 500
  people read the game state without staring at phones.
- **GM control tent:** the dashboard (= the sim's GM console) + PA.

## 2. What a player carries

- The **NFC wristband** (faction + class + crypto ID). Core play needs only this.
- The **app** (phone) — needed for the *rich* layer: fogged map, resource,
  class abilities, parley, intel. Playable-lite without a phone (tap + LED + PA).

## 3. The capture interaction, physically

Walk to a totem → **tap your band** (or just stand in its BLE range) → the totem
counts **presence per faction** → the **LED ring** fills toward the leading side →
**net pressure (attackers − defenders) flips it** → ring turns your color. Both
factions present = a visible standoff. Exactly the model the sim runs.

## 4. Connectivity — the real engineering problem (no cell on a field)

Totems form a **LoRa / ESP-NOW mesh** (off-the-shelf: Meshtastic-class). Messages
are tiny — `node7: red4 blue2` — so low bandwidth is fine over a big field. A few
**gateway nodes** bridge the mesh → a **local server** (+ Starlink/uplink) →
**Firebase** → the app. State is **server-authoritative** (anti-cheat); phones
cache and sync when in range, so a dead zone degrades gracefully.

## 5. Staffing & the GM — SEED's actual wheelhouse

- **Game Master** (costumed) at the control tent: narrates over PA/app, **triggers
  phases** (rings the siege bell), injects events (supply drop, a storm closing a
  region), sells/leaks intel, adjudicates parley. The live balance valve.
- **Region marshals:** safety, gate control, dispute resolution, hydration checks.
- This *is* SEED's core competency — personnel, crowd flow, comms, safety at
  festival scale. The game is a new payload on muscle they already have.

## 6. A session, end to end

1. **Bump-in:** crews place totems, GPS-map them, power/comms check.
2. **Onboarding:** players pick faction + class at a "barracks" tent, get a band,
   take a 2-minute tutorial.
3. **The 90-minute run:** GM-paced phases (land-grab → contact → momentum/parley →
   siege → final).
4. **Reset:** bands re-flashed, totems reset → next session. **3–4 sessions/day**
   = the recurring "experiential economy" SEED talks about.

## 7. Safety & festival reality (designed-in)

No eliminations (nobody benched, festival-safe). Heat/hydration marshals.
Accessibility: speed-light roles (**Quartermaster, Herald**) let players who can't
run rough ground still matter. Boundaries are marshaled, not assumed.

## 8. The honest hard parts (open questions a pilot must answer)

- **GPS is unreliable on a hill** → NFC taps are truth; GPS only softens fog.
- **Mesh reliability at 400 players** → gateway density + load test.
- **Tap-spoofing / cheating** → server-authoritative state + crypto bands.
- **Does "shared bridge" read clearly** to a player physically? Gate UX.
- **Cost per smart totem** at scale vs. the cheap phones-only pilot.

## 9. The pilot you actually run first (start small → scale)

- **~50 players, a regional park, 12 sectors.** Hardware = **phones + passive NFC
  tags** on posts (no smart totems yet) + **one portable hotspot/LoRa gateway** +
  Firebase + **one GM with a laptop.** Cheap. Proves the loop and the fun.
- **Then scale:** smart LED totems, LoRa mesh, 400 players, 4 factions, the full
  90-min arc with delay towers.

## 10. Why the sandbox sim is the point

You **cannot** iterate balance on a 400-person field — every run costs a venue, a
crowd, and the whole comms rig. So you tune economy / intel costs / phase timings /
class weights **in the sim**, ship a near-balanced ruleset, and spend the few
expensive real pilots **validating human behavior** — not discovering that
turtling is broken. The sim de-risks the physical event. That's the deliverable.
