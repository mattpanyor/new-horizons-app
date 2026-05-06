# Starmap → DB Migration Plan

Move sector and star-system content from JSON files in `content/sectors/` into Neon Postgres, fully normalized, in a shape that will lift cleanly into a future production world-builder product.

## Goals

1. All sector + system content lives in Postgres.
2. The read path (`lib/sectors.ts` consumers) keeps the same `SectorMetadata` / `StarSystemMetadata` shape — components don't change.
3. Schema is shaped so an admin editor (next feature) can do per-entity CRUD without rewriting giant JSONB blobs.
4. Migration is one-shot from existing JSON; JSON files stay in git as seed source but are not read at runtime.

Out of scope here (handled when lifted into the product): tenancy, world scoping, permissions, collaborative editing, revisions/history, asset management.

---

## Schema

All tables get `id SERIAL PRIMARY KEY`, `created_at TIMESTAMPTZ DEFAULT NOW()`, `updated_at TIMESTAMPTZ DEFAULT NOW()` unless noted.

### `sectors`
| col | type | notes |
|---|---|---|
| slug | VARCHAR(80) UNIQUE NOT NULL | |
| name | TEXT NOT NULL | |
| description | TEXT | |
| color | VARCHAR(7) NOT NULL | hex |
| nebula_color | VARCHAR(7) | hex, nullable |
| published | BOOLEAN NOT NULL DEFAULT true | |

### `star_systems`
| col | type | notes |
|---|---|---|
| sector_id | INT NOT NULL REFERENCES sectors(id) ON DELETE CASCADE | |
| slug | VARCHAR(80) NOT NULL | |
| name | TEXT NOT NULL | |
| topology | VARCHAR(40) NOT NULL DEFAULT 'single' | code-defined slug (`single`, `binary`, `pulsar`, `neutron-star`, `black-hole`, ...). Drives rendering and determines whether `secondary_star` is allowed. Validated app-side from `lib/systemTopologies.ts`. |
| star | JSONB NOT NULL | `{name, color, externalUrl?}` — primary star. No type/classification field; topology is on the system. |
| secondary_star | JSONB | nullable, same shape; only populated when topology allows a companion |
| binary_angle | NUMERIC | degrees 0-360, nullable; meaningful only for `topology='binary'` |
| published | BOOLEAN NOT NULL DEFAULT true | |
| external_url | TEXT | |
| | | UNIQUE (sector_id, slug) |

### `planet_biomes`
Taxonomy table. Seeded from existing code-side enum (`PlanetBiome` in `types/starsystem.ts`) + colors from `lib/bodyColors.ts`. Editable later so users can define their own biomes when this lifts into the product.
| col | type | notes |
|---|---|---|
| slug | VARCHAR(40) UNIQUE NOT NULL | e.g. `mining`, `continental` |
| name | TEXT NOT NULL | display label |
| color | VARCHAR(7) NOT NULL | hex |
| description | TEXT | |
| icon_url | TEXT | |

### `special_attributes`
Taxonomy table. Seeded from the existing code-side union (`special_attribute` in `types/starsystem.ts`). Editable later.
| col | type | notes |
|---|---|---|
| slug | VARCHAR(40) UNIQUE NOT NULL | e.g. `lathanium`, `nobility` |
| name | TEXT NOT NULL | |
| description | TEXT | |
| icon_url | TEXT | |

### `celestial_bodies`
| col | type | notes |
|---|---|---|
| system_id | INT NOT NULL REFERENCES star_systems(id) ON DELETE CASCADE | |
| slug | VARCHAR(80) NOT NULL | corresponds to `id` field in JSON |
| name | TEXT NOT NULL | |
| type | VARCHAR(30) NOT NULL | planet/station/moon/ship/fleet/asteroid-field/black-hole — kept as text, see Decisions |
| biome_id | INT REFERENCES planet_biomes(id) ON DELETE SET NULL | nullable |
| orbit_position | NUMERIC NOT NULL | degrees 0-360 |
| orbit_distance | NUMERIC NOT NULL | 0-1 normalized |
| label_position | VARCHAR(10) | top/bottom |
| special_attribute_id | INT REFERENCES special_attributes(id) ON DELETE SET NULL | nullable |
| allegiance | VARCHAR(40) | references code-side registry, no FK (see open items) |
| external_url | TEXT | |
| image_url | TEXT | |
| lore | TEXT | |
| published | BOOLEAN NOT NULL DEFAULT true | |
| hidden | BOOLEAN NOT NULL DEFAULT false | |
| | | UNIQUE (system_id, slug) |

