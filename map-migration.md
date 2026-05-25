# Map Migration — JSON → Postgres + GM Editor Overlay

> Status: design draft. Updated 2026-05-24.

## 1. Goals & scope

Move galactic map content (the Atlas sector and its star systems) from on-disk JSON to the Neon Postgres database, and ship a toggleable in-place editor overlay so the gamemaster can CRUD the map without touching JSON or rebuilding.

### What migrates

- **Atlas sector** (`content/sectors/top-right.json` + `content/sectors/atlas-sector/*.json`) — full move to DB.
- **Imperial Core gets a row** in the `sectors` table (slug, name, color, description, nebula_color from `core.json`) so the galactic-map listing finds it and renders it in the central position. **Nothing else** about Imperial Core enters the DB — its systems, bodies, and the bespoke cluster all stay as JSON + isolated render code, dispatched by slug match in the loader.
- **The three other quadrant sectors** (vintar-sector, castell-sector, denerum-sector) are seeded as **empty shell rows** in the `sectors` table — slug, name, color, description, nebula_color, published flag carried over from their JSON. No descendant rows. They appear in the galactic map at their existing positions and can later be filled in via the editor like any DB-backed sector.

### What stays on JSON

- **Imperial Core inner content** (`content/sectors/imperial-core/axiom-system.json` and the hand-built planet-cluster render code) is intentionally out of the DB and the editor.
- A **fallback copy of Atlas** stays in JSON (`top-right.json` + `atlas-sector/` dir) and is reachable at `/sectors/atlas-sector-legacy` in case the DB migration produces a bad result. Same route component, just a different loader.

### What gets deleted

The three placeholder sector JSONs — their data has been promoted to DB rows in the seed:
- `content/sectors/top-left.json` (vintar-sector)
- `content/sectors/bottom-left.json` (castell-sector)
- `content/sectors/bottom-right.json` (denerum-sector)

`SECTOR_TERRITORY` in `lib/sectorMapHelpers.ts` is **unchanged** — all five entries stay, since all five sectors still exist as sectors (the placeholders just got upgraded from JSON shells to DB shells).

### Out of scope

- Sector CRUD (sectors are pre-seeded; the editor never adds or renames sectors).
- Galactic-map editing (the 5-sector galaxy view is not editable).
- Allegiance CRUD UI (table exists, seeded read-only — no editor).
- Multi-user concurrency (last-write-wins; the GM is a single superadmin in practice).
- Body portrait images (`CelestialBody.image` is unused today and is dropped, not migrated).

---

## 2. Decision ledger

| # | Decision | Choice | Why |
|---|----------|--------|-----|
| D1 | GM access level | Superadmin (≥127) | Same threshold as `/admin/messages`. World canon should not be editable by every admin. |
| D2 | Editor location | Toggle overlay on the live maps | WYSIWYG; spatial editing requires seeing the result in place. |
| D3 | Rendering | ISR + `revalidatePath()` on save | Players get cached pages; GM edits propagate after a save round-trip. |
| D4 | Enum storage | Mixed: CHECKs for structural enums, lookup table for **biomes** | Biomes are the only vocab the GM has extended in the past; everything else is tied to render logic. |
| D5 | Connection endpoint refs | Slug strings (denormalized) | Polymorphic across system/vortex/marker, mirrors today's behavior. No native FK. |
| D6 | Allegiances in DB | Yes, seeded read-only, no CRUD UI | Sets up future flexibility; bodies/markers FK by slug. |
| D7 | Slug renames | Allowed on system/vortex/marker; orphan connections are GM-managed via the "Connections by layer" panel. **Sector slugs never change** (no edit UI). | Cascading renames add complexity; the GM has a dedicated UI to clean orphans. |
| D8 | Body image field | Drop entirely | Declared in types but unused in JSON and unrendered in components. |
| D9 | Delete semantics | Hard delete with confirm modal | Mirrors `/admin/users`. The `hidden` flag is removed (was a JSON-author convenience). |
| D10 | Save semantics | Stage edits in local state; single SAVE per view; dirty indicator + discard + navigation guard | Matches "save on SAVE" preference. |
| D11 | Edit-mode scoping | Sector-edit mode and system-edit mode are **mutually exclusive**. While sector-edit is on, system drill-down is disabled — pins are entities to manage, not portals. To edit inside a system, turn off sector-edit, drill in, turn on system-edit. | Prevents accidental cross-scope edits and overlay clutter. |
| D12 | Positioning UX | Drag-and-drop. New pins: **right-click canvas → context menu** ("Create System / Vortex / Marker") → modal. New connections: **"Add connection" button** → searchbox-driven A/B picker reusing the existing `SearchOverlay` index. | Drag is natural for positioning; right-click avoids accidental adds; searchbox already exists. |
| D13 | Atlas legacy URL shape | `/sectors/atlas-sector-legacy` | Same route tree, distinct slug; easy to remove later. |
| D14 | Star storage | Separate `stars` table FK'd to system, with a `role` column (`primary` / `secondary`). No `type` column — astronomy labels become a non-rendering flavor field. | Cleaner editor for binaries than denormalized columns. |
| D15 | Marker storage | Single `markers` table with optional `connection_id` FK + nullable position vs x/y | One query path, one editor panel, one "all markers in sector" list. |
| D16 | System center kind | `systems.center_kind` CHECK enum: `single` / `binary` / `pulsar` / `neutron` / `black-hole`. Renderer switches on this column, **replacing the `star.type.includes("...")` substring matcher**. Exotic centers are color-customizable (rim/accent picks up `stars.color`); seeded defaults match today's render palette. | Eliminates the substring footgun; gives the editor a real dropdown; aligns naturally with the existing binary-vs-single distinction. |
| D17 | Star "type" field | Renamed to `fantasy_label`, kept as optional free text that never affects rendering. | "Red Supergiant" etc. is preserved as flavor copy; the renderer no longer cares what's in it. |
| D18 | Imperial Core in DB | A single row in `sectors` (metadata only) + slug-routed JSON loader for everything inside. No rows in `systems` / `stars` / `celestial_bodies` / `vortexes` / `markers` / `connections` for `imperial-core`. The bespoke cluster render code stays untouched. | Lets the galactic-map listing query DB uniformly while keeping Imperial Core's hand-built content out of the editor and the schema. |
| D19 | Placeholder JSON cleanup | The three placeholders (vintar-sector, castell-sector, denerum-sector) are seeded as empty DB rows; the JSON files are then deleted. `SECTOR_TERRITORY` is left intact — all five sectors still exist, just three of them now live in DB as empty shells ready for future content. | JSON files are obsolete cruft once the data lives in DB; the sectors themselves remain real so the galactic map keeps its full layout. |

---

## 3. Database schema

Additions to `lib/db/schema.sql` (one block — no migrations dir; this is run manually like every other table). Postgres dialect is Neon serverless.

### 3.1 Lookup tables

```sql
CREATE TABLE IF NOT EXISTS allegiances (
  slug      VARCHAR(40) PRIMARY KEY,
  name      VARCHAR(120) NOT NULL,
  color     VARCHAR(7)   NOT NULL,
  logo_url  TEXT
);

CREATE TABLE IF NOT EXISTS biomes (
  slug            VARCHAR(30) PRIMARY KEY,
  label           VARCHAR(60) NOT NULL,
  color           VARCHAR(7)  NOT NULL,
  secondary_color VARCHAR(7)  NOT NULL   -- inner gradient color, matches BodyColors.secondaryColor
);
```

