# Low Poly Mario — Course 1-1

A playable voxel browser platformer inspired by Super Mario Bros. World 1-1, rendered in 3D with Three.js (0.160.0 vendored in `vendor/`) and a fixed-timestep 2D simulation at `z = 0`.

## Launch

No build step, no account, no CDN at runtime required.

```bash
# from the project folder (where index.html lives)
python3 -m http.server 8000
# open http://localhost:8000/
```

Or double-click `index.html` directly (camera, physics and HUD work from `file://` as all dependencies are local).

**Entry point:** `index.html` — imports `js/main.js` via ES modules and `vendor/three.module.js`.

## Controls

| Input | Action |
|---|---|
| `A / D` or `← / →` | Walk |
| `Space`, `W`, or `↑` | Jump (hold for higher jump) |
| `Shift` or `X` (hold) | Run; also throw fireballs as Fire Mario |
| `S` / `↓` | Duck as Big/Fire Mario, or enter a pipe when centered on its top |
| `P` or `Esc` | Pause / Resume |
| `R` | Restart the entire run |
| `Enter` | Start, resume, or replay from overlays |

Touch buttons for left, right, jump, run/fire and down are at the bottom; movement can be held while jumping. Space always jumps — gaining a flower never steals the jump key.

## Objective

Run from `x ≈ -56` to the flag at `x = 134`, enter the castle at `x = 141`. Three secrets are hidden: a moving green 1-Up in a hidden block, a Star in a brick, and a pipe cellar. Every mandatory obstacle is passable without power-ups or secrets.

## Systems

- Fixed `1/120` simulation, `x` horizontal, `y` vertical, `z` depth. Mario feet at `mario.y`, sizes Small 1.6 / Big-Fire 2.5 / Duck 1.3.
- Variable jump, 120 ms coyote time, 160 ms jump buffer, no double jumps.
- Ground intervals `[-60,4]`, `[7,37]`, `[41,90]`, `[93,148]` with real pits (`deathY ≈ -6`), pipes at 2.0 / 2.8 / 3.4, stairs and multi-coin bricks.
- Adaptive power blocks (Small→Mushroom, Big/Fire→Flower), bricks (Small bumps, Big/Fire breaks, shells break from side), coins (100 = 1-Up).
- Goombas (1.65 u/s) and Koopas (green/red, red turns at ledges), shells with independent chains, fireballs (13 u/s, 0.25 s cooldown, max 2, gravity + bounce).
- Star 10 s invincibility, 2.2 s damage invuln, pipe cellar warp, checkpoint at `x = 52`, 300-unit timer with hurry at 100, flag-height bonuses, timer-digit fireworks (1→1, 3→3, 6→6), local best score/time, pause/mute/visibility handling.

## Validation

Headless logic checks (Node, no browser):

```bash
node -e "import('./js/simulation.js').then(...)"
# or run the checks listed in FEATURE_AUDIT.md
```

Manual browser checklist (see `FEATURE_AUDIT.md` §19): movement, jump, main route for Small+Big, blocks, items, enemies, shells, fireballs, progression, finish, records, audio, rendering, lifecycle.

## Structure

```
index.html        — entry, HUD, overlay, touch controls
vendor/three.module.js — Three.js 0.160.0
js/config.js      — physics + scoring constants
js/level.js       — ground, stairs, pipes, blocks, coins, enemies, scenery
js/input.js       — keyboard + touch, fresh-press handling
js/simulation.js  — fixed-step physics, collisions, entities, state machine
js/render.js      — Three.js scene, voxel meshes, camera, particles
js/audio.js       — Web Audio chiptune themes + SFX, mute/pause lifecycle
js/main.js        — boot, HUD wiring, game loop, inspection API (window.LPM)
```

`window.LPM.getState()` and `window.LPM.api` expose the inspection API for deterministic checks.

## Notes

- WebGL unavailable → friendly message, no crash.
- Audio and `localStorage` failures are caught and do not block play.
- Textures and audio are procedural; no external assets.

