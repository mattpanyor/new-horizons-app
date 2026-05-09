# Space Combat — Implementation Plan

A turn-based 3D space combat **visualizer** for verbal D&D sessions. The app provides a shared tactical scene; combat resolution itself is verbal and lives outside the app. This document is the build plan, not a feature spec.

Branch: `feat/space-combat`. Integrates as a new `gameType` in the existing `/game` minigame system.

---

## 1. Concept summary

- 3D scene with the **player vessel locked at origin** (always frigate-class, never rotates, bow always points north = +X).
- **Camera** orbits/zooms freely around origin per user — never controlled by the app, never auto-moved.
- **5 range shells** around the player (`up-close`, `close`, `medium`, `far`, `very-far`) on which enemies sit.
- **6 face directions** (`bow`, `stern`, `port`, `starboard`, `dorsal`, `ventral`) used as visibility filters by players and as "which face of the enemy points at the player" for enemy facing.
- **Two phases** per turn: **player phase** (passive viewing/measurement, only the commander can advance) → **GM phase** (admin-grade user spawns/moves/deletes enemies with staged-until-commit semantics) → animations play → repeat.
- Enemy ships are dumb objects: position on a shell, facing relative to player, size class, label, faction. No HP/shields/weapons in-app.
- **Weapon highlights** (per-player measurement cones/cylinders) sync to other players via DB polling, rendered in each user's color from `users.color` (fallback white when null).
- Combat session is launched from the existing `/admin/games` panel and ends when an admin presses **Stop** (existing pattern). All clients return to the `/game` lobby on stop.

### Visual style (key aesthetic decision)

- **Player vessel**: streamlined, **curvy** silhouette — stretched ellipsoid hull with sharp cone tips fore and aft. Reads as deliberate, sleek, "ours".
- **Enemy vessels**: **angular** silhouettes — rhomboids (octahedra), pyramids (4-sided cones), tetrahedra. **No boxes, no 90° corners, no perfectly axial geometry**. Reads as alien, threatening.
- **Object class** (debris/shuttles/etc.): a single small angular shape, label-differentiated.
- All ship models are **composed from Three.js primitives in code** — no external GLB assets, no Blender, no asset pipeline. Each ship class is a small React component (~30–80 lines of R3F JSX).

---

## 2. Stack additions

### New dependencies

> Per memory: explain packages before installing, await user approval. **Do not** run `npm install` until the user confirms.

| Package | Purpose | Notes |
|---|---|---|
| `three` | Core 3D library | Peer dep of R3F |
| `@react-three/fiber` | React renderer for Three.js | Declarative scene graph |
| `@react-three/drei` | Helpers (`OrbitControls`, `Html`) | Saves writing those from scratch |

No GLTF loader needed (no `three-stdlib`, no `useGLTF`) since ships are built from primitives.

### Static assets

`public/combat/skybox.svg` — space backdrop, rendered as a large textured sphere inside the scene. The only static asset.

No ship GLBs, no `public/combat/ships/`, no asset licensing concerns.

---

## 3. Architecture: integration with `/game`

The combat scene plugs into the existing minigame architecture as a new `gameType`. No infrastructure changes; reuses the single-active-game pattern, the 2s polling loop, the admin panel's create/launch/stop flow, and the `moveCount`-based animation driver pattern (already used by `arcane-card` and `isolation-protocol`).

### Files modified

| File | Change |
|---|---|
| `types/game.ts` | Add `SpaceCombatConfig`, `SpaceCombatState`, extend `GameType` / `GameConfig` / `GameState` unions |
| `lib/games/registry.ts` | Register `space-combat` in `GAME_REGISTRY` (label, default config/state, victoryText is N/A but provide stub) |
| `components/game/gameComponents.ts` | Register `SpaceCombatBoard` in `GAME_COMPONENTS` |
| `components/admin/GamesPanel.tsx` | Add `formGameType === "space-combat"` config branch (commander dropdown only, no Kanka opponent) |
| `app/api/admin/games/route.ts` | Add `space-combat` branch in POST/PUT for config validation |
| `lib/db/schema.sql` | No table changes — combat state lives in existing `game_sessions.state` JSONB |

### Files added

