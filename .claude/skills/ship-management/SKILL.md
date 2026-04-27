---
name: ship-management
description: Create, move, and place ships and fleets across sector routes and star systems. Use whenever the user asks to add a ship, advance a ship along a route, retire a ship into a system, or send a ship from one system to another.
---

# Ship Management

Ships in this codebase live in two distinct places. Always identify which one a given ship is in **before** editing — the JSON shape is different.

## Where ships live

### A. As a route marker (in transit)
Inside `content/sectors/<sector-file>.json` → `connections[]` → `marker`. The connection has `from` and `to` system/POI slugs and a `layer` (almost always `"movement"`). The marker carries `position` (0–1, progress along the curve from `from` toward `to`).

```json
{
  "from": "callisto",
  "to": "pernat",
  "layer": "movement",
  "curvature": 160,
  "marker": {
    "type": "ship",
    "name": "Ray of Purity",
    "position": 0.4,
    "allegiance": "inquisitorium"
  }
}
```

### B. As a celestial body (arrived / docked)
Inside `content/sectors/<sector-slug>/<system-slug>.json` → `bodies[]`. Has `id`, `orbitPosition` (0–360°), `orbitDistance` (0–1), and `type: "ship"` (or `"fleet"`).

```json
{
  "id": "aegis",
  "name": "Aegis",
  "type": "ship",
  "orbitPosition": 150,
  "orbitDistance": 0.6,
  "labelPosition": "bottom",
  "allegiance": "exploratorium"
}
```

## Sector file ↔ slug map

The galactic-map slot files (`top-left.json`, `top-right.json`, `bottom-left.json`, `bottom-right.json`, `core.json`) carry a `slug` field that names the sector. Confirm by reading the top of the file — don't assume from the filename. As of this writing:

- `top-right.json` → **atlas-sector**
- `core.json` → **imperial-core**
- (others as named in their `slug` field)

System JSON lives at `content/sectors/<sector-slug>/<system-slug>.json`. Note the directory is the sector **slug**, not the layout filename.

## Always do — find first

Before any operation, locate the ship:

```
Grep pattern="<ship name>" path="content/sectors" output_mode="content" -n
```

Report to the user what you found:
- Route marker → which sector file, which `from→to` connection, current `position`, `allegiance`
- Celestial body → which system file, current `orbitPosition` / `orbitDistance`, `allegiance`
- Not found → say so and ask for creation info (see below)

## Required information per operation

If any field is missing, **ask the user before editing**.

### 1. Create a new ship

Need:
- **Name** (display string)
- **Allegiance** — must be a key from `lib/allegiances.ts`. Confirm it exists; if not, ask the user to either pick an existing one or add it to `ALLEGIANCES` first.
- **Where it starts**: either
  - **In a system**: sector slug + system slug + `orbitPosition` (0–360°) + `orbitDistance` (0–1, typical 0.4–0.8)
  - **On a route**: sector slug + `from` slug + `to` slug + `position` (0–1) + optional `curvature` (perpendicular bezier offset, typical ±80–160)
- **type** — `"ship"` or `"fleet"`
- **Optional**: `kankaUrl`, `labelPosition` (`"top"` or `"bottom"`, default `"bottom"`)

If placing in a system, also generate a kebab-case `id` unique within `bodies[]` (e.g. `imperial-glory`).

### 2. Move a ship along its current route

Need:
- **Ship name**
- **New `position`** (0–1, where 0 = at `from`, 1 = at `to`)

Edit just the marker's `position` field in place.

### 3. Send a ship to a different route (still in transit)

Need:
- **Ship name**
- **New `from`** and **`to`** system/POI slugs (in the same sector, or move it to a different sector file)
- **New `position`** (default 0 if departing, or whatever the user specifies)
- **Optional `curvature`** if the new connection doesn't already exist

If the connection between those endpoints doesn't already exist in `connections[]`, you must create it. If it does exist with a different ship marker, ask the user — don't overwrite another ship.

### 4. Ship arrives at its destination

Need:
- **Ship name**
- **Destination system** — slug (and confirm sector file)
- **`orbitPosition`** (0–360°) and **`orbitDistance`** (0–1)
- **Body `id`** (kebab-case, unique in that system's `bodies[]`)

Two-part edit:
1. **Remove** the connection from the sector file's `connections[]` (or remove just the `marker` key if the connection should remain as a story/movement line without a ship — ask the user which).
2. **Add** a body to the destination system's `bodies[]`, carrying `type`, `name`, `orbitPosition`, `orbitDistance`, `allegiance`, and any `kankaUrl` / `labelPosition` that existed on the marker.

### 5. Ship departs from a system

Need:
- **Ship name**
- **Source system** (where it currently sits as a body)
- **`from`** slug (typically the source system) and **`to`** slug (destination)
- **Initial `position`** (default 0)
- **Optional `curvature`**

Two-part edit:
1. **Remove** the body from the source system's `bodies[]`.
2. **Add** a connection to the parent sector's `connections[]` with a `marker` carrying `type: "ship"`, `name`, `position`, and `allegiance` copied from the body.

## Constraints to enforce

- `position` must be in `[0, 1]`. Reject values outside this range.
- `orbitPosition` is degrees 0–360. `orbitDistance` is normalized 0–1 (typical 0.3–0.9).
- `allegiance` must be a valid key in `lib/allegiances.ts`. If the user gives a name that isn't in the registry, stop and confirm whether to add it to `ALLEGIANCES` or pick an existing key.
- Body `id` values must be unique within a single system's `bodies[]`.
- `from` / `to` slugs must reference existing system slugs, vortex slugs, or marker slugs that already exist in the same sector file. If not, ask the user.
- A connection can carry **at most one** marker. Don't merge two ships into one line.

## After any change

Tell the user to run `npm run build` if static system pages need to regenerate (system body changes). Pure sector-file route edits are picked up by the SectorMap on next load — no rebuild required, but a build doesn't hurt.

## Quick reference — what to ask when info is missing

| Operation | Ask for |
|---|---|
| Create | name, allegiance, sector, AND (system + orbit) OR (from + to + position [+ curvature]) |
| Move on route | new `position` (0–1) |
| Reroute | new `from`, new `to`, optional new `position` |
| Arrive | destination system, `orbitPosition`, `orbitDistance`, body `id` |
| Depart | new `from`, new `to`, initial `position` |

If the ship can't be found, list the search term you used and ask the user to confirm the spelling or provide creation details.
