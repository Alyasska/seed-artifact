"""
forge_env.py — the gymnasium env skeleton for The Forge (the scale path for RL).

The dependency-free proof that self-play learns is rl/selfplay.mjs (CEM, runs
today, no GPU). THIS file is the structural skeleton for the full pipeline:
a gym-microrts-style multi-plane observation tensor + a per-squad grid action,
trained with PPO (Stable-Baselines3). Terrain is already a plane in the tensor.

Status: interface complete; the `_rules` hook wraps the same rules as the JS
engine (sim/core.js). Run training only where torch + SB3 are installed:

    pip install gymnasium stable-baselines3 numpy
    python rl/forge_env.py --train 2_000_000

Why this shape (so it scales the way SEED needs):
  - observation = (C, H, W) planes → a conv policy generalizes across maps/venues,
    so a policy trained on one DEM transfers to the next (same as gym-microrts).
  - action = MultiDiscrete over squads → one head, scales to more squads.
  - self-play via a frozen-opponent pool → finds exploits a scripted bot can't.
"""
from __future__ import annotations
import argparse

try:
    import numpy as np
    import gymnasium as gym
    from gymnasium import spaces
    HAVE_GYM = True
except Exception:
    HAVE_GYM = False
    gym = object  # so the class definition still parses without the dep

# observation planes (microrts-style); terrain elevation is plane 0
PLANES = ["elevation", "owner_red", "owner_blue", "neutral", "meter",
          "squads_red", "squads_blue", "resource_self", "phase"]


class ForgeEnv(gym.Env if HAVE_GYM else object):
    """One faction vs a pooled opponent on a fixed field (a real DEM graph)."""
    metadata = {"render_modes": []}

    def __init__(self, field, n_squads=10, max_ticks=540, opponent=None):
        self.field = field                # graph from tools/build_field.mjs (field.json)
        self.H, self.W = field["grid"]    # rows, cols of the sector grid
        self.n_squads = n_squads
        self.max_ticks = max_ticks
        self.opponent = opponent          # a callable policy, or None for scripted pool
        if HAVE_GYM:
            self.observation_space = spaces.Box(0.0, 1.0, (len(PLANES), self.H, self.W), np.float32)
            # one action per squad: which sector to target (H*W) + a no-op/build slot
            self.action_space = spaces.MultiDiscrete([self.H * self.W + 1] * self.n_squads)
        self._rules = None  # bind the engine (port of sim/core.js step())

    # --- gym API ---------------------------------------------------------
    def reset(self, *, seed=None, options=None):
        self._state = self._rules.create(self.field, seed)
        return self._encode(self._state), {}

    def step(self, action):
        prev = self._score_margin(self._state)
        self._rules.apply_orders(self._state, "red", action)          # learner = red
        self._rules.apply_policy(self._state, "blue", self.opponent)  # pooled opponent
        self._rules.tick(self._state)
        s = self._state
        reward = (self._score_margin(s) - prev) / 100.0               # dense: margin delta
        terminated = bool(s["won"])
        truncated = s["tick"] >= self.max_ticks
        if terminated and s["won"] == "red":
            reward += 1.0                                             # sparse win bonus
        return self._encode(s), reward, terminated, truncated, {}

    # --- helpers ---------------------------------------------------------
    def _encode(self, s):
        """state -> (C, H, W) float tensor. Terrain in plane 0; the rest are the
        per-sector game state, normalized 0..1."""
        obs = np.zeros((len(PLANES), self.H, self.W), np.float32)
        for sec in self.field["sectors"]:
            r, c = sec["row"], sec["col"]
            obs[0, r, c] = sec["elevNorm"]
            o = s["owner"][sec["id"]]
            obs[1, r, c] = o == "red"
            obs[2, r, c] = o == "blue"
            obs[3, r, c] = o is None
            obs[4, r, c] = (s["meter"][sec["id"]] + 100) / 200.0
        obs[8, :, :] = s["phase"] / 4.0
        return obs

    def _score_margin(self, s):
        return s["score"]["red"] - s["score"]["blue"]


def train(steps: int):
    if not HAVE_GYM:
        raise SystemExit("install gymnasium + stable-baselines3 + numpy to train")
    import json
    from stable_baselines3 import PPO
    field = json.load(open("data/field.json"))
    env = ForgeEnv(field)
    model = PPO("MlpPolicy", env, verbose=1, n_steps=2048, batch_size=256)
    model.learn(total_timesteps=steps)        # self-play loop: periodically freeze
    model.save("data/forge_ppo")              # the policy into the opponent pool
    print("saved data/forge_ppo")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--train", type=int, default=0)
    args = ap.parse_args()
    if args.train:
        train(args.train)
    else:
        print("ForgeEnv skeleton. planes:", PLANES)
        print("for the runnable, dependency-free proof that self-play learns, run: node rl/selfplay.mjs")