```
lib/combat/
  playerShip.ts          # Hardcoded player vessel config (color, weapon list)
  ranges.ts              # 5 named shell radii + display labels
  sizeClasses.ts         # 6-entry size→component+scale table
  faces.ts               # 6 face vectors + display labels
  factions.ts            # Faction list { id, displayName, color } — GM edits this directly
  visual.ts              # Animation duration/easing, blink period, opacity stops
  statusText.ts          # Compose status text from local toggles
  spaceCombat.ts         # Game-handler module (default config/state, validators)

lib/games/spaceCombat.ts # Wraps lib/combat/spaceCombat.ts to match registry contract

components/combat/
  SpaceCombatBoard.tsx   # Top-level board component (entry from /game)
  Scene.tsx              # R3F <Canvas> + camera + skybox + scene root
  PlayerVessel.tsx       # Centered hero ship — composed primitives, curvy
  Skybox.tsx             # Background sphere
  RangeShell.tsx         # Toggleable dotted sphere
  WeaponVolume.tsx       # Cone/cylinder/wide-cone with effectiveness gradient
  WeaponAimGhost.tsx     # Cursor-follow preview during aim mode
  StagingGhost.tsx       # Red silhouette + distance line during GM staging
  ships/
    Corvette.tsx         # Angular: small octahedron + tetrahedral fins
    Frigate.tsx          # Angular: rhomboid hull + double-pyramid prow
    Destroyer.tsx        # Angular: stacked rhomboids, longer profile
    Cruiser.tsx          # Angular: composite of pyramids + rhomboids
    Battlecruiser.tsx    # Angular: largest, fused-pyramids spine
    ObjectShip.tsx       # Single small angular fragment
  panels/
    PlayerPanel.tsx      # Left side: face / range / weapon buttons
    GMPanel.tsx          # Right side: Add (gm phase) + selected-ship editor
    StatusOverlay.tsx    # Top-of-screen blinking status text (local-only)
    EndTurnButton.tsx    # Bottom-center, gated by phase + role
    AddShipModal.tsx     # GM "Add Ship" modal: layer + size + faction

app/api/combat/
  highlight/route.ts     # POST: player toggles their own weapon highlight slot
  end-turn/route.ts      # POST: commander or GM advances phase + commits staged moves
  enemy/[id]/route.ts    # PATCH (label/faction immediate edit), DELETE (immediate, both phases)

hooks/
  useCombatScene.ts      # Reads polled session, splits into local vs synced state
  useCombatStaging.ts    # GM-only: client-side staging buffer for adds/moves/edits
```

---

## 4. Data model

### `SpaceCombatConfig` (JSONB in `game_sessions.config`)

```ts
interface SpaceCombatConfig {
  commanderUsername: string;     // designated commander, set at config time
  label?: string;                // optional free-text scenario name for admin display
  opponentEntityId: null;        // unused, kept null for GamesPanel uniformity
}
```

GM identity is **implicit**: any user with `accessLevel >= 127` is the GM. Currently one such user. Server-side auth checks accessLevel rather than reading from config.

### `SpaceCombatState` (JSONB in `game_sessions.state`)

```ts
type RangeBand = "up-close" | "close" | "medium" | "far" | "very-far";
type Face = "bow" | "stern" | "port" | "starboard" | "dorsal" | "ventral";
type SizeClass =
  | "corvette" | "frigate" | "destroyer" | "cruiser" | "battlecruiser"
  | "object";

interface EnemyShip {
  id: string;                     // uuid generated at spawn
  sizeClass: SizeClass;
  label: string;                  // editable by GM, free text
  factionId: string | null;       // references lib/combat/factions.ts; null → render white
  range: RangeBand;
  azimuthDeg: number;             // 0..360, 0 = north (= +X), increases clockwise from above
  elevationDeg: number;           // -90..90, 0 = equator, +90 = directly above player
  facing: Face;                   // which face of the enemy points at the player
}

// Per-user placed weapon highlight. Aim-mode preview is local-only.
interface PlacedHighlight {
  weaponId: string;               // matches a weapon id in playerShip.ts
  axis: { x: number; y: number; z: number };  // unit vector from origin
}

interface SpaceCombatState {
  phase: "player" | "gm";
  enemies: EnemyShip[];
  weaponHighlights: Record<string, PlacedHighlight | null>;  // username → slot
  moveCount: number;              // strictly increasing, drives animation
  prevEnemies?: EnemyShip[];      // snapshot from BEFORE the most recent End Turn,
                                  // used by clients to interpolate animation
}
```

### Initial state (returned by `getDefaultState`)

```ts
{
  phase: "gm",                    // GM's first turn — they spawn the encounter
  enemies: [],
  weaponHighlights: {},
  moveCount: 0,
}
```

---

## 5. Hardcoded configs (full list)

These ship in code, not the DB.

### `lib/combat/ranges.ts`

```ts
export const RANGES = [
  { id: "up-close",  radius: 4,  label: "up-close range" },
  { id: "close",     radius: 8,  label: "close range" },
  { id: "medium",    radius: 14, label: "medium range" },
  { id: "far",       radius: 22, label: "far range" },
  { id: "very-far",  radius: 32, label: "very far range" },
] as const;
```

Camera zoom clamp: `min ≈ 2` (just outside player ship hull), `max ≈ 42` (very-far × 1.3).

### `lib/combat/sizeClasses.ts`

| id | scale | Component | displayName |
|---|---|---|---|
| `corvette` | 0.7 | `<Corvette />` | Corvette |
| `frigate` | 1.0 | `<Frigate />` | Frigate |
| `destroyer` | 1.4 | `<Destroyer />` | Destroyer |
| `cruiser` | 1.9 | `<Cruiser />` | Cruiser |
| `battlecruiser` | 2.6 | `<Battlecruiser />` | Battlecruiser |
| `object` | 0.4 | `<ObjectShip />` | Object |