Seed sources:
- `allegiances`: every key in `lib/allegiances.ts`'s `ALLEGIANCES` registry.
- `biomes`: every entry of `lib/bodyColors.ts` (slug → color), with `label` set to a humanized form.

After seeding, `lib/allegiances.ts` is replaced by a DB-backed loader that caches the result. `lib/bodyColors.ts` likewise becomes a thin lookup over the cached `biomes` table. The TypeScript `AllegianceKey` and `PlanetBiome` types become `string` (validated at API boundary by querying the lookup tables).

### 3.2 Map tables

```sql
CREATE TABLE IF NOT EXISTS sectors (
  id            SERIAL PRIMARY KEY,
  slug          VARCHAR(60)  UNIQUE NOT NULL,   -- immutable; not exposed to editor
  name          VARCHAR(120) NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  color         VARCHAR(7)   NOT NULL,
  nebula_color  VARCHAR(7),
  published     BOOLEAN      NOT NULL DEFAULT true,
  -- Imperial Core never lives here; presence is the implicit "DB-backed" flag.
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS systems (
  id                SERIAL PRIMARY KEY,
  sector_id         INTEGER NOT NULL REFERENCES sectors(id) ON DELETE CASCADE,
  slug              VARCHAR(60) NOT NULL,
  name              VARCHAR(120) NOT NULL,
  x                 DOUBLE PRECISION NOT NULL,   -- canvas 0–1200
  y                 DOUBLE PRECISION NOT NULL,   -- canvas 0–800
  allegiance_slug   VARCHAR(40) REFERENCES allegiances(slug) ON DELETE SET NULL,
  territory_radius  DOUBLE PRECISION,
  center_kind       VARCHAR(20) NOT NULL DEFAULT 'single'
                    CHECK (center_kind IN ('single','binary','pulsar','neutron','black-hole')),
  binary_angle      DOUBLE PRECISION,             -- used only when center_kind='binary'
  external_url         TEXT,
  published         BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (sector_id, slug)
);
CREATE INDEX IF NOT EXISTS systems_sector_idx ON systems (sector_id);

CREATE TABLE IF NOT EXISTS stars (
  id                SERIAL PRIMARY KEY,
  system_id         INTEGER NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
  role              VARCHAR(10) NOT NULL CHECK (role IN ('primary','secondary')),
  name              VARCHAR(120) NOT NULL,        -- e.g. "Belliar", or "The Maw" for a black hole
  fantasy_label     VARCHAR(80),                  -- optional flavor copy, e.g. "Red Supergiant" — never affects rendering
  color             VARCHAR(7)   NOT NULL,        -- accent/rim color, picked up by all center_kind renderers
  secondary_color   VARCHAR(7),                   -- inner-gradient color (single/binary only)
  external_url         TEXT,
  UNIQUE (system_id, role)
);
-- Rules enforced at the API layer (not as DB constraints, to keep CHECKs readable):
--   center_kind='single'                       → exactly 1 star (role='primary')
--   center_kind='binary'                       → 2 stars (primary + secondary), binary_angle NOT NULL
--   center_kind in ('pulsar','neutron','black-hole') → exactly 1 star (role='primary'), binary_angle NULL

CREATE TABLE IF NOT EXISTS celestial_bodies (
  id                SERIAL PRIMARY KEY,
  system_id         INTEGER NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
  body_id           VARCHAR(40) NOT NULL,        -- the in-system stable string ID (was JSON `id`)
  name              VARCHAR(120) NOT NULL,
  type              VARCHAR(20) NOT NULL CHECK (type IN
    ('planet','station','moon','ship','fleet','asteroid-field','black-hole')),
  biome_slug        VARCHAR(30) REFERENCES biomes(slug) ON DELETE SET NULL,
  lore              TEXT,
  orbit_position    DOUBLE PRECISION NOT NULL,    -- 0–360
  orbit_distance    DOUBLE PRECISION NOT NULL,    -- 0–1
  label_position    VARCHAR(6) CHECK (label_position IN ('top','bottom')),
  special_attribute VARCHAR(20) CHECK (special_attribute IN
    ('lathanium','nobility','purified','lightbringer','cult','alien_int')),
  allegiance_slug   VARCHAR(40) REFERENCES allegiances(slug) ON DELETE SET NULL,
  external_url         TEXT,
  published         BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (system_id, body_id)
);
CREATE INDEX IF NOT EXISTS bodies_system_idx ON celestial_bodies (system_id);

CREATE TABLE IF NOT EXISTS vortexes (
  id          SERIAL PRIMARY KEY,
  sector_id   INTEGER NOT NULL REFERENCES sectors(id) ON DELETE CASCADE,
  slug        VARCHAR(60) NOT NULL,
  name        VARCHAR(120) NOT NULL,
  x           DOUBLE PRECISION NOT NULL,
  y           DOUBLE PRECISION NOT NULL,
  color       VARCHAR(7),
  radius      DOUBLE PRECISION,
  ratio_w     DOUBLE PRECISION,        -- nullable pair, both NULL = no override
  ratio_h     DOUBLE PRECISION,
  layer       VARCHAR(20) CHECK (layer IN ('movement','story','conflict','invasion')),
  UNIQUE (sector_id, slug)
);

CREATE TABLE IF NOT EXISTS connections (
  id           SERIAL PRIMARY KEY,
  sector_id    INTEGER NOT NULL REFERENCES sectors(id) ON DELETE CASCADE,
  from_slug    VARCHAR(60) NOT NULL,    -- denormalized: matches systems.slug | vortexes.slug | markers.slug
  to_slug      VARCHAR(60) NOT NULL,
  curvature    DOUBLE PRECISION DEFAULT 0,
  label        VARCHAR(120),
  color        VARCHAR(7),
  dashes       VARCHAR(20),
  opacity      DOUBLE PRECISION,
  layer        VARCHAR(20) CHECK (layer IN ('movement','story','conflict','invasion'))
);
CREATE INDEX IF NOT EXISTS connections_sector_idx ON connections (sector_id);
CREATE INDEX IF NOT EXISTS connections_endpoints_idx ON connections (sector_id, from_slug, to_slug);

CREATE TABLE IF NOT EXISTS markers (
  id                SERIAL PRIMARY KEY,
  sector_id         INTEGER NOT NULL REFERENCES sectors(id) ON DELETE CASCADE,
  slug              VARCHAR(60) NOT NULL,
  name              VARCHAR(120) NOT NULL,
  type              VARCHAR(20) NOT NULL CHECK (type IN
    ('ship','fleet','anomaly','poi','black-hole')),
  allegiance_slug   VARCHAR(40) REFERENCES allegiances(slug) ON DELETE SET NULL,
  external_url         TEXT,
  territory_radius  DOUBLE PRECISION,
  layer             VARCHAR(20) CHECK (layer IN ('movement','story','conflict','invasion')),
  -- Either attached to a connection (position 0–1) or free-floating (x/y/angle).
  connection_id     INTEGER REFERENCES connections(id) ON DELETE CASCADE,
  position          DOUBLE PRECISION,                       -- 0–1
  x                 DOUBLE PRECISION,
  y                 DOUBLE PRECISION,
  angle             DOUBLE PRECISION,
  UNIQUE (sector_id, slug),
  CHECK (
    (connection_id IS NOT NULL AND position IS NOT NULL AND x IS NULL AND y IS NULL)
    OR
    (connection_id IS NULL AND x IS NOT NULL AND y IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS markers_sector_idx ON markers (sector_id);
CREATE INDEX IF NOT EXISTS markers_connection_idx ON markers (connection_id);
```

