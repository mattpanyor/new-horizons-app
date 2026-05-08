# Space Combat — Code Review Backlog

Snapshot of issues found in the combat feature. Two were shipped before pausing; the rest are queued in priority order. Numbering matches the original review delivered in chat.

## Shipped

- **#1** — Highlight POST race via `jsonb_set` (commit `d8b0740`)
- **#2** — Error handling + revert + toast on failed POSTs (commit `d32fb4a`)
- **#3** — Gate `AnimatedEnemyShip` mount to animation window only (commit `a079ddb`)
- **#5** — `HUDBezel` paths recompute on viewport resize (commit `3f155ff`)
- **#6** — `SceneErrorBoundary` around the 3D tree (commit `379b0c7`)

---

## Medium priority — pick up next

### #4 — Shadow-cost scales linearly with mesh count

After the redesign each battlecruiser is ~30 cast-shadow meshes. With 5 enemies + the player vessel that's ~150 meshes drawn into the 1024×1024 shadow map every frame. On low-end hardware this is the most likely framerate killer.

**Fix:** drop `castShadow` from small detail meshes (sensor masts, antenna spires, gun barrels, turret tips) — their shadows are too small to read at any zoom level anyway. Keep `castShadow` on the larger hull / wing / engine-housing meshes only.

**Files:** all of `components/combat/ships/*.tsx` and `components/combat/PlayerVessel.tsx`.

---

### #7 — Skybox texture not disposed on unmount + PMREM runs each mount

`useState(() => buildStarfield())` creates a 4096×2048 `CanvasTexture` on every Scene mount. The PMREM filtering inside drei's `<Environment>` happens on every mount too. On unmount nothing is disposed, leaving GPU memory dangling. Hot-navigating between routes that mount/unmount the combat board pays this cost repeatedly.

**Fix:** in `Scene.tsx`, return a cleanup function that calls `texture.dispose()` on the canvas texture. Optionally cache the canvas image data at module scope so re-mounts reuse the texture instead of repainting.

**Files:** `components/combat/Scene.tsx`, possibly `lib/combat/buildSkybox.ts`.

---

### #8 — Highlight write can land after End-Turn clear

A player can right-click aim → click to place; their POST is in flight when the commander hits End Turn. Server clears `weaponHighlights` and bumps `moveCount`. The player's POST then arrives and writes their slot in the new turn — stale highlight from the old turn shows up.

**Fix:** include the expected `moveCount` in the highlight POST body. In `app/api/combat/highlight/route.ts`, reject the write (return 409) if the server's current `moveCount` is higher than the request's. Cheap to add, closes the window.

**Files:** `app/api/combat/highlight/route.ts`, `components/game/SpaceCombatBoard.tsx`.

---

## Low priority — micro-waste / polish

### #10 — `StatusOverlay` 60 Hz `rAF` setState

The overlay starts pulsing opacity via `requestAnimationFrame` once any toggle is on; setState every frame triggers a React render at 60 fps continuously. Tiny delta but unnecessary.

**Fix:** drive the opacity via a CSS `@keyframes pulse` animation instead of JS rAF. No React renders, GPU-cheap.

**Files:** `components/combat/panels/StatusOverlay.tsx` + a small CSS keyframe in `app/globals.css` or a local style block.

---

### #11 — `AssemblySplash` connection-line loop is O(N²)

240 particles × 240 = ~57 k distance checks per frame during the splash. Each check has two `Math.hypot` calls. Heavy enough that low-end machines may stutter.

**Fix:** either spatial-hash the particles into a 30 px grid and only check neighbors in adjacent cells, or skip the connection-line pass entirely once `lockedness < 0.5` (lines are already invisible there). Simpler: drop `NUM_PARTICLES` from 240 → 150.

**Files:** `components/combat/AssemblySplash.tsx`.

---

### #13 — Two `prevX` in state patterns in the board

`prevPhase` and `prevMoveCount` are stored in state and compared during render to trigger resets. Works, but it's a known-tricky pattern; with the rest of the file this is now ~80 lines of derived-state setup before the JSX.

**Fix:** extract to a small custom hook, e.g. `useDerivedReset(value, onChange)`, that takes a value and a side-effect callback to run on change. Cleans up the board.

**Files:** new `hooks/useDerivedReset.ts` + `components/game/SpaceCombatBoard.tsx`.

---

### #14 — No optimistic-concurrency check on `enemy/[id]` PATCH and DELETE

If two GMs ever edit the same ship simultaneously, last-writer-wins. Spec currently assumes one GM, so this isn't load-bearing, but worth noting if the GM count ever changes.

**Fix:** pass expected `moveCount` in body, check in handler. Defer until multi-GM is on the table.

---

### #15 — `crypto.randomUUID()` in `handleAddConfirm` is browser-only

Won't run on SSR. Since `SpaceCombatBoard` is `"use client"` and the call is gated on a user click, this is safe in practice — flagged in case the code is ever ported to a server context.

---

### #16 — No throttling on rapid weapon-place clicks

A user spamming clicks during aim mode fires a POST per click; each click bumps `moveCount` on the server, churning polling traffic. Not abusive but inefficient.

**Fix:** small client-side throttle (e.g. 200 ms) on `postPlaceHighlight`.

**Files:** `components/game/SpaceCombatBoard.tsx`.

---

### #17 — `lib/games/spaceCombat.ts` is a thin re-export

Exists only to match the registry pattern. 5 lines of indirection.

**Fix:** leave as-is unless someone wonders why the file exists. Optionally inline into `lib/games/registry.ts`.

---

### #18 — Nested `<group>` for turret pairs adds matrix-update overhead

Each turret pair uses an outer `<group position>` with two child meshes. With ~5 pairs × ~6 ships = 30 extra groups in the scene graph; Three.js matrix recompute is per-group per frame.

**Fix:** not worth changing — readability win outweighs the negligible cost.

---

## Suggested execution order

1. **#4** (shadow-mesh diet)
2. **#7** (texture lifecycle)
3. **#8** (sync edge case)
4. **#10**, **#11**, **#13**, **#16** (polish)