(Scales tuned at first paint; numbers above are starting values.)

### `lib/combat/faces.ts`

| id | axis (player frame) | displayLabel |
|---|---|---|
| `bow` | +X | bow |
| `stern` | −X | stern |
| `port` | −Y | portside |
| `starboard` | +Y | starboard |
| `dorsal` | +Z | dorsal |
| `ventral` | −Z | ventral |

Coordinate convention: **right-handed, Z-up** in scene logic; expressed in Three.js's Y-up by rotating the scene root or by remapping during render. Doesn't matter mechanically — pick once and stay consistent. Recommendation: use Three.js Y-up natively, label "north" = `+X` in screen-space when camera starts top-down.

### `lib/combat/factions.ts`

```ts
export const COMBAT_FACTIONS = [
  { id: "imperial", displayName: "Imperial", color: "#7c3aed" },
  { id: "pirate",   displayName: "Pirate",   color: "#dc2626" },
  { id: "civilian", displayName: "Civilian", color: "#94a3b8" },
  // GM edits this file to add/rename/recolor factions
] as const;

export const DEFAULT_NO_FACTION_COLOR = "#ffffff";

// Resolver — used by all components rendering an enemy:
export function resolveFactionColor(factionId: string | null): string {
  if (!factionId) return DEFAULT_NO_FACTION_COLOR;
  const f = COMBAT_FACTIONS.find((x) => x.id === factionId);
  return f?.color ?? DEFAULT_NO_FACTION_COLOR;  // also white if id no longer exists
}
```

Decoupled from `lib/allegiances.ts` so the user has narrative freedom for combat-specific factions without entangling site-wide allegiances.

### `lib/combat/playerShip.ts`

```ts
export const PLAYER_SHIP = {
  color: "#5a8fb0",               // base hull color, single value
  accentColor: "#1a2030",         // for cone tips, panel details
  engineColor: "#4488ff",         // emissive engine glow
  weapons: [
    {
      id: "pulsar-swarm",
      displayName: "Pulsar Swarm",
      shape: "cone",
      coneHalfAngleDeg: 25,
      maxRange: "far",
      effectiveness: { /* 0..1 per range band, drives gradient stops */
        "up-close": 1.0, "close": 0.85, "medium": 0.6, "far": 0.3, "very-far": 0,
      },
    },
    {
      id: "graviton-lance",
      displayName: "Graviton Lance",
      shape: "cylinder",
      cylinderRadius: 0.5,
      maxRange: "far",
      effectiveness: {
        "up-close": 1.0, "close": 1.0, "medium": 1.0, "far": 1.0, "very-far": 0,
      },
    },
    {
      id: "torpedoes",
      displayName: "Torpedoes",
      shape: "wide-cone",
      coneHalfAngleDeg: 55,
      maxRange: "very-far",
      effectiveness: {
        "up-close": 0.2, "close": 0.85, "medium": 1.0, "far": 0.9, "very-far": 0.5,
      },
    },
  ],
} as const;
```

Add more weapons later by appending to this list. Player UI auto-generates one weapon button per entry.

### `lib/combat/visual.ts`

```ts
export const VISUAL = {
  endTurnAnimMs: 800,
  endTurnAnimEase: "easeInOutCubic",
  blinkPeriodMs: 2000,
  blinkOpacityMin: 0.5,
  blinkOpacityMax: 1.0,
  rangeShellDotCount: 220,        // sparse Fibonacci-sphere distribution
  rangeShellDotSize: 0.06,
  rangeShellDotColor: "#ffffff",
  weaponVolumeBaseOpacity: 0.18,
  defaultUserColor: "#ffffff",    // when users.color is null
  stagingGhostColor: "#ef4444",
  stagingDistanceLineColor: "#ef4444",
  stagingDistanceLineWidth: 1.5,
} as const;
```

### `lib/combat/statusText.ts`

```ts
function compose(face: Face | null, range: RangeBand | null,
                 weapon: { id: string; phase: "aiming" | "locked" } | null): string[] {
  const lines: string[] = [];
  const faceLabel  = face  ? FACES[face].displayLabel : null;
  const rangeLabel = range ? RANGES.find(r => r.id === range)!.label : null;

  if (faceLabel && rangeLabel) lines.push(`Looking at ${faceLabel} at ${rangeLabel}`);
  else if (faceLabel)          lines.push(`Looking at ${faceLabel}`);
  else if (rangeLabel)         lines.push(`Looking at ${rangeLabel}`);

  if (weapon) {
    const name = PLAYER_SHIP.weapons.find(w => w.id === weapon.id)!.displayName;
    lines.push(weapon.phase === "aiming" ? `Aiming ${name}` : `${name} locked in`);
  }
  return lines;
}
```

### Ship visual style guide