### `system_pins`
Placement of a star system on its sector map. Separate from `star_systems` because it's positional metadata.
| col | type | notes |
|---|---|---|
| sector_id | INT NOT NULL REFERENCES sectors(id) ON DELETE CASCADE | |
| system_id | INT NOT NULL REFERENCES star_systems(id) ON DELETE CASCADE | |
| slug | VARCHAR(80) NOT NULL | matches the system's slug; denormalized for connection lookups |
| x | NUMERIC NOT NULL | 0-1200 |
| y | NUMERIC NOT NULL | 0-800 |
| allegiance | VARCHAR(40) | |
| territory_radius | NUMERIC | nullable |
| hidden | BOOLEAN NOT NULL DEFAULT false | |
| | | UNIQUE (sector_id, slug) |
| | | UNIQUE (sector_id, system_id) |

### `vortex_pins`
| col | type | notes |
|---|---|---|
| sector_id | INT NOT NULL REFERENCES sectors(id) ON DELETE CASCADE | |
| slug | VARCHAR(80) NOT NULL | |
| name | TEXT NOT NULL | |
| x | NUMERIC NOT NULL | |
| y | NUMERIC NOT NULL | |
| color | VARCHAR(7) | nullable, defaults to sector color |
| radius | NUMERIC | default 80 |
| ratio_w | NUMERIC | nullable |
| ratio_h | NUMERIC | nullable |
| layer | VARCHAR(20) | movement/story/conflict/invasion |
| hidden | BOOLEAN NOT NULL DEFAULT false | |
| | | UNIQUE (sector_id, slug) |

### `map_markers`
Free-floating only. Connection-attached markers live inline on the connection row.
| col | type | notes |
|---|---|---|
| sector_id | INT NOT NULL REFERENCES sectors(id) ON DELETE CASCADE | |
| slug | VARCHAR(80) | nullable |
| type | VARCHAR(20) NOT NULL | ship/fleet/anomaly/poi/black-hole |
| name | TEXT NOT NULL | |
| allegiance | VARCHAR(40) | |
| external_url | TEXT | |
| x | NUMERIC NOT NULL | |
| y | NUMERIC NOT NULL | |
| angle | NUMERIC NOT NULL DEFAULT 0 | |
| territory_radius | NUMERIC | |
| layer | VARCHAR(20) | |
| hidden | BOOLEAN NOT NULL DEFAULT false | |
| | | UNIQUE (sector_id, slug) WHERE slug IS NOT NULL |

### `connections`
Endpoints can be either system_pins or vortex_pins. **Use option (a)**: two nullable FK pairs, with a CHECK that exactly one of each side is populated.
| col | type | notes |
|---|---|---|
| sector_id | INT NOT NULL REFERENCES sectors(id) ON DELETE CASCADE | |
| from_system_pin_id | INT REFERENCES system_pins(id) ON DELETE CASCADE | |
| from_vortex_pin_id | INT REFERENCES vortex_pins(id) ON DELETE CASCADE | |
| to_system_pin_id | INT REFERENCES system_pins(id) ON DELETE CASCADE | |
| to_vortex_pin_id | INT REFERENCES vortex_pins(id) ON DELETE CASCADE | |
| curvature | NUMERIC | default 0 |
| label | TEXT | |
| color | VARCHAR(7) | |
| dashes | VARCHAR(20) | default "4 6" |
| opacity | NUMERIC | default 0.35 |
| layer | VARCHAR(20) | |
| hidden | BOOLEAN NOT NULL DEFAULT false | |
| **inline marker (all nullable, 1:1 with connection)** | | |
| marker_type | VARCHAR(20) | |
| marker_slug | VARCHAR(80) | |
| marker_name | TEXT | |
| marker_allegiance | VARCHAR(40) | |
| marker_external_url | TEXT | |
| marker_position | NUMERIC | 0-1 along trimmed line |
| marker_territory_radius | NUMERIC | |

CHECK: `(from_system_pin_id IS NOT NULL) <> (from_vortex_pin_id IS NOT NULL)` and same for `to_*`.

### Indexes
- `star_systems(sector_id)`, `celestial_bodies(system_id)`, `system_pins(sector_id)`, `vortex_pins(sector_id)`, `map_markers(sector_id)`, `connections(sector_id)`
- `system_pins(system_id)` for reverse lookup
- `celestial_bodies(biome_id)`, `celestial_bodies(special_attribute_id)` for taxonomy filters
- FK columns on `connections` for cascade performance