### 3.3 What changed vs the TS types

- `MapMarker.hidden`, `SystemPin.hidden`, `VortexPin.hidden`, `ConnectionLine.hidden`, `CelestialBody.hidden` — **dropped**. Replaced by hard delete + the `published` flag where applicable.
- `CelestialBody.image` — **dropped** (unused).
- `MapMarker` is now two distinct row shapes united by one table; the embedded `connection.marker` JSON pattern becomes a `markers` row with `connection_id` set.
- `Star` becomes a row in `stars`; `StarSystemMetadata.star` / `.secondaryStar` become `role='primary' | 'secondary'` rows.
- `Star.type` (free text, was render-driving via substring match) is **removed**. Its render role moves to `systems.center_kind` (enum, see §3.4.4). The descriptive value (`"Red Supergiant"`, `"Yellow Dwarf"`) is preserved in `stars.fantasy_label` as non-rendering flavor copy.
- `StarSystemMetadata.binaryAngle` moves to `systems.binary_angle` and is used only when `center_kind='binary'`.

### 3.4 Type-to-render bindings (what an enum value actually controls)

Several columns are more than just data — their value picks an SVG renderer or a hardcoded size. The editor's dropdowns must match these bindings, and **adding a new value requires a code change** (a new render branch + a CHECK constraint update). The biome-as-lookup-table decision (D4) only works because biome is the one exception: biomes drive color, not shape.

#### 3.4.1 `celestial_bodies.type` → `components/sectormap/bodies/BodyShape.tsx`

| Value | SVG shape | Hard-coded size |
|---|---|---|
| `planet` (default), `moon` | `<circle r=12>` | r=12, labelR=12, hitR=30 |
| `station` | rotated-square polygon (half-diag 9–10) | labelR=10, hitR=30 |
| `ship` | upward triangle via `tri(cx, cy, 10)` | r=10, labelR=12, hitR=30 |
| `fleet` | 3-triangle formation via `FLEET_SHIPS` constant (`[{dx:0,dy:0,r:14},{dx:20,dy:-9,r:10},{dx:20,dy:9,r:7}]`) | labelR=22, hitR=40 |
| `asteroid-field` | 8-dot deterministic cluster via `asteroidDots(bodyId)` (seeded from body id) | labelR=32, hitR=50 |
| `black-hole` | gradient + accretion disk + photon ring + lensing arc (~14 SVG elements) | labelR=18, hitR=30 |

Sizing constants live in `bodyLabelR()` and `bodyHitRadius()` in `lib/sectorMapHelpers.ts`. Both are switch statements keyed on the type string.

**Implication:** the editor's body type dropdown is a fixed 7-option list. No "add new body type" UI. Listed as CHECK constraint in schema. To introduce e.g. `comet`: schema CHECK update + new branch in `BodyShape.tsx` + new entry in both sizing functions.

#### 3.4.2 `markers.type` → `components/sectormap/FreeMarkerLayer.tsx` + `ConnectionMarkerLayer.tsx`

| Value | SVG shape | Notes |
|---|---|---|
| `ship` | leftward triangle with allegiance-colored gradient | uses `triLeft()` |
| `fleet` | 3-ship `FLEET_SHIPS` formation (same constant as bodies) | shared with body fleet |
| `anomaly` | radial gradient disk r=12 + inner dot r=4 | |
| `poi` | soft glow r=10 + white pin r=1.5 | |
| `black-hole` | downsized version of the body black-hole SVG (r=7 event horizon) | |

Color palette per marker type lives in `MARKER_COLORS` in `lib/bodyColors.ts`. Free-floating markers also render an optional `wavyCloudPath` territory if `territory_radius` is set — that geometry is type-independent.

**Implication:** marker type dropdown is a fixed 5-option list. Same "code change required" rule for new types. Note that `ship` and `fleet` collide with body type names but live in a different rendering path and a different table.

#### 3.4.3 `celestial_bodies.special_attribute` → `components/specialAttributes/SpecialAttributeIcon.tsx`

Six values, each with its own SVG branch (`SpecialAttributeIcon.tsx` lines 23-65) and color metadata in `specialAttributeData.ts` (`SPECIAL_ATTRIBUTES` record): `lathanium`, `nobility`, `purified`, `lightbringer`, `cult`, `alien_int`.

**Implication:** special_attribute dropdown is a fixed 6-option list. Schema CHECK already enforces this. The editor should render the icon preview in the dropdown using `SpecialAttributeIcon` so the GM sees what they're picking.

#### 3.4.4 `systems.center_kind` → `components/sectormap/StarSystemView.tsx`

The center of every star system has five possible rendering modes, switched by `systems.center_kind`. This **replaces** the legacy `star.type.toLowerCase().includes("...")` substring matcher in `StarSystemView.tsx`.