**Player vessel** (`PlayerVessel.tsx`):
- Body: stretched ellipsoid via `<sphereGeometry>` + non-uniform scale (e.g. `[3, 0.7, 1.2]` along bow × dorsal × beam)
- Bow tip: thin elongated cone (`coneGeometry`, ~32 radial segments for smoothness), merged at +X end
- Stern tip: shorter blunt cone at −X end
- Engine glow: small cylinders with `emissive: PLAYER_SHIP.engineColor`, positioned at stern, low intensity ambient bloom
- Dorsal antenna/sensor cluster: short thin cylinder + small sphere on +Z to differentiate from enemy frigate
- Material: `meshStandardMaterial`, `metalness: 0.6`, `roughness: 0.4`, color = `PLAYER_SHIP.color`

**Enemy ships** (`components/combat/ships/*`):
- **No `boxGeometry` anywhere.** No 90° corners, no axis-aligned cuboids.
- Build from `octahedronGeometry` (rhomboid/double-pyramid), `coneGeometry` with `radialSegments: 4` (4-sided pyramid), `tetrahedronGeometry`, occasionally `sphereGeometry` with `widthSegments: 6, heightSegments: 4` (low-poly faceted look).
- Faction color via `resolveFactionColor(factionId)` — applied as the primary material color on the largest visible mesh
- Smaller accent meshes can use a darker variant (compute via simple HSL darken in code)
- Each class composes 3–8 primitives at most, rotated/scaled to break axis alignment

Per-class silhouettes (proposed; tune at first paint):

| Class | Composition |
|---|---|
| `corvette` | Single elongated octahedron, two small tetrahedra as fins, one engine cylinder |
| `frigate` (enemy) | Larger octahedron hull, 4-sided pyramid prow, two tetrahedral wings, two engines |
| `destroyer` | Two stacked octahedra (stretched along bow axis), pyramid prow, four engines |
| `cruiser` | Composite: large octahedron core, two flanking smaller octahedra, pyramid prow, multiple small engines, antenna spires |
| `battlecruiser` | Largest: triple-stacked octahedra + spinal pyramid, 6+ engines, multiple mid-ship pyramids as turret bumps |
| `object` | Single irregular shape: tetrahedron with a small octahedron offset — reads as "fragment" |

---

## 6. Player UI — left-side panel

Four button groups, **all single-active per group** (no stacking):

1. **Face filters (6)** — `bow / stern / port / starboard / dorsal / ventral`
   - Hover: temporarily darkens the other 5 arcs
   - Click: sticky toggle, single-active. Clicking another in the group switches; clicking same turns off.
   - Local-only, never synced.

2. **Range markers (5)** — `up-close / close / medium / far / very-far`
   - Hover: renders a sparse white-dotted sphere at that radius
   - Click: sticky toggle, single-active.
   - Local-only, never synced.

