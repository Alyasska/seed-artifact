To: erik@seedevents.org
Subject: re: The Forge — built you a piece of it

Hey Erik,

Following up on the Game Systems role. Instead of just pinging again I went and
built a slice of The Forge — show > tell.

It's a balance sandbox for one system (territory + bridges + player classes + a
siege endgame). Whole premise: you can't cheaply playtest a 500-person, 90-minute
field game, so I model one system and run thousands of matches headless to read
the balance *before* anyone books a venue. Same rules engine drives the live match
and the Monte Carlo — so it's a designer/GM pre-flight rig, not a toy.

live demo: https://alyasska.github.io/seed-artifact/   (live once Pages finishes building)
code: github.com/Alyasska/seed-artifact  (plain JS, no build step, runs on Pages)

A few things it already turned up, fwiw:

- self-play found an exploit my hand-written bots didn't. trained a policy from a
  blank genome up to ~100% vs the four heuristic bots (CEM — dependency-free; the
  gym-microrts/PPO skeleton's in the repo for the GPU version). that's the actual
  job of RL here btw — a better playtester, not flashy AI. a scripted bot pool
  would've called the ruleset balanced. it isn't.

- dropped the real Lake San Antonio DEM in (it's a LIB site — figured that's
  terrain Forge could actually run on). the reservoir splits the map into
  bridge-gated halves, and the same ruleset that's fine on a symmetric board goes
  aggressor-dominant (~80%) on that terrain. so balance isn't one-and-done —
  every venue wants its own pass. that's the recurring thing this does.

- pure turtling is non-viable (can't cross the ravine), siege fires but rarely
  wins so score usually decides. all tunable with sliders, each with an "honesty
  ledger" line — what the lever buys, what it costs, how it breaks.

honestly it's one system, scoped small — classes/intel/parley are designed but
only partly wired. but it's the deliverable shape your post asks for: living
design doc + balance logic + playtest frameworks, not just code.

end vision: this is the pre-flight for The Forge. tune economy / class weights /
phase timings per venue in sim, ship a near-balanced rulebook, and spend the
expensive on-field pilots validating how real humans behave — not finding out
turtling is broken with 500 people standing around.

would happily do a proper paid pilot pass on whichever system you want (I'd start
on the bridge/momentum layer). or just a call, whatever's easier.

attached: 1-pager + a few shots. resume was in the first email.

— Aliaskar
github.com/Alyasska · alyasska.github.io · lyasskar@gmail.com · +7 707 895 3139

---
ATTACH:
- Forge-Balance-Sandbox.pdf   <- the one to attach (2-page overview w/ visuals)
  (source: outreach/overview.html · text version: Forge-Balance-Sandbox-1pager.md)