---

## Implementation steps

### 1. Schema
- Append the above tables to `lib/db/schema.sql`.
- Apply manually against Neon (no migrations dir, per existing convention). Document the apply step in a comment.

### 2. Data layer
Create `lib/db/sectors.ts`:
- `getSectorBySlug(slug): Promise<SectorMetadata>` — single sector + all related entities, assembled into the existing `SectorMetadata` shape (so `SectorMap` etc. don't change).
- `getSectorSlugs(): Promise<string[]>`
- `getAllSectors(): Promise<SectorMetadata[]>`
- `getStarSystem(sectorSlug, systemSlug): Promise<StarSystemMetadata>`

Each loader query strategy: one round-trip per entity table per sector, assembled in JS. Acceptable given small N. If a single sector ever has hundreds of bodies, switch to a CTE/json_agg query.

Apply hidden/published filtering in the assembly step (preserves current `stripHidden` semantics).

### 3. Seed script
`lib/db/seed-sectors.ts`:
- **Taxonomy first**: seed `planet_biomes` from the `PlanetBiome` union in `types/starsystem.ts` joined with colors from `lib/bodyColors.ts`. Seed `special_attributes` from the `special_attribute` union in `types/starsystem.ts`.
- **Topology derivation from existing JSON** (lossless for what's actually rendered):
  - has `secondaryStar` → `binary`
  - else `star.type` includes `"pulsar"` (case-insensitive) → `pulsar`
  - else `star.type` includes `"neutron"` → `neutron-star`
  - else → `single`
  
  Drop the existing `star.type` strings ("White Dwarf", "Red Supergiant", etc.) — they're not displayed anywhere; the only runtime use is the substring matching that topology now replaces.
- Reads every JSON file in `content/sectors/` and `content/sectors/*/`.
- Inserts in dependency order: planet_biomes + special_attributes → sectors → star_systems → celestial_bodies → system_pins → vortex_pins → map_markers → connections.
- Resolve `biome_id` / `special_attribute_id` by slug lookup when inserting bodies.
- Idempotent: wrap in a transaction that truncates the content tables first (CASCADE), then inserts. Taxonomy tables use UPSERT (don't truncate — they may have user-added rows in the future).
- Resolve connection endpoints: look up `system_pins.id` / `vortex_pins.id` by `(sector_id, slug)` after pins are inserted.
- Add `npm run seed:sectors` script.

### 4. Cutover
- Replace imports of `lib/sectors.ts` with `lib/db/sectors.ts`. The function signatures stay (just become async if not already).
- Existing callers: `app/sectors/page.tsx`, `app/sectors/[slug]/page.tsx`, `generateStaticParams`, any API routes touching sectors.
- **Switch sector + star-system pages off SSG** to dynamic rendering (`export const dynamic = "force-dynamic"`) — the editor will mutate data; SSG would serve stale content. Revisit ISR later if perf demands it.
- Delete `lib/sectors.ts` (or leave as a re-export shim during one PR for safety, then remove).

### 5. Verification
- `npm run build` succeeds.
- Visual diff: every sector page and star system page renders identically pre/post cutover.
- Spot-check a sector with vortexes + connections + markers (atlas-sector is the richest).
- `gitnexus_detect_changes` to confirm the affected scope matches expectation.

### 6. Cleanup
- Keep JSON files in `content/sectors/` as seed source — committed, but unused at runtime. Add a README in that folder noting it's seed-only.
- Update `CLAUDE.md` "Content Authoring" section to point at the editor (once it exists) instead of "edit JSON then `npm run build`".

---

## Decisions baked in

| Decision | Choice | Reason |
|---|---|---|
| Normalization | Fully normalized | User direction; lifts cleanly into product |
| Connection endpoints | Two nullable FK pairs (option a) | Real FKs, CASCADE works, no polymorphic ambiguity |
| `star` storage | JSONB on `star_systems` | 4-field value object, never queried individually |
| Biome | Own table (`planet_biomes`), FK from bodies | Will be user-editable in the productized world-builder; modeling now avoids a later breaking change |
| Special attribute | Own table (`special_attributes`), FK from bodies | Same reasoning as biome |
| Allegiance | Plain text column, code-side registry | **Open** — same logic as biome may apply (see open items) |
| Body type / layer | Plain text, no FK | Structural enums tied to rendering shape, not user-editable taxonomy |
| System topology | Slug column on `star_systems`, registry in `lib/systemTopologies.ts` | What used to be "star type" is really *system topology* (single/binary/pulsar/black-hole/...). It lives on the system, not the star, because it determines star count and renderer. Each registry entry carries `{slug, name, starCount, allowsCompanion, renderer}`. Star objects shrink to just `{name, color, externalUrl}` — no type, no classification. Replaces the current fragile substring-match on `star.type` in `StarSystemView.tsx`. |
| Connection-attached marker | Inline columns on `connections` | Strict 1:1, shares lifecycle |
| Free-floating marker | Own table | Independent lifecycle |
| Surrogate PKs | SERIAL `id` everywhere | Slug renames don't break edges |
| Slugs | Unique within parent scope | Display + JSON-compat identifiers |
| History/revisions | Deferred | Additive later; in-session undo covers v1 |
| Loader strategy | Hard cutover after seed | Keeps code simple; JSON stays as seed source |
| Rendering | Dynamic for sector/system pages | Editor will mutate live data |

---

## Risks / open items

- **`generateStaticParams` removal** changes deploy behavior. Verify Neon cold-start isn't a noticeable hit on first sector load; if it is, add an in-process cache with short TTL.
- **`updated_at` auto-update**: Postgres needs a trigger or the app must set it. Set it from the app for now (simpler, no trigger to maintain). Add `BEFORE UPDATE` triggers if/when the editor matures.
- **Sector-level `lore`**: current `SectorMetadata` only has `description`. If the editor wants longer-form lore, add `lore TEXT` to `sectors` (additive, no risk).
- **Coordinate scale (1200×800)** is hardcoded in components. Not addressed here — productized version may make it per-sector. Leave as-is.
- **Validation on enums** (body type, layer, marker type, system topology): no DB CHECK constraints on first pass — keep validation in code. Biome and special_attribute are now FKs, so the DB enforces those. Topology is validated app-side from `lib/systemTopologies.ts`.
- **Create `lib/systemTopologies.ts`** as part of the seed-script PR. Shape: `{ slug, name, starCount, allowsCompanion, renderer }`. Initial entries: `single`, `binary`, `pulsar`, `neutron-star`, `black-hole` (extend as needed).
- **Refactor `StarSystemView.tsx`**: replace the `sys.star.type.toLowerCase().includes("neutron"|"pulsar")` substring chain with a `switch (sys.topology)`. Same for the binary check (currently inferred from `secondaryStar` presence — switch to `topology === 'binary'`). Update `types/starsystem.ts`: drop `Star.type`, add `topology` to `StarSystemMetadata`. Use `gitnexus_rename`/`gitnexus_impact` per project convention.
- **Allegiance as a table?** Currently kept as a plain text column referencing `lib/allegiances.ts`. Same "users define their own factions" argument that promoted biomes/attributes to tables likely applies. Decide before implementation: if yes, add an `allegiances` table (slug, name, color, logo_url, ...) and replace every `allegiance VARCHAR(40)` column on `system_pins`, `celestial_bodies`, `map_markers`, and `connections.marker_allegiance` with `allegiance_id INT REFERENCES allegiances(id)`.
- **TypeScript field rename**: `kankaUrl` → `externalUrl` across `types/sector.ts`, `types/starsystem.ts`, every component that reads it (`SectorMap`, `StarSystem`, marker tooltips, etc.), and every JSON file in `content/sectors/`. Do this in the seed-script PR so loader output matches the DB schema. Use `gitnexus_rename` per the project's refactor rule.
- **`bodyColors.ts` becomes seed source, not runtime source.** After cutover, the loader joins `planet_biomes.color` into the body record so components have the color without a separate lookup. Either the loader returns an enriched body shape, or it returns a sector-wide biome registry alongside the sector data so component code stays unchanged. Pick during implementation; the registry-alongside option is the smaller diff.
- **Read perf**: the assembled-in-JS approach does 6-7 small queries per sector. Fine for current data volume. If this becomes slow, consolidate into a single query with `json_agg`.

---

## Suggested PR sequence

1. **PR 1**: Schema + seed script + `lib/db/sectors.ts`. JSON files still authoritative; new module unused. Verify seed produces correct `SectorMetadata` via a temporary debug route or unit-style script.
2. **PR 2**: Cutover. Swap callers, switch to dynamic rendering, delete `lib/sectors.ts`. Visual regression check.
3. **PR 3** (separate feature): Admin editor.
