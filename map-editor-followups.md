# Map Editor — Outstanding Follow-Ups

Items from the post-Phase-4 code review (commit `b90f091`) that were not fully fixed in the maintenance pass. Numbering matches the review numbering so cross-references stay stable.

Three buckets: **deferred** (need architectural work), **partial** (code reflects the issue, UX completion pending), and **doc-only** (acknowledged trade-offs that don't need code).

---

## Deferred — architectural changes

### #1 — Save endpoints aren't wrapped in a transaction

**Severity:** CRITICAL
**Files:**
- `app/api/admin/map/sectors/[slug]/save/route.ts`
- `app/api/admin/map/sectors/[slug]/systems/[systemSlug]/save/route.ts`
- `app/api/admin/map/sectors/[slug]/move-ship/route.ts`

**What's wrong**
Each save handler runs dozens of independent `await sql\`\`` calls. A mid-batch failure (FK violation, slug collision, network blip) leaves the DB half-mutated. The client's `pending` state is cleared on the success path and the editor refreshes — partial DB state masquerades as success, then differs from what the GM thinks they saved.

**Why deferred**
A real fix needs interactive transactions, which `@neondatabase/serverless`'s tagged-template `sql` doesn't expose. Two viable paths:

1. **`Pool` from `@neondatabase/serverless`** — pg-compatible client with `BEGIN`/`COMMIT`/`ROLLBACK`. Every `lib/db/` helper would need to accept an optional `client` (or `tx`) parameter and use it instead of the module-scoped `sql`. ~9 files × ~5 functions each.
2. **`sql.transaction([queries])` array form** — requires composing all writes upfront. Doesn't work for save paths that need an intermediate read (e.g. `updateMarker`'s positional re-read, `cascadeSlugRename`'s old-slug lookup) because the read result is needed to build the next write.

Path 1 is the right answer; budget ~2–3 hours plus regression testing.

**Mitigation in place**
- Operations are ordered deletes → updates → creates so a partial failure leaves the DB in a "stale but consistent" state (the editor's stale view loses, not corrupts).
- `cascadeSlugRename` was reordered to fire only after the entity UPDATE commits, so an entity-update failure no longer orphans connections.
- `updateMarker` positional logic was rewritten to never violate the CHECK constraint mid-sequence.

These reduce the worst cases but don't eliminate the gap.

---

### #4 — Drag re-projects the entire sector every mousemove

**Severity:** CRITICAL (perf)
**Files:**
- `components/SectorMap.tsx` (`composeEditedSystem`, `overridePosition`)
- `components/sectormap/edit/useDragPin.ts`
- `components/sectormap/edit/useDragBody.ts`

**What's wrong**
Both drag hooks `setDrag(state)` on every mousemove. `SectorMap.composeEditedSystem` (deps `[dragBody.drag, ...]`) and the inline `overridePosition()` calls depend on the drag state. Result: per-frame React render of the SectorMap subtree, every StarSystemView re-renders, all bodies recompute their colors and gradients. Noticeable jank at 10+ systems on a slower machine.

**Why deferred**
Fix requires moving live drag state out of the React tree:

- Lift `drag` into a `useRef` updated imperatively
- Render the dragged entity twice: a "ghost" overlay (CSS `transform: translate()` updated by the ref) on top, and the original at its committed position underneath
- On `mouseup`, commit to React state once

That decouples mouse-frame rate from React render rate. Significant rework of the drag hooks + the rendering loops in SectorMap. Budget ~3–4 hours.

**Mitigation in place**
- `didMove` threshold avoids committing a no-op on a pure click
- 0.5 px move threshold avoids triggering ghosts on jitter

Modern dev machines handle the current implementation; the bottleneck shows up with 20+ systems and on lower-end hardware.

---

### #18 — Per-body `<defs><radialGradient>` emitted inside every body

**Severity:** MEDIUM (perf / DOM bloat)
**File:** `components/sectormap/bodies/BodyShape.tsx`

**What's wrong**
After moving the gradient client-side (to fix the live biome/type preview), every `BodyShape` instance emits its own `<defs>` block. For a sector with 100+ bodies that's 100+ duplicate gradient definitions in the SVG DOM.

**Why deferred**
The clean fix needs the SVG layer to know which bodies have unsaved type/biome changes so it can:

- Emit the static set of gradients in a single top-level `<defs>` (current pre-fix behavior, via `SectorMapSvgLayer`)
- Layer in a small set of override gradients (different id) only for the bodies actually being edited

Requires plumbing the pending-changes set from `useSystemEdit` down to `SectorMapSvgLayer` (server component) — either by hoisting the static defs into a client component, or pre-computing edited body IDs server-side.

The current state is **functionally correct** — the perf cost is real but moderate (~1 KB extra SVG per 50 bodies). Defer until a real-world sector causes a measurable problem.

---

## Partial — code reflects, UX incomplete

### #10 — Move-ship body↔connection silently drops metadata

**Severity:** HIGH (data loss)
**File:** `app/api/admin/map/sectors/[slug]/move-ship/route.ts`

**What's done**
- Code comment in the body→marker branch explicitly documents the dropped fields (`biome`, `lore`, `label_position`, `special_attribute`).
- Marker→body uses the marker's existing slug and name and tries to keep `(system_id, body_id)` unique.

**What's missing**
A confirm-modal in `MoveShipDialog` that, when the source is a ship/fleet body with non-default metadata, lists which fields will be discarded on a body→marker move (e.g. *"Lore (480 chars) and biome 'continental' will be dropped"*). The GM gets to abort.

**Estimated work**
~30 LOC in `MoveShipDialog.tsx`: pre-flight GET the source body via a small endpoint or pass the body data into the dialog as a prop, render a warning section above the Move button if any of those fields are populated. No backend change.

---

## Doc-only — acknowledged trade-offs

### #26 — `migrateKankaToExternal` mutates parsed JSON in place

**Severity:** LOW
**File:** `lib/jsonMigrate.ts`

The helper rewrites `kankaUrl` → `externalUrl` directly on the parsed object tree. Today's callers always pass freshly-parsed JSON, so it's safe. If a caller is ever added that caches a parsed JSON value across requests, the second read would see the already-migrated shape and silently no-op.

**If you need to revisit:** make the helper return a cloned object instead of mutating, or have callers explicitly clone before passing.

---

### #27 — `tempIdCounter` is module-scoped

**Severity:** LOW
**File:** `components/sectormap/edit/EditModeProvider.tsx`

The temp-id generator is a module-level `let tempIdCounter = 0`. In dev with HMR that's per module instance; in prod it's per tab. Combined with `Date.now()` in the slug, collision odds are vanishing.

**If you need to revisit:** swap to `crypto.randomUUID()` and stop caring.

---

### #28 — System slug rename is unreachable from the system-edit sidebar

**Severity:** LOW
**File:** `components/sectormap/edit/useSystemEdit.ts`

The system save endpoint and `updateSystem` both support renaming a system's slug, with the connection cascade automatic via `cascadeSlugRename`. The system-edit sidebar exposes `name`, `externalUrl`, `published`, `centerKind` etc. but not `slug`.

This was deliberate — slugs are URL-meaningful (they're used in `from_slug`/`to_slug` on connections) and the GM typically shouldn't rename them once content is built around them. Sector-edit's `SelectionPanel` does expose slug for systems/vortexes/markers (because sector-edit is where the cascade flow is intended to happen).

**If you need to revisit:** add a slug input to `SystemEditSidebar`'s System section, gated behind a confirm prompt about external link breakage.
