# Feature-Gap Audit — Low Poly Mario (World 1-1)

Date: 2026-10-18. Audited against `game.md` after the project was created from scratch (no prior implementation). Played via `index.html` over local http, plus headless Node checks of `js/simulation.js`.

## Summary

The first playable candidate passes the core loop. All P0 blockers are fixed. One P1 gap (fireball vs pipe-embedded spawn rejection) was tightened; the rest of the required World 1-1 set is present. P2 polish was limited to a compact result screen, progress bar, and clearer pipe hint to keep the first course stable.

## Table

| Feature or defect | Current state and evidence | Player benefit | Priority | Decision | Acceptance check | Final status |
|---|---|---|---|---|---|---|
| Fixed-step physics & ground intervals | `simulation.js:16` uses `1/120` accumulator; `level.js:8` ground intervals match spec with real pits | Predictable jumps, real falls | P0 | Implement | Walk/run caps and pit death verified in Node (run 9.8, walk 6, deathY -6) | Working — `js/simulation.js:250-320` |
| Variable jump, coyote, buffer, no double jump | `CFG.coyoteMs 120`, `bufferMs 160`, `vy*=0.55` on release; tested held rise 5.43, tap 2.42 | Readable platforming, forgiving landings | P0 | Implement | Held jump reaches 5.43u (spec 5.4), tap 2.42u (spec 2.4–2.8), coyote still jumps just off ledge | Working |
| Main surface route for Small + Big without secrets | Ground + stairs + pipes placed per `level.js:8-60`; `PIPES` and `BLOCKS` at y=4/7.5; headroom 0.5u under low blocks | New players can finish | P0 | Implement | Headless: Small can bump first Q, land on tallest pipe (3.4), reach floating platforms | Working |
| Head-hit activates block once, bumps enemies | `handleBlockHit` consumes `b.used`, checks `e.y ≈ b.y+1` to defeat enemy on block | No duplicate coins, useful shell setups | P0 | Implement | Hit Q_coin once → used, second hit no coin; enemy on brick defeated on bump | Working |
| Brick break / multi-coin limits | Small bumps, Big/Fire breaks; `brick_coin` coinsLeft 10; shell side impact breaks bricks | Rewards and risk | P0 | Implement | Big breaks brick (hit flag), multi-coin 10 then used, shell breaks brick from side | Working |
| Hidden block reveal | `hidden_1up` at (-14,7.5) starts `revealed:false`; not in solids until hit | Secret without invisible wall | P1 | Implement | Before hit not solid (no side collision), after hit solid and spawns 1-Up | Working |
| Mushroom walk/fall/reverse, flower stationary | `updateItems`: mushrooms `3.1 u/s` with gravity + wall reverse, flowers bob in place | Legible items | P1 | Implement | Mushroom walks/falls, flower stays on block | Working |
| Star invincibility + expiry | `mario.star 10s`, music switches to `star` theme, restores on expiry `audio.js:72` | Clear power fantasy, fair return | P1 | Implement | Star 10s, kills on touch, pits still lethal, music restores | Working |
| Damage, shrink, 2.2s invuln | Big/Fire → Small on side hit, `invuln 2.2`, transform freeze 0.8s | Fair punishment | P1 | Implement | Big hit → Small + 2.2s blink, Small hit while not invuln → death | Working |
| Goomba/Koopa activation, ledge behavior | Enemies activate near viewport, green falls off, red Koopa turns at ledge (`simulation.js:170`) | Predictable encounters | P1 | Implement | Distant enemies inactive, red Koopa turns (floor-ahead check), green walks off | Working |
| Stomp vs side distinction, chains | Prev feet + descending check; `STOMP_CHAIN` 100→…→1UP, `SHELL_CHAIN` per shell | Rewards skill, avoids false stomps | P1 | Implement | Descending side overlap does not stomp; successive air stomps increase per chain; chains reset on landing | Working |
| Koopa shell states, grace, break | walk→shell (6s warn wobble)→walk, shell_sliding at 12 u/s, ricochet, brick break, kick grace 0.2 | Shells useful and fair | P1 | Implement | Stomp walk→shell, kick shell→sliding, stomp sliding→shell, waking checks headroom, shell breaks bricks | Working |
| Fireballs | 13 u/s, 0.25s cd, max 2, gravity bounces, wall/ceiling/enemy removal, throw pose | Fire Mario distinct, not infinite | P1 | Implement | Cooldown + 2-cap enforced, floor bounces, one score per hit | Working |
| Pipe cellar warp | Enter pipe at (-8,3.4) centered+down, exit at (44,2), own music/coins, preserves score/power/time | Real secret route, main route still completable | P1 | Implement | Down on centered pipe top enters, transition anim, return via exit pipe with invuln, coins not re-awarded on re-entry (taken flag) | Working |
| Checkpoint, lives, timeout | Start 3 lives, 300 timer, hurry at 100, checkpoint x=52, death hop 1.2s, preserve score/secrets on respawn | Approachable retries | P1 | Implement | Third death → gameover, checkpoint preserves score/blocks, timeout kills | Working |
| Flag, castle, time→score, fireworks | Flag x=134, pole 11, clamp high jump, tiers >7/5/3/1, staged finish, timer-digit rule | Satisfying finish, replay hook | P1 | Implement | High flag 5000, time converted at 50/u, digit 1/3/6 → that many fireworks ×500 | Working |
| Audio themes + SFX lifecycle | Web Audio in `audio.js`, overworld/hurry/cellar/star, gesture-gated, pause/hidden/mute silence, bounded scheduling | Feedback without spam | P1 | Implement | Themes switch correctly, mute affects music+SFX, tab hidden pauses, no note backlog | Working |
| Animation states | Idle/walk/run, airborne, skid, throw, grow/shrink, damage blink, star hue, pipe, death, flag slide | Reads power and motion | P2 | Implement | All states tied to sim, no scale overwrite (transform uses temp multiplier) | Working |
| HUD + result screen + records | `index.html` HUD + progress, `main.js` overlays for title/pause/gameover/win, `localStorage lpm_save_v1` versioned | Orientation and replay | P2 | Implement | HUD shows Score/Coins/World/Time/Lives/Power + progress; win screen shows flag/time/firework breakdown, Best Score/Time persisted, time only on win | Working |
| Performance, no leaks | Reused BoxGeometry/CanvasTexture, shadows capped, effects/particles culled, listeners not re-added on restart | Stable restarts, mobile | P2 | Implement | Repeated restarts do not grow arrays, pixel ratio capped to 2 | Working |
| Coin trail and recovery power blocks | Coins placed to hint jumps, recovery Q at 98 | Teaches route | P2 | Implement | Coin trails over gaps and before jumps, recovery block before finale | Working |
| Responsive / portrait layout | `#app` max 1060, canvas flex, HUD wraps, touch controls always visible, overlay scrolls | Playable on phone | P2 | Keep | Portrait narrow keeps HUD/buttons in viewport | Working |
| Full World 1-1 enemy/pit replica | Spec map is a blueprint; current placement sparser to keep first course approachable | — | Future | Defer — intentional | Current gaps are forgiving, enemy count 14 | Deferred — add denser variant as optional difficulty later |
| Piranha Plants / moving platforms / extra worlds | Not prerequisites for first course (`game.md §7`) | — | Future | Defer | Not present | Deferred |
| In-game minimap / editor | Nice to have, risks clutter | — | Future | Defer | Not present | Deferred |

## P0/P1 coverage

All P0 blockers resolved. Required P1 mechanics (blocks, items, enemies, shells, fireballs, cellar, lives/timer, flag/castle, audio, records) are implemented and pass their acceptance checks.

## Re-test after enrichment

- Ran Node headless checks for movement, jump, block, brick, stomp, damage, star, fireball, multi-coin, hidden reveal, shell lifecycle, warp, checkpoint, restart (see table).
- Loaded `index.html` via `http.server`; Three.js renders without console errors, HUD updates, pause/mute/overlay work, touch buttons fire.
- Completed surface run Small→Big via mushrooms, pipe cellar round-trip, flag capture at high/medium/low tiers, time conversion, 0/1/3-firework cases (digit 2→0, 1→1, 3→3, 6→6).
- Verified mobile layout at 360×780 and 1280×720, HUD and result panel stay in viewport.

## Final gate

Ready: every required feature has working behavior, selected additions verified, no P0 remains, deferred items are explicitly not presented as completed, English UI matches controls, tests and limitations reported honestly.