3. **Weapons (N, from `PLAYER_SHIP.weapons`)** — single-active across the group
   - State machine per user: `inactive` → click → `aiming` (cone follows cursor as ghost, apex at origin) → click in scene → `placed` (synced to others, in user's color from `users.color`)
   - Click same button while `aiming` or `placed` → back to `inactive`
   - Click different weapon button → cancels current, jumps to `aiming` for new weapon
   - **Escape** cancels aim back to `inactive`
   - Aim ghost is local-only; only the placed state syncs.

### Mouse interactions

- **Right-click + drag** → orbit camera (drei `OrbitControls` with `mouseButtons` remapped: `RIGHT: ROTATE`)
- **Scroll** → zoom (clamped to range constants)
- **Left-click in scene** → place weapon (only meaningful while `aiming`); on enemy ships during GM phase, opens GM editor (handled in GM panel section)
- **Right-click without drag** (mouse moved < 3px between down/up) → fires GM context menu instead of orbit. Disambiguator handler tracks mousedown position. (Right-click context menu is GM-only; ignored for non-GM users.)

### Status overlay (top-of-screen, blinking)

A local-only HUD reading the user's own toggle state through `composeStatusText`. Two lines max, ~2s opacity blink.

---

## 7. GM UI — right-side panel + 3D interactions

GM is identified by `accessLevel >= 127`. Right-side panel is visible to GM in **both phases**, with phase-dependent affordances. Selection is purely by clicking a ship in the 3D scene — there is **no roster list**.

### Panel layout

```
┌─────────────────────────┐
│ [ Add Ship ]            │ ← only in GM phase
├─────────────────────────┤
│ Editing: [ship label]   │ ← only when a ship is selected
│  ┌────────────────────┐ │
│  │ Label:  [_______]  │ │
│  │ Faction: [▼ Imp..] │ │
│  │ [ Delete ] [ Done ]│ │
│  └────────────────────┘ │
└─────────────────────────┘
```

### Phase-dependent behavior

**GM phase (`phase === "gm"`):**
- Add Ship button visible
- Clicking a ship enters edit mode for that ship: drag-on-shell active, red ghost at original position, distance line, editing section opens in panel
- Edits in the panel (label, faction) + drag changes go into the **client-side staging buffer** for that ship
- **Done** in editing section: closes the section, persists the staged values to local buffer (NOT to server). Drag/red-ghost state clears.
- **Esc**: discards all unsaved edits for this ship in this session, exits edit mode. Ship snaps back to its pre-edit-session staged position (or original if first edit).
- **Edit mode is a focus trap.** While a ship is in edit mode, **all GM controls outside the editing section are disabled**:
  - Clicks on other ships/objects in the 3D scene are ignored
  - Add Ship button is disabled
  - End Turn button is disabled
  - Right-click context menu on other ships is suppressed (right-click on the *currently-edited* ship still works for range/facing changes, since those are part of this edit)
  
  GM can only exit edit mode via the editing section's **Done** (save to staging buffer) or **Esc** (discard). Once exited, all other controls re-enable.
- **Delete** in editing section: commits permanently to server (immediate `DELETE /api/combat/enemy/:id`), closes editing section, ship vanishes for everyone on next poll. No undo.

**Player phase (`phase === "player"`):**
- No Add Ship button
- Clicking a ship still opens the editing section, but with **no drag** (ships don't move during player phase)
- Edits to label/faction commit **immediately** on Done press via `PATCH /api/combat/enemy/:id` (no staging — there's no GM End Turn in this phase to commit through). Done = save & close.
- Esc: discard pending text edits in panel, close section.
- Delete: same as GM phase — immediate, permanent.

### Add Ship modal (GM phase only)

Three fields:
1. **Range layer** — radio of 5 shells
2. **Size class** — radio of 6 (corvette / frigate / destroyer / cruiser / battlecruiser / object)
3. **Faction** — dropdown of `COMBAT_FACTIONS` entries + "None"

On Confirm:
1. Generates a uuid for the new ship
2. Spawns at default position: chosen range, `azimuthDeg: 0`, `elevationDeg: 0`, `facing: "bow"`
3. Label defaults to size class display name (e.g. `"Cruiser"`)
4. Adds to client-side staging buffer
5. Immediately enters drag-edit mode for the new ship

### Right-click context menu on enemy ships (GM only)

Triggered by right-click without drag (movement < 3px between mousedown and mouseup). Sections, top to bottom:

- **Range layer** — radio of 5 shells; clicking a different shell teleports the ship to that radius (azimuth/elevation preserved). During GM phase: staged. During player phase: range edits are not allowed (no movement in player phase).
- **Facing** — radio of 6 faces. During GM phase: staged. During player phase: not allowed (parity with range — facing is movement-like).
- **Delete** — always immediate, both phases (matches the editing section's Delete).

Note: range and facing are right-click-only — they never appear in the right-side panel.

### Drag-edit interaction (GM phase, click an enemy)

1. GM clicks ship → enters drag-edit for that ship; editing section opens
2. Mouse drag projects cursor onto the ship's range shell (great-circle parametrization), ship slides along the shell as cursor moves
3. **Red silhouette persists at the ship's original (pre-turn) position** — anchored to the position from before any staging this turn, NOT the previously-staged position. So GM can re-edit the same ship multiple times this turn, ghost stays at the real origin.
4. **Distance line** drawn from red silhouette to current dragged position, labeled with great-circle arc length + radial delta (if shell changed via right-click during drag)
5. GM presses **Done** in the panel → red ghost clears, ship sits at staged position, editing section closes
6. GM can re-click the ship at any time before End Turn to re-edit; ghost re-anchors to the pre-turn original

### Staging persistence

**Client-side only.** GM's browser holds:

```ts
{
  originalEnemies: EnemyShip[],   // server-canonical, snapshot at turn start
  stagedEnemies:   EnemyShip[],   // mutable: GM's pending edits (moves, adds, label, faction, range, facing)
}
```

If GM disconnects mid-staging, all staged work is lost; on reconnect they see `originalEnemies` again. **Deletes** bypass staging — they POST immediately and remove the ship from both buffers. **Adds** go into `stagedEnemies` only.

### GM End Turn

POSTs the full staged enemy list to `/api/combat/end-turn`:
```ts
POST { enemies: EnemyShip[] }
```

Server validates: `phase === "gm"`, `accessLevel >= 127`, `state.moveCount` matches expectation (optimistic concurrency). On success: writes `enemies`, snapshots old state into `prevEnemies`, increments `moveCount`, flips phase to `player`, clears `weaponHighlights`. All clients poll, detect new `moveCount`, animate from `prevEnemies` → `enemies`.

### End Turn button (bottom-center)

A single button rendered at the bottom-center of the screen, always present:
- Player phase, commander: enabled, label "End Turn"
- Player phase, non-commander: visible but disabled
- GM phase, GM, **no ship in edit mode**: enabled, label "End Turn"
- GM phase, GM, **ship currently in edit mode**: **disabled** (part of the edit-mode focus trap — see §7 panel behavior)
- GM phase, non-GM player: visible but disabled

Clicking advances the phase via `/api/combat/end-turn`. There is no implicit Done — edit mode must be explicitly exited (Done or Esc) before End Turn becomes pressable.

---

## 8. Turn flow

```
[combat launched, phase=gm, enemies=[]]
  GM clicks Add Ship → modal → ships staged client-side, drag-edited, Done'd
  GM presses End Turn
    → POST /api/combat/end-turn { enemies: stagedEnemies }
    → server: prevEnemies=current, enemies=new, moveCount++, phase=player, weaponHighlights={}
    → all clients poll, see moveCount bumped, animate enemies into position
    → players' panels enable, commander's End Turn button becomes clickable

[phase=player]
  Commander + players orbit camera, toggle face/range filters, aim weapons, place highlights
  Each placed weapon highlight POSTs /api/combat/highlight { weaponId, axis }
    → server merges into state.weaponHighlights[username] via JSONB ||
    → other clients poll, render the cone in user's color
  GM (if present) can still click ships to edit label/faction or delete (immediate commits)
  Commander presses End Turn
    → POST /api/combat/end-turn (no body — phase=player is purely a phase flip + clear)
    → server: phase=gm, moveCount++, weaponHighlights={}
    → all clients poll, panels switch (player tools lock, GM panel re-enables Add)

[phase=gm again]
  Repeat
```

Combat ends only via admin pressing **Stop** in `/admin/games` (existing flow). Clients see `active: false` next poll, return to `/game` lobby.

---

## 9. Sync model

Reuses the existing 2s polling pattern (`useGamePolling`, `/api/games/active`). No new infrastructure.

### What syncs (DB → all clients via 2s poll)

| Field | Update trigger | Latency |
|---|---|---|
| `phase` | End Turn POST | ≤2s |
| `enemies[]` | End Turn POST (gm phase) + immediate edits (label/faction/delete) | ≤2s, then ~800ms animation if End Turn |
| `weaponHighlights[username]` | Player highlight POST | ≤2s |
| `moveCount` | Any state-changing POST | ≤2s |

### What's local-only (never hits server)

- Camera position/orientation per user
- Active face / range / weapon button toggles per user
- Weapon aim ghost (pre-placement preview)
- Status overlay text
- GM staging buffer (originalEnemies vs stagedEnemies, red ghosts, distance lines, in-progress label/faction edits during gm phase)

### Animation driver

Same pattern as `arcane-card` and `isolation-protocol`:

1. Client tracks last-applied `moveCount` in a ref
2. When polled state has higher `moveCount` AND `phase === "player"` (just flipped from gm), kick off a tweened lerp from `prevEnemies` → `enemies` over `VISUAL.endTurnAnimMs`
3. Path: lerp position along great-circle arc on the shell, radial linear interp if shell changed
4. Label/faction-only edits (immediate commits during player phase or as the unstaged path) bump `moveCount` but the position diff is empty — ships don't move, just re-render with new label/color text on the next poll
5. Once animation completes, no more lerping — ships sit at canonical positions until next `moveCount` bump

---

## 10. API endpoints

All endpoints reuse `nh_user` cookie auth pattern from existing API routes.

### `POST /api/combat/highlight`

**Auth**: any logged-in user.
**Phase guard**: only if `state.phase === "player"`.
**Body**:
```ts
{ weaponId: string | null; axis: { x:number; y:number; z:number } | null }
```
**Behavior**: writes `state.weaponHighlights[username] = body.weaponId ? { weaponId, axis } : null` via `patchGameState` JSONB merge. Validates `weaponId` matches a known weapon. Returns 200 on success.

Special case: `weaponId: null` clears the user's slot (used when user clicks same weapon button to remove placement).

### `POST /api/combat/end-turn`

**Auth**: depends on current phase.
- `state.phase === "player"`: requester must be `config.commanderUsername`.
- `state.phase === "gm"`: requester must have `accessLevel >= 127`.

**Body** (gm-phase only):
```ts
{ enemies: EnemyShip[] }
```

Player-phase End Turn has no body — server just flips phase and clears highlights.

**Behavior**:
- Validates current phase + auth
- gm phase: snapshots `state.enemies → state.prevEnemies`, validates each enemy in body, sets `state.enemies = body.enemies`, flips phase to `player`
- player phase: clears `state.weaponHighlights`, flips phase to `gm`
- Both: increments `moveCount`, clears `weaponHighlights` (so player highlights don't persist into next turn)
- Uses optimistic concurrency on `moveCount` (returns 409 on conflict)

### `PATCH /api/combat/enemy/:id`

**Auth**: `accessLevel >= 127` (GM).
**Phase**: either phase. (During GM phase this is rarely used since edits go through staging + End Turn; during player phase it's the commit path for label/faction edits.)
**Body**: `{ label?: string; factionId?: string | null }` (any subset).
**Behavior**: updates the named enemy's label and/or factionId. Increments `moveCount`. Validates ship exists in `state.enemies`.

### `DELETE /api/combat/enemy/:id`

**Auth**: `accessLevel >= 127` (GM).
**Phase**: either phase (deletes are permanent, work in both per spec).
**Behavior**: removes the enemy with matching id from `state.enemies` immediately. Increments `moveCount` so all clients re-render. Player-phase deletes typically narrative ("you destroyed it").

---

## 11. Authorization summary

| Action | Required | Phase guard |
|---|---|---|
| View scene, orbit camera, toggle local view tools | Logged-in user | Any |
| Place/remove own weapon highlight | Logged-in user, `accessLevel < 127` | Player phase only |
| Press End Turn (player→gm) | Must be `commanderUsername` | Player phase only |
| Press End Turn (gm→player) + commit staged enemies | `accessLevel >= 127` | GM phase only |
| Add enemy (staged) | `accessLevel >= 127` | GM phase only (Add button hidden in player phase) |
| Move enemy (staged: range, position, facing) | `accessLevel >= 127` | GM phase only (right-click range/facing not offered in player phase; drag inactive) |
| Edit enemy label / faction | `accessLevel >= 127` | Both phases. GM phase: staged. Player phase: immediate via PATCH |
| Delete enemy | `accessLevel >= 127` | Both phases, immediate |
| Launch / Stop combat session | `accessLevel >= 66` (existing admin) | N/A — uses existing `/api/admin/games` |

---

## 12. GamesPanel form additions

In `components/admin/GamesPanel.tsx`, add to the per-type config branches:

```tsx
{formGameType === "space-combat" && (
  <>
    {/* Commander dropdown (reuses existing player dropdown component) */}
    <div className="flex flex-col gap-1">
      <label>Commander</label>
      <PlayerDropdown value={formCommander} onChange={setFormCommander} />
    </div>
    {/* Optional scenario label */}
    <div className="flex flex-col gap-1">
      <label>Scenario Name (optional)</label>
      <input value={formCombatLabel} onChange={(e) => setFormCombatLabel(e.target.value)} />
    </div>
  </>
)}
```

Hide the "Opponent (Kanka Character)" dropdown when `formGameType === "space-combat"` (it's irrelevant — combat has no Kanka opponent).

The form submits `{ gameType: "space-combat", commanderUsername, label }` to `/api/admin/games` POST. Default config is `getDefaultConfig()` from registry.

---

## 13. Implementation phases (incremental rollout)

Build in vertical slices so each phase is testable end-to-end.

### Phase 1 — scaffold + integration
- Install dependencies (`three`, `@react-three/fiber`, `@react-three/drei`) — **await user approval**
- Add `space-combat` to type unions (`types/game.ts`) and `GAME_REGISTRY` with empty default state
- Wire `SpaceCombatBoard` into `GAME_COMPONENTS` with placeholder content
- Add space-combat branch to `GamesPanel` form + `/api/admin/games` POST validation
- **Goal**: admin can configure, launch, and stop a combat session; players see "Space Combat — phase: gm" placeholder

### Phase 2 — 3D scene with player vessel + camera
- Build `Scene.tsx` with R3F `<Canvas>`, drei `OrbitControls` (right-click orbit, scroll zoom, clamped)
- Add `Skybox.tsx` (large textured sphere using `public/combat/skybox.svg`)
- Add `PlayerVessel.tsx`: composed primitives (stretched ellipsoid + cone tips + engine glow + dorsal antenna)
- Add hardcoded configs (`ranges.ts`, `faces.ts`, `factions.ts`, `playerShip.ts`, `visual.ts`)
- **Goal**: launching combat shows the player vessel in space, players can orbit around it freely

### Phase 3 — range markers + face filters (player local-only)
- Build `PlayerPanel.tsx` with face + range button rows
- Build `RangeShell.tsx` (Fibonacci-sphere `Points` mesh)
- Build face-darkening overlay (partial sphere mask material)
- Build `StatusOverlay.tsx` with composed text + blink animation
- **Goal**: player can hover/click face and range buttons, see the visual feedback locally + status text

### Phase 4 — weapon highlights (local aim + sync placed)
- Add weapon buttons to `PlayerPanel.tsx`
- Build `WeaponVolume.tsx` (cone/cylinder/wide-cone with effectiveness gradient via vertex colors or shader)
- Build `WeaponAimGhost.tsx` (cursor-follow, raycasts cursor direction onto a unit sphere from origin)
- Add `/api/combat/highlight` endpoint; wire to placement
- Render synced highlights from `state.weaponHighlights` in each user's color (fallback white)
- Add Esc handler for cancel-aim
- **Goal**: players can aim and place weapon volumes; other players see them within ~2s in the placer's color

### Phase 5 — Enemy ship components (composed primitives)
- Build all 6 ship components in `components/combat/ships/` (corvette, frigate, destroyer, cruiser, battlecruiser, object) — angular silhouettes only, no boxes
- Build `EnemyShip.tsx` wrapper that picks the right component by `sizeClass`, applies `range × azimuth × elevation` positioning, applies facing rotation, applies faction color
- Add a temporary "spawn test enemy" hidden hotkey for visual iteration
- **Goal**: visually verify each class looks distinct from the player vessel and from each other

### Phase 6 — GM enemy management (server-canonical, no staging yet)
- Build `GMPanel.tsx` (right-side, gated on `accessLevel >= 127`)
- Build `AddShipModal.tsx` (3 fields: layer + size + faction)
- Add `/api/combat/end-turn` (gm phase: accepts new enemy list; player phase: no body, just flip)
- Add `/api/combat/enemy/[id]` PATCH + DELETE
- Initial wiring: GM clicks Add Ship → modal → ship spawned via direct API call (no staging — proves the pipeline works end-to-end)
- Add `EndTurnButton.tsx` at bottom-center, gated by phase + role
- **Goal**: GM can spawn, see, label, faction-color, delete, and end-turn the encounter; players see enemies appear after End Turn

### Phase 7 — GM staging (drag-edit + red ghosts + distance line)
- Add `useCombatStaging` hook with client-side staging buffer
- Build `StagingGhost.tsx` (red silhouette + distance line with arc length label)
- Implement drag-on-shell (raycast cursor onto sphere, project to great-circle)
- Build right-click context menu (range layer change, facing, delete)
- Wire panel editing section to staging buffer (label, faction → staged in gm phase)
- Wire End Turn to commit staged buffer → `/api/combat/end-turn` with full enemy list
- Add Esc handler for discard-edit (priority cascade: weapon-aim first, then GM edit)
- Implement edit-mode focus trap: while `editingShipId !== null`, disable Add Ship button, End Turn button, clicks on other ships, and right-click context menu on other ships
- **Goal**: GM stages multiple moves with full editorial freedom, presses End Turn once to commit

### Phase 8 — End-turn animations
- Add `prevEnemies` snapshot logic on server during gm-phase End Turn
- Client-side animation driver: detect `moveCount` increase + `phase === "player"`, lerp ships from `prevEnemies` → `enemies` over `VISUAL.endTurnAnimMs`
- Great-circle interpolation along shell, linear radial interp if shell changed
- **Goal**: ships glide smoothly to new positions on End Turn

### Phase 9 — polish
- Status text blink animation tuning
- Distance label on staging line
- Empty-state messaging when no enemies on field ("Awaiting GM to populate the encounter")
- Error states (lost connection, stale moveCount, etc.)
- Cross-browser test, mobile viewport check (panels stack on narrow screens?)
- Tune ship-class scales + visual proportions side-by-side
- Tune engine emissive intensity, lighting, skybox brightness

---

## 14. Open / future work (explicitly out of scope for v1)

- Sound effects (engine hums, weapon "lock-in" tones)
- Multi-encounter saved scenarios (admin presets)
- Player-side ship customization (different player vessels, weapon loadouts)
- Hit-resolution mechanics in-app (currently fully verbal)
- Pause/resume combat (currently end-only)
- Spectator chat overlay (the existing inbox/messaging system covers this if needed)
- WebSocket-based realtime (current polling at 2s is sufficient for the design)
- Per-ship custom color override (currently faction-only)

---

## 15. Testing checklist (manual, since project has no test framework)

Before considering each phase done:

- [ ] Two browsers, same user, both see same scene state (sanity check polling)
- [ ] Two browsers, different users with different `users.color` values — placed weapon highlights render in correct colors (and white fallback for null)
- [ ] Commander logged in on one browser, non-commander on another: only commander sees enabled End Turn during player phase
- [ ] GM logged in, places ships, refreshes browser before End Turn — staging buffer is lost, original state restored (confirms client-side staging)
- [ ] GM ends turn, both clients animate same way at same time
- [ ] Admin presses Stop in `/admin/games` — both clients return to `/game` lobby
- [ ] Right-click + drag orbits camera; right-click without drag (on enemy, GM only) opens context menu
- [ ] Escape during weapon aim cancels back to inactive
- [ ] Escape during GM edit discards staged drag/label/faction changes
- [ ] Single-active-per-group enforced: clicking a face button disables previous face button (same for range, weapons)
- [ ] Player-phase label/faction edits commit immediately (verify via second browser polling)
- [ ] Faction removed from `factions.ts` → existing ships referencing that id render white
- [ ] Player vessel reads as visually distinct from enemy frigates (curvy vs angular)
- [ ] During GM edit mode: clicks on other ships/objects in the 3D scene are ignored
- [ ] During GM edit mode: Add Ship button is disabled
- [ ] During GM edit mode: End Turn button is disabled
- [ ] During GM edit mode: right-click on other ships does not open a context menu
- [ ] During GM edit mode: right-click on the currently-edited ship still opens range/facing menu
- [ ] After Done or Esc on an active edit: all GM controls re-enable

---

End of plan. Implementation begins on user confirmation.