| `center_kind` | SVG | Stars rows | Color customizable? | Seeded default(s) |
|---|---|---|---|---|
| `single` | One star: filled disk + radial corona gradient, fades from `color` (0%) → `secondary_color` (60%) → transparent | 1 row (primary) | Yes (color + secondary_color) | `color="#FFE87A"`, `secondary_color="#7C5F00"` |
| `binary` | Two stars at `binary_angle` ± 180° offset, each rendered with its own gradient + corona, shared orbit ring | 2 rows (primary + secondary) | Yes per star | `binary_angle=0`; star defaults same as single |
| `pulsar` | Beam-cone assembly at fixed angle + ambient core glow + disk; beam/glow gradients pick up `color`, core stays white-hot | 1 row (primary) | Yes (`color` only; secondary unused) | `color="#7DD3FC"` (matches current pulsar default in JSON) |
| `neutron` | Tight intense glow + expanding heat ripples + blue-white core (hardcoded `#B0C4FF`); outer ripples picks up `color` | 1 row (primary) | Yes (`color` only) | `color="#B0C4FF"` |
| `black-hole` | Lensing glow + accretion disk + event horizon (hardcoded black) + photon ring + lensed-light arc; disk/lensing gradients pick up `color` | 1 row (primary) | Yes (`color` only) | `color="#A78BFA"`, `secondary_color="#2E1065"` (matches today's `BLACK_HOLE_COLORS`) |

The renderer in `StarSystemView.tsx` becomes a clean switch:

```ts
switch (sys.center_kind) {
  case "binary":     return <BinaryStarCenter ... />;
  case "pulsar":     return <PulsarCenter ... />;
  case "neutron":    return <NeutronCenter ... />;
  case "black-hole": return <BlackHoleCenter ... />;
  case "single":
  default:           return <SingleStarCenter ... />;
}
```

Each branch reads `stars[role='primary'].color` (and `secondary_color` for single/binary) for tint; binary additionally reads `stars[role='secondary']` and `systems.binary_angle`.

**Implication:** the editor's center field is a 5-option dropdown that swaps the side-panel form contents:

- Switching to `binary` reveals a "Secondary star" section and the binary-angle slider; creates a default secondary `stars` row in local state. Switching back to anything else drops the secondary (with a "you'll lose the secondary star data" confirm if it has content).
- Switching among single / pulsar / neutron / black-hole only swaps the side-panel preview and the primary star's seeded default color. The existing primary row is preserved across kind changes (you keep your custom color when switching from `single` to `pulsar`).

**Adding a new center_kind** (e.g., a `wormhole` center) follows the body-type playbook: CHECK constraint update + new branch in the `StarSystemView.tsx` switch + new entry in the editor's dropdown.

#### 3.4.5 `celestial_bodies.biome` → color only (lookup table works here)

`getBodyColors()` in `lib/bodyColors.ts` returns `{ color, secondaryColor }` per biome — used to fill the **same circle SVG** with different colors. No biome-specific shape, no biome-specific size.

**Implication:** moving biomes to a `biomes(slug, label, color)` lookup table is genuinely additive. The GM adding a `crystal` biome with color `#A0E0FF` just renders as a circle with that color. No code change required. This is the only enum where the lookup-table approach pays off.

#### 3.4.6 `connections.layer` / `vortexes.layer` / `markers.layer` → filter only

The four layer values (`movement`, `story`, `conflict`, `invasion`) are used **only** in `components/SectorMap.tsx:136-145` to filter what's rendered. No layer-specific shape, color, or size. The filter is "show items where `layer IS NULL` OR `layer = activeLayer`."

**Implication:** layer is a stable structural enum (CHECK constraint). Adding a new layer requires both a CHECK update and a UI change in the layer picker — but no per-layer render branch.

#### 3.4.7 `vortexes.radius` + `vortexes.ratio_w` / `ratio_h` → free numbers

Vortexes render as a `wavyCloudPath` (`lib/sectorMapHelpers.ts:74`) — a 3-harmonic sine-perturbed blob. Inputs:
- `radius`: base radius in canvas units. If null, renderer uses default `80`.
- `ratio_w / ratio_h`: optional aspect-ratio pair (both NULL or both set). The blob is stretched elliptically by `[ratio_w, ratio_h]` normalized to its largest component. So `[6, 3]` produces a horizontal oval, `[3, 6]` a vertical one.

Originally the type was `ratio?: [number, number]` — we split into two nullable columns so the schema can express "no override" vs "explicit aspect" without nullable arrays.

**Implication:** the editor exposes three numeric inputs for vortexes: radius (slider, e.g. 40–300), aspect-w (number, 1–10), aspect-h (number, 1–10). Empty aspect fields = round blob. Drag-to-resize on canvas is a nice-to-have (Phase 6).

#### 3.4.8 `systems.territory_radius` + `markers.territory_radius` → free number

Both produce a `wavyCloudPath` underneath the entity. Defaults: systems use `TERRITORY_RADIUS = 120`, markers don't render a territory unless `territory_radius` is explicitly set. Same `wavyCloudPath` helper.

**Implication:** numeric input, or a "show territory" toggle that defaults to no territory and reveals a radius slider when on.

#### 3.4.9 `SECTOR_TERRITORY` (sector-level masking) stays in code

`lib/sectorMapHelpers.ts:8` hardcodes per-sector territory geometry (`cx`, `cy`, `arcStart`, `arcEnd`) used by `isInSectorTerritory()` to clip content to the sector's quarter-disc region on the galactic map. Keys are sector slugs (`atlas-sector`, `castell-sector`, etc.).

Since sector slugs are immutable (D7) and there is no sector CRUD UI, this mapping stays in code. Document it as "if a new sector is ever added, also add a `SECTOR_TERRITORY` entry" — which mirrors today's behavior. Not a migration concern, just a note.

### 3.5 Summary: what the editor can vs cannot add via UI

| Vocabulary | Editor can add new values? | Why |
|---|---|---|
| Body type | ❌ No | Each value has its own SVG branch + size constants. |
| Marker type | ❌ No | Each value has its own SVG branch. |
| Special attribute | ❌ No | Each value has its own SVG branch and color metadata. |
| Layer | ❌ No | Stable filter set; adding one needs UI work too. |
| System `center_kind` | ❌ No | Each value has its own SVG renderer in `StarSystemView.tsx`. Adding one is the same playbook as body type. |
| Star `fantasy_label` | ✅ Yes (free text) | Optional flavor copy. Never affects rendering, so any string is safe. |
| Biome | ✅ Yes (post-migration) | Lookup table; only drives color, not shape. |
| Allegiance | ⚠️ Lookup table, no UI in scope | Could be UI-editable later; for now seeded read-only. |
| Vortex radius / ratio | ✅ Yes (free numbers) | Geometry parameters, not enum values. |
| Territory radius | ✅ Yes (free number) | Geometry parameter. |

---

## 4. Loader strategy

`lib/sectors.ts` and `lib/starsystems.ts` become **hybrid loaders**. Logic, in order:

### `getSectorBySlug(slug)`

1. If `slug === 'atlas-sector-legacy'` → strip suffix, load entirely from `content/sectors/top-right.json` + `content/sectors/atlas-sector/`. Read-only, no edit overlay.
2. Otherwise → query the `sectors` table for the slug (returns sector metadata: name, color, description, nebula_color, published).
   - **If slug is `imperial-core`**: skip the inner DB joins. Instead, populate `systems` / `vortexes` / `connections` / `markers` from `content/sectors/core.json`, and the bespoke star-cluster content from `content/sectors/imperial-core/`. The sector-row metadata + JSON inner content are merged into the `SectorMetadata` shape.
   - **Otherwise** (Atlas, future DB-backed sectors): join `systems`, `stars`, `celestial_bodies`, `vortexes`, `markers`, `connections` filtered by `sector_id`. Compose the `SectorMetadata` shape so consumers don't change.

### `getAllSectors()`

- Query the `sectors` table — this returns Atlas + Imperial Core (and any future DB-backed sectors).
- For each row, call `getSectorBySlug(slug)` to assemble the full structure (which routes Imperial Core to JSON for its inner content per the rule above).
- The `/sectors/atlas-sector-legacy` route does **not** appear in the galactic-map listing.

### Galactic map layout consequences

The galactic map currently anchors 5 sector positions via `SECTOR_TERRITORY`. With placeholders deleted, only Atlas and Imperial Core have entries. `GalacticMap` must gracefully render only the sectors it has data for — empty quadrants are simply not drawn. Worth a visual smoke-test in Phase 2.

> **Latent bug to be aware of, not to fix here**: `app/sectors/page.tsx:9` does `sectors.find((s) => s.slug === "core")` but the actual slug is `imperial-core`, so `coreSector` is always `undefined`. The migration preserves current behavior (the lookup still resolves to undefined and the page still renders). Fix in a separate commit if you want it gone.

### `generateStaticParams()`

- Reads from DB (`SELECT slug FROM sectors`) plus the hardcoded `['imperial-core', 'atlas-sector-legacy']`.
- Pages get rebuilt at request time via ISR; `revalidatePath('/sectors/<slug>')` is called from every editor mutation endpoint.

### Kanka enrichment

Unchanged. The existing name-matching pass in `app/sectors/[slug]/page.tsx` runs after the loader returns, regardless of whether the source was DB or JSON.

---

## 5. API surface

All editor endpoints live under `/api/admin/map/*` and check `accessLevel >= 127`. Reads stay on the page server components (no public GET endpoints needed for the maps — they're SSG/ISR rendered).

### 5.1 Sector-scope save

```
PUT /api/admin/map/sectors/[slug]/save
```

Body shape — explicit changesets (smaller payload, clearer intent):

```ts
{
  systems: {
    create: Array<{ slug, name, x, y, allegiance_slug?, territory_radius?, binary_angle?, external_url?, published? }>,
    update: Array<{ id, ...fields }>,   // partial; only-touch-passed-fields rule (see lib/db/users.ts)
    delete: number[]                    // ids
  },
  vortexes: { create: [...], update: [...], delete: number[] },
  markers:  { create: [...], update: [...], delete: number[] },
  connections: { create: [...], update: [...], delete: number[] }
}
```

Server applies in one transaction (Neon's `sql.transaction()`), then calls `revalidatePath('/sectors/<slug>')` and `revalidatePath('/sectors')`.

### 5.2 System-scope save

```
PUT /api/admin/map/sectors/[slug]/systems/[systemSlug]/save
```

Body shape:

```ts
{
  system: {
    name?, x?, y?, allegiance_slug?, territory_radius?,
    center_kind?,        // 'single' | 'binary' | 'pulsar' | 'neutron' | 'black-hole'
    binary_angle?,       // required if center_kind === 'binary'; ignored otherwise
    external_url?, published?
  },
  stars: {
    primary:   { name?, fantasy_label?, color?, secondary_color?, external_url? },  // always present
    secondary: { name?, fantasy_label?, color?, secondary_color?, external_url? } | null,
                          // null = delete the secondary row (issued automatically when center_kind switches away from 'binary')
                          // object = upsert (used when center_kind === 'binary')
  },
  bodies: { create: [...], update: [...], delete: number[] }
}
```

Server-side rule: if `center_kind` is being changed, the API validates that `stars.secondary` is present iff the new kind is `binary`, and rejects mismatches with a 400. Switching to/from `binary` from the editor side panel pre-stages the right shape automatically.

System slug rename is allowed here. Server detects rename and emits a warning in the response listing every `connections.from_slug | to_slug | markers.slug?` row that *would have referenced the old slug* (a denormalized scan of the sector). Cascading is **not** performed — the GM uses the orphan panel to fix.

### 5.3 Read endpoints (small, optional)

If the editor needs live data outside the page render (e.g., search across slugs for the connection picker), add:

```
GET /api/admin/map/sectors/[slug]                 # full sector incl. systems summary
GET /api/admin/map/sectors/[slug]/searchable      # SearchOverlay payload extended w/ vortexes + markers
```

Both require ≥127.

---

## 6. Editor overlay UX

### 6.1 The toggle

Top-right of `/sectors/[slug]` and the focused-system view: a `View | Edit` segmented control, visible only when `user.accessLevel >= 127`. Switching to `Edit` puts the page into edit mode for that view's scope only (see D11).

### 6.2 Sector-edit mode

Active scope: systems, vortexes, markers, connections **on the sector canvas**. System drill-down is disabled (clicking a system pin selects it for editing instead of zooming in).

#### Canvas affordances
- Drag a system / vortex / free marker to reposition. New position stages in local state, not persisted until SAVE.
- Drag a connection-attached marker along the bezier curve (changes its `position` 0–1).
- Right-click empty canvas → context menu: `Create System`, `Create Vortex`, `Create Marker`. Choosing one opens a modal pre-filled with the click coordinates; GM enters slug, name, optional metadata. The new entity stages locally with a temporary id.
- Right-click a pin → context menu: `Edit`, `Delete` (with confirm), `Add connection from here`.
- Click a pin → side panel opens with that entity's form.

#### Side panel (right rail)
Always visible in edit mode. Tabs:
1. **Selection** — form fields for the currently selected entity. Live preview as you type (color picker changes the pin color immediately).
2. **Connections by layer** — accordion grouped by `layer` (movement / story / conflict / invasion / no-layer). Each entry shows `from → to` with a small badge for any endpoint slug that **doesn't resolve to a real entity in the sector**. This is the orphan-cleanup surface. Click an entry to select that connection on the canvas.
3. **Add connection** — button opens a small dialog with two searchable inputs (A / B), each backed by `SearchOverlay`'s index extended with vortexes and markers. After A and B are chosen, a default-styled connection is added to the canvas; further styling happens in the Selection tab.

#### Top toolbar (sticky)
- `SAVE` button (disabled when no pending changes; counts unsaved edits as a badge).
- `Discard` button (clears local state, reverts canvas to last-saved DB state).
- Layer filter (matches current viewer behavior — toggling layers in edit mode is for visibility only, never moves data between layers).
- Beforeunload listener fires a dirty guard when unsaved changes exist.

### 6.3 System-edit mode

Reached only when sector-edit is OFF and the GM has drilled into a system. Toggle `View | Edit` appears in the focused-system view.

Active scope: stars (primary/secondary), bodies, system-level metadata (binaryAngle, external_url, allegiance).

- Drag a body along the orbit ring → changes `orbit_position` (0–360°).
- Drag a body radially in/out → changes `orbit_distance` (0–1, clamped).
- Right-click empty space → `Create Body`.
- Right-click a body → `Edit`, `Delete`.
- Side panel:
  - **Selection** — body form (name, type, biome dropdown from `biomes` table, lore, special_attribute, allegiance, label_position, published, external_url).
  - **System** — system metadata (name, allegiance, external_url, published) and the **center configuration**:
    - `center_kind` dropdown (Single / Binary / Pulsar / Neutron / Black Hole) with live SVG preview.
    - **Primary star** form (always visible): name, color, secondary_color, optional fantasy_label, external_url. Defaults pre-fill on kind switch when the field has never been edited.
    - **Secondary star** form (only when kind=`binary`): same fields. Auto-created with defaults when switching to binary; auto-removed (with confirm if dirty) when switching away.
    - **Binary angle** slider (only when kind=`binary`).
- SAVE / Discard / dirty guard identical to the sector view.

### 6.5 Form-field specs for fixed-vocabulary fields

Driven by §3.4. The editor's dropdowns and inputs are explicit about which fields are bound to render code.

| Field | Editor control | Source of options |
|---|---|---|
| Body `type` | Dropdown, 7 options | Hardcoded list (matches CHECK). Each option renders a tiny preview of its SVG shape next to the label. |
| Body `biome` | Searchable dropdown | `SELECT slug, label, color FROM biomes`. Cached client-side. Shows a small color swatch per option. Future: "Add new biome" inline (out of scope now). |
| Body `special_attribute` | Dropdown with icon previews, 7 options (6 + "none") | Hardcoded list. Each option renders `<SpecialAttributeIcon />` as its preview, since the icon IS the value. |
| Body `allegiance_slug` | Searchable dropdown + "None" | `SELECT slug, name, color, logo_url FROM allegiances`. Shows logo + color swatch. |
| Body `label_position` | Segmented control: `Top` / `Bottom` | Hardcoded. |
| Marker `type` | Dropdown, 5 options | Hardcoded list. Each option renders its SVG preview. |
| Marker `layer` | Dropdown, 4 options + "None" | Hardcoded list (matches CHECK). |
| Connection `layer` | Dropdown, 4 options + "None" | Hardcoded list. |
| Connection `dashes` | Text input (stroke-dasharray syntax) + 4 preset chips: `solid`, `dashed`, `dotted`, `default` | Free text falls through. Presets are convenience. |
| Connection `curvature` | Number input + slider (–200..200) | Negative = bend left of from→to; positive = bend right. |
| Connection `opacity` | Slider (0..1) | |
| Vortex `radius` | Slider + number (40..300) | |
| Vortex `ratio_w` / `ratio_h` | Two number inputs, both required if either set | Empty = round blob. |
| Vortex `layer` | Dropdown, 4 options + "None" | Hardcoded list. |
| System `center_kind` | Dropdown with live preview, 5 options | Hardcoded list (matches CHECK). Each option shows a small SVG preview of how the center will render. Switching reveals/hides downstream fields per §3.4.4. |
| Star `color` (primary, and secondary for binaries) | Color picker (hex), pre-filled per kind | Defaults documented in §3.4.4 (e.g. `#A78BFA` for black-hole). Applies as accent/rim tint for all kinds. |
| Star `secondary_color` (single/binary only) | Color picker (hex), pre-filled | Hidden when `center_kind` is exotic (pulsar/neutron/black-hole use it implicitly or not at all per the renderer). |
| Star `fantasy_label` (primary, optional) | Free text input with helper: "Decorative only — doesn't affect rendering." | Free text. Examples shown as placeholder: "Red Supergiant, Yellow Dwarf, …" |
| Star `name` | Required text | One per visible star row (1 for single/exotic, 2 for binary). |
| System `binary_angle` (binary only) | Slider 0–360° + numeric | Hidden when `center_kind` ≠ `binary`. Default 0 = primary on the right. |
| Color fields (sector accent, connection color, etc.) | Color picker (hex) returning 7-char `#RRGGBB` | Validated client-side. |

#### Adding a new value to a fixed enum

For each fixed-enum field (body type, marker type, special_attribute, layer), document the procedure as code-change-only:

1. Update the `CHECK` constraint in `lib/db/schema.sql` (and apply manually via Neon console — same as every other schema change).
2. Add a render branch in the matching component:
   - Body type → `components/sectormap/bodies/BodyShape.tsx` + entries in `bodyLabelR()` and `bodyHitRadius()` in `lib/sectorMapHelpers.ts`.
   - Marker type → `components/sectormap/FreeMarkerLayer.tsx` and `ConnectionMarkerLayer.tsx`, plus `MARKER_COLORS` in `lib/bodyColors.ts`.
   - Special attribute → `components/specialAttributes/SpecialAttributeIcon.tsx` (new `case`) + `SPECIAL_ATTRIBUTES` in `specialAttributeData.ts`.
   - Layer → CHECK constraint only; nothing else (filter logic in `SectorMap.tsx` is value-agnostic).
3. Add the new value to the editor's hardcoded dropdown list (same file as the dropdown component).
4. Re-deploy.

No data migration is required because new values are additive — existing rows keep their values.

### 6.4 What edit mode never does

- Doesn't expose `sector` slug, name, color, description, nebula_color. Those are fixed at seed time per D7.
- Doesn't allow creating or deleting a star — primary always exists; secondary is created by toggling "Binary system" on, deleted by toggling off.
- Doesn't expose layer enum editing (CHECK constraint, structural).
- Doesn't expose body type enum editing (CHECK constraint).
- Doesn't allow drag in the layer filter — that's a viewer control.

---

## 7. Migration plan

Phased so each step is independently mergeable and reversible until the final cutover.

### Phase 1 — schema + seed (no behavior change) — ✅ COMPLETED 2026-05-24

1. Append the new tables to `lib/db/schema.sql`. Applied to Neon via one-shot `lib/db/apply-schema.ts` (deleted after running).
2. Add `lib/db/sectors.ts`, `systems.ts`, `stars.ts`, `bodies.ts`, `vortexes.ts`, `markers.ts`, `connections.ts`, `allegiances.ts`, `biomes.ts` — query modules following the `lib/db/users.ts` pattern. Also added `lib/mapEnums.ts` (runtime enums + per-center-kind default colors).
3. One-shot `lib/db/seed-map.ts` (deleted after running):
   - Insert `allegiances` rows from `ALLEGIANCES`.
   - Insert `biomes` rows from `bodyColors.ts`.
   - Insert the **Imperial Core sector row** (metadata from `content/sectors/core.json`: slug=`imperial-core`, name, color, description, nebula_color, published). No descendant rows.
   - Insert **empty shell rows** for the three placeholder sectors by reading their JSON metadata: vintar-sector (`top-left.json`), castell-sector (`bottom-left.json`), denerum-sector (`bottom-right.json`). No descendant rows.
   - Insert full Atlas content (sector + 6 systems + their stars + their bodies + vortexes + markers + connections) by reading the JSON files.
   - **Map JSON `star.type` → `systems.center_kind`** during seed:
     - `secondaryStar` present → `binary`
     - else case-insensitive substring match on the primary `star.type`:
       - contains `"pulsar"`  → `pulsar`
       - contains `"neutron"` → `neutron`
       - contains `"black hole"` or `"blackhole"` → `black-hole`
       - otherwise → `single`
     - Original `star.type` string (e.g. `"Red Supergiant"`, `"Blue Pulsar"`) is preserved verbatim in `stars.fantasy_label` so the cosmetic copy survives the migration.
   - Skip Imperial Core inner content entirely (only its sector row is seeded).
4. Run seed script once on Neon. Verify counts match.
5. No app-visible changes yet — JSON loaders still in use.

**Verified counts (2026-05-24 run):** allegiances=11, biomes=16, sectors=5, systems=6, stars=7, bodies=26, vortexes=1, connections=7, markers=4. `center_kind` correctly derived: Pernat=binary, unkown-system=pulsar, rest=single.

**Reversibility:** drop the new tables; no production traffic touched them.

### Phase 2 — read path cutover — ✅ COMPLETED 2026-05-24

1. Replaced `lib/sectors.ts` and `lib/starsystems.ts` with hybrid loaders. Public API is now async: `getSectorBySlug`, `getAllSectors`, `getSectorSlugs`, `getStarSystemBySlug`. The three unused legacy exports (`getAllStarSystems`, `findStarSystem`, `getStarSystemSlugs`) were dropped.
2. Updated callers in `app/sectors/page.tsx` (became `async`) and `app/sectors/[slug]/page.tsx` (await on every loader call, including inside the systems-data loop).
3. `/sectors/atlas-sector-legacy` route now generated by `generateStaticParams()` (the loader appends the legacy slug). Loader strips the suffix and reads from `content/sectors/top-right.json` + `atlas-sector/`.
4. Imperial Core path verified: sector metadata merged from DB row + JSON inner content (`core.json` + `imperial-core/axiom-system.json`).
5. **Cleanup commit:**
   - Deleted `content/sectors/top-left.json`, `bottom-left.json`, `bottom-right.json`. Data lives in DB as empty shell rows.
   - `SECTOR_TERRITORY` in `lib/sectorMapHelpers.ts` not touched — all five sector slugs still exist.

**Verification:** `npm run build` succeeds; 48 static pages generated; no typecheck errors. Pre-existing `swr` dep was missing from node_modules; resolved with `npm install`.

**Reversibility:** revert the loader files; if Step 5 has been merged, restore the deleted JSONs from git history. Keep Step 5 in its own commit so it's a clean revert target.

### Phase 3 — editor backend — ✅ COMPLETED 2026-05-24

1. Built three endpoints under `/api/admin/map/sectors/[slug]/`:
   - `PUT save` — sector-scope changeset (systems / vortexes / connections / markers create-update-delete)
   - `PUT systems/[systemSlug]/save` — system-scope changeset (system metadata + stars upsert + bodies CRUD)
   - `GET searchable` — flat list of all sluggable endpoints (systems + vortexes + markers) for the connection picker
2. Each route has an inline `requireSuperAdmin()` helper (mirrors `/api/admin/messages` pattern). Returns 403 for non-superadmin, 400 for `imperial-core` / `atlas-sector-legacy` (read-only).
3. Each save endpoint applies in order: deletes → updates → creates. Calls `revalidatePath('/sectors')` + `revalidatePath('/sectors/${slug}')` on success.
4. Extended `lib/db/{systems,stars,bodies,vortexes,connections,markers}.ts` with `update*` (per-field, only-touch-passed-fields pattern from `users.ts`) and `delete*` functions. `stars.ts` got `upsertStar` + `deleteStarByRole` for the binary-toggle flow.

**Smoke tested via curl:** all four endpoints return 403 unauthenticated; the deeply-nested system save needed a `.next` cache clear after creation before Turbopack picked it up (one-time dev-server quirk, not a runtime issue).

**Trade-off accepted:** queries are sequential, not wrapped in `sql.transaction()`. Partial failures leave inconsistent state; the editor re-syncs from a fresh GET on next render. Acceptable for a single-superadmin editor; revisit if needed.

**Reversibility:** delete the three route files + revert the lib/db module extensions. No client calls these yet.

### Phase 4 — editor frontend — ✅ COMPLETED 2026-05-24 (with Phase 4b deferred)

**Shipped in Phase 4:**
1. `EditModeProvider` (`components/sectormap/edit/EditModeProvider.tsx`) — context with `mode`, `selection`, `pending` changesets, `dirty` flag, beforeunload guard, save flow that calls the API + `router.refresh()` to re-fetch revalidated pages.
2. `EditToggle` — View/Edit segmented control, only rendered when `accessLevel >= 127`.
3. `EditToolbar` — top-center, shows pending count + Save/Discard + any save error.
4. `SidePanel` — right rail with two tabs: **Selection** (form for the selected entity) and **Connections** (grouped by layer, with orphan badges when an endpoint slug doesn't resolve).
5. `SelectionPanel` — per-entity forms (system / vortex / marker / connection) with allegiance dropdown, layer dropdown, marker-type dropdown, color/hex inputs, and per-form Delete button.
6. `ConnectionsByLayerPanel` — orphan management surface (D7).
7. `AddConnectionDialog` — two-step endpoint picker; index includes systems + vortexes + markers (D12).
8. `CreateEntityModal` triggered by right-click context menu on the canvas → captures click coords in SVG space, opens a typed form, stages the new entity locally with a temp id.
9. Click-to-select on systems (existing focus handler overridden in edit mode) and vortexes (added inline `onClick` with conditional `pointerEvents`).
10. `lib/jsonMigrate.ts` already in place from the earlier rename — JSON-key compatibility shim.
11. Types `SystemPin` / `VortexPin` / `MapMarker` / `ConnectionLine` gained an optional `id?: number` so the editor can reference DB rows. View-mode renderers are unaffected.
12. `lib/sectors.ts` loader now attaches the DB id to each emitted entity.
13. `app/sectors/[slug]/page.tsx` reads the `nh_user` cookie + looks up the user to pass `userAccessLevel` into SectorMap. Page is already dynamic (DB-backed loader), so no static-generation regression.

**Smoke-tested end-to-end:**
- `GET /api/admin/map/sectors/atlas-sector/searchable` as gm → 200 with all 11 endpoints (6 systems + 1 vortex + 4 markers).
- `PUT /api/admin/map/sectors/atlas-sector/save` with `{ systems: { update: [{ id: 3, territoryRadius: 172 }] } }` → 200; reverted in a second call.
- `GET /sectors/atlas-sector` with `nh_user=gm` → 200, page renders cleanly.

### Phase 4b — drag + click + system-edit — ✅ COMPLETED 2026-05-24

**Shipped:**
1. **`useDragPin` hook** — generic SVG-space drag handler. Captures pin position at mousedown, installs document-level mousemove/mouseup listeners for the duration of the gesture, only commits if mouse actually moved (>0.5 px threshold). Stops propagation to prevent pan-init.
2. **Drag-to-reposition** wired for **systems**, **vortexes**, and **free markers**. Each pin gets `onMouseDown` and a cursor change (`move`) in edit mode. The dragged entity's rendered position is overridden from the live drag state until commit.
3. **Click-to-select for free markers** — `FreeMarkerLayer` accepts `isEditing`, `editPick`, `editDragStart`, `selectedMarkerId` props. In edit mode, clicks call `editPick` (selects in side panel) instead of showing the tooltip card; mousedown initiates drag; selection adds a glow filter.
4. **System-edit modal** (`SystemEditModal.tsx`) — opened by a new "Edit System" button that appears when the GM is zoomed into a system in view mode. Self-contained:
   - System metadata: name, external URL, published, center kind dropdown, binary angle slider (only when binary).
   - Primary star form: name, fantasy label (decorative free text), color picker, secondary color picker, external URL.
   - Secondary star form: same, only visible when `center_kind = binary`. Auto-created on binary toggle, removed on toggle-off.
   - Body list: each body is a collapsible row with all fields — type, biome (dropdown sourced from DB), allegiance, special attribute, orbit position slider (0–360°), orbit distance slider (0–1), label position, lore, external URL. Bodies can be added (auto temp-id) and deleted.
   - SAVE button calls `PUT /api/admin/map/sectors/[slug]/systems/[systemSlug]/save` then `router.refresh()`. Dirty guard on close.
5. **DB primary key on `CelestialBody`** — added `dbId?: number` so the editor can reference rows for update/delete. Loader sets it.
6. **Biomes prefetched server-side** in `app/sectors/[slug]/page.tsx` and passed through `SectorMap` → `SystemEditModal` (only when `userAccessLevel >= 127`).

**Smoke-tested:**
- System save no-op (full payload, no changes) → 200.
- System save with `centerKind: "single"` + `binaryAngle: null` → 200.

**Still deferred to Phase 4c (low priority, all form-based fallbacks work):**
- **Body orbit drag** in the system-edit view. Bodies are sliders in the modal today.
- **Live SVG preview of `center_kind`** in the modal dropdown. The change is visible after Save (since the page refreshes).
- **Editing connection-attached markers' parent connection** while you have the marker selected. They appear in the Connections tab grouped by parent.

**Reversibility:** the entire edit module lives under `components/sectormap/edit/` plus four prop additions to `app/sectors/[slug]/page.tsx` and surgical changes to `components/SectorMap.tsx` (wrapper for provider, drag wiring, modal mount) and `components/sectormap/FreeMarkerLayer.tsx` (edit-mode pass-throughs). Delete the edit directory + revert those edits to drop Phases 4 + 4b cleanly.

### Phase 5 — cleanup

1. Once the GM has used the editor for a session or two and confirmed Atlas renders correctly through the DB path, **leave the JSON files in place** — they back the `-legacy` fallback URL.
2. Document the seed-from-JSON path as one-way: once seeded, the JSON files are no longer the source of truth for `atlas-sector`.
3. If the legacy fallback is later deemed unneeded, the `-legacy` route + the JSON files can be deleted in a separate PR.

---

## 8. Risks & open issues

| Risk | Mitigation |
|------|-----------|
| **Orphan connections invisible on the map** after a slug rename | The "Connections by layer" panel in the side rail always lists every connection regardless of whether endpoints resolve; orphans are badged. |
| **Two GMs editing simultaneously** stomp each other (last-write-wins) | Single-superadmin reality makes this acceptable. If it later becomes a problem, add an `updated_at` precondition to the batch save (optimistic lock per entity). |
| **ISR cache staleness** if `revalidatePath` is missed | Centralize the revalidate call in a single helper used by all mutation endpoints; one place to grep. |
| **Allegiance / biome key drift** between code and DB | Both lookup tables are seeded from the existing code constants; the loader for `lib/allegiances.ts` becomes a thin cache over the DB rows. No more parallel sources of truth. |
| **Imperial Core slug-routed loader** drifts from DB metadata | The `sectors` row for `imperial-core` and `core.json` both carry sector-level metadata (name, color, description). Treat the DB row as canonical for the listing; if `core.json` is hand-edited, re-run the Imperial Core portion of the seed (idempotent upsert). |
| **Empty-sector page rendering** for vintar/castell/denerum | The DB rows have no systems/vortexes/markers/connections. The loader returns a valid `SectorMetadata` with empty arrays; `SectorMap` must already handle this (the placeholders rendered the same way before migration). Confirm via the §10 acceptance check for the three empty-sector routes. |
| **Atlas legacy URL drift** as the DB version evolves | Document that `/sectors/atlas-sector-legacy` is a frozen snapshot — JSON edits won't propagate to it because nobody edits the JSON anymore. If the legacy view diverges visibly from the DB view, that's fine and expected; it's a rollback option, not a parallel canon. |
| **Searchbox index growing stale** during edit mode (new entities haven't hit the DB yet) | The connection picker reads from local edit state, not the DB, while in edit mode. Falls back to DB for entities not in the staged changes. |
| **`generateStaticParams` at build time hits DB** | Mirror the pattern from `lib/db/users.ts` — the function awaits `sql\`SELECT slug FROM sectors\``. Build environment needs `DATABASE_URL`, which it already has for other DB-backed pages. |
| **GM expects to add new body type / marker type / special attribute / center kind via UI** | Dropdowns are explicitly hardcoded lists with a tooltip/footnote: "Adding a new option requires a code change — see map-migration.md §3.4." Avoids the "why is my new biome not rendering" confusion (which won't happen for biomes, but could happen if the GM extrapolates from the biome editor to other dropdowns). |
| **Switching `center_kind` away from `binary` discards the secondary star** | Confirm modal listed in §6.3: "Switching from binary will remove [secondary star name] — continue?" Only when the secondary row has non-default data. Same UX pattern as the body delete confirm. |

### Open questions to confirm during implementation

1. **Drag snapping** — should pins snap to a grid when dragged, or be pixel-precise? Pixel-precise is the default; grid snapping can be a Phase-6 enhancement.
2. **Undo within a session** — local state is staged but not undoable per-action. If this becomes painful, add a simple action stack later.
3. **Layer authoring** — layers are a fixed enum (`movement`, `story`, `conflict`, `invasion`). If new layers are needed, that's a schema change + render-logic change, not a content edit.
4. **Vortex rename** — same rules as system slug rename. Connections referencing the old slug become orphans. Surface in the orphan panel.

---

## 9. File-level inventory

### New files

```
lib/db/sectors.ts
lib/db/systems.ts
lib/db/stars.ts
lib/db/bodies.ts
lib/db/vortexes.ts
lib/db/markers.ts
lib/db/connections.ts
lib/db/allegiances.ts
lib/db/biomes.ts
lib/mapEnums.ts                                    # runtime enums + per-kind defaults
app/api/admin/map/sectors/[slug]/save/route.ts
app/api/admin/map/sectors/[slug]/systems/[systemSlug]/save/route.ts
app/api/admin/map/sectors/[slug]/searchable/route.ts
components/sectormap/edit/EditModeProvider.tsx
components/sectormap/edit/EditToggle.tsx
components/sectormap/edit/SectorEditOverlay.tsx
components/sectormap/edit/SystemEditOverlay.tsx
components/sectormap/edit/SidePanel.tsx
components/sectormap/edit/ConnectionsByLayerPanel.tsx
components/sectormap/edit/AddConnectionDialog.tsx
components/sectormap/edit/CreateEntityModal.tsx
components/sectormap/edit/useStagedChanges.ts
```

### Modified files

```
lib/db/schema.sql                                  # append the new tables
lib/sectors.ts                                     # hybrid loader (DB + JSON fallback for imperial-core + legacy)
lib/starsystems.ts                                 # hybrid loader
lib/allegiances.ts                                 # becomes a cache over allegiances table
lib/bodyColors.ts                                  # becomes a cache over biomes table
types/sector.ts                                    # drop `hidden` fields; allegiance/layer become strings
types/starsystem.ts                                # drop `hidden` and `image`; biome becomes string
app/sectors/page.tsx                               # no logic change; loader handles merge
app/sectors/[slug]/page.tsx                        # mount EditToggle gated on accessLevel
components/SectorMap.tsx                           # wire in EditModeProvider; disable drill-down when sector-edit on
components/sectormap/SearchOverlay.tsx             # extend index to include vortexes and markers
```

### Untouched

```
content/sectors/core.json                          # still loaded for Imperial Core (inner content)
content/sectors/imperial-core/                     # still loaded (cluster JSON)
content/sectors/top-right.json                     # still loaded for /sectors/atlas-sector-legacy
content/sectors/atlas-sector/                      # still loaded for legacy
```

### Deleted (Phase 2, Step 5)

```
content/sectors/top-left.json                      # vintar-sector — data promoted to DB shell row
content/sectors/bottom-left.json                   # castell-sector — data promoted to DB shell row
content/sectors/bottom-right.json                  # denerum-sector — data promoted to DB shell row
```

`SECTOR_TERRITORY` in `lib/sectorMapHelpers.ts` is **not** modified — all five entries stay.

---

## 10. Acceptance criteria

- [ ] `npm run build` succeeds with the new schema and seeded Atlas content.
- [ ] `/sectors` shows all five sectors in their original layout positions, identical to pre-migration: Atlas (top-right) with content, Imperial Core (center) with its cluster, and the three placeholder quadrants rendering as empty sectors.
- [ ] `/sectors/atlas-sector` renders pixel-equivalent to the pre-migration build (DB-backed).
- [ ] `/sectors/imperial-core` still renders the hand-built cluster from JSON — sector metadata comes from DB, inner content from `core.json` + `imperial-core/`.
- [ ] `/sectors/atlas-sector-legacy` renders pixel-equivalent to the current `/sectors/atlas-sector` (frozen JSON snapshot).
- [ ] `/sectors/vintar-sector`, `/sectors/castell-sector`, `/sectors/denerum-sector` resolve and render their empty-sector page (no 404), pulling metadata from the DB shell rows.
- [ ] `top-left.json`, `bottom-left.json`, `bottom-right.json` no longer exist on disk; `lib/sectorMapHelpers.ts` `SECTOR_TERRITORY` retains all five entries.
- [ ] A superadmin sees the `View | Edit` toggle on Atlas; a regular user does not.
- [ ] In sector-edit mode: drag a system, change its allegiance, SAVE, refresh — change persists and renders.
- [ ] In sector-edit mode: right-click empty canvas → create marker → SAVE — new marker persists.
- [ ] In sector-edit mode: "Add connection" picks two endpoints via searchbox → SAVE — connection renders on the right layer.
- [ ] After renaming a system slug whose old slug was an endpoint of two connections, both connections appear in the "Connections by layer" panel with the orphan badge, and the GM can edit their endpoints to point at the new slug.
- [ ] In system-edit mode: drag a planet along its orbit → SAVE → reload — orbit_position persists.
- [ ] In system-edit mode: switch `center_kind` from `single` to `binary` → a default secondary star appears in the side panel → set its color → SAVE → reload — both stars render at the configured `binary_angle`.
- [ ] In system-edit mode: switch `center_kind` from `single` to `black-hole` → the canvas immediately previews the black-hole SVG with the seeded `#A78BFA` accent → change the color → SAVE → reload — black-hole accent picks up the new color.
- [ ] After seeding, the `unkown-system` (Atlas) renders as a pulsar — confirming the JSON `"Blue Pulsar"` value was correctly mapped to `center_kind='pulsar'` during seed.
- [ ] Discarding pending changes reverts the canvas without a DB write.
- [ ] Navigating away with unsaved changes triggers the beforeunload prompt.
- [ ] Imperial Core is never reachable via the edit toggle.
