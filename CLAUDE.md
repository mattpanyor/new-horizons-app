<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **new-horizons-app** (225 symbols, 392 relationships, 11 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## When Debugging

1. `gitnexus_query({query: "<error or symptom>"})` — find execution flows related to the issue
2. `gitnexus_context({name: "<suspect function>"})` — see all callers, callees, and process participation
3. `READ gitnexus://repo/new-horizons-app/process/{processName}` — trace the full execution flow step by step
4. For regressions: `gitnexus_detect_changes({scope: "compare", base_ref: "main"})` — see what your branch changed

## When Refactoring

- **Renaming**: MUST use `gitnexus_rename({symbol_name: "old", new_name: "new", dry_run: true})` first. Review the preview — graph edits are safe, text_search edits need manual review. Then run with `dry_run: false`.
- **Extracting/Splitting**: MUST run `gitnexus_context({name: "target"})` to see all incoming/outgoing refs, then `gitnexus_impact({target: "target", direction: "upstream"})` to find all external callers before moving code.
- After any refactor: run `gitnexus_detect_changes({scope: "all"})` to verify only expected files changed.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Tools Quick Reference

| Tool | When to use | Command |
|------|-------------|---------|
| `query` | Find code by concept | `gitnexus_query({query: "auth validation"})` |
| `context` | 360-degree view of one symbol | `gitnexus_context({name: "validateUser"})` |
| `impact` | Blast radius before editing | `gitnexus_impact({target: "X", direction: "upstream"})` |
| `detect_changes` | Pre-commit scope check | `gitnexus_detect_changes({scope: "staged"})` |
| `rename` | Safe multi-file rename | `gitnexus_rename({symbol_name: "old", new_name: "new", dry_run: true})` |
| `cypher` | Custom graph queries | `gitnexus_cypher({query: "MATCH ..."})` |

## Impact Risk Levels

| Depth | Meaning | Action |
|-------|---------|--------|
| d=1 | WILL BREAK — direct callers/importers | MUST update these |
| d=2 | LIKELY AFFECTED — indirect deps | Should test |
| d=3 | MAY NEED TESTING — transitive | Test if critical path |

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/new-horizons-app/context` | Codebase overview, check index freshness |
| `gitnexus://repo/new-horizons-app/clusters` | All functional areas |
| `gitnexus://repo/new-horizons-app/processes` | All execution flows |
| `gitnexus://repo/new-horizons-app/process/{name}` | Step-by-step execution trace |

## Self-Check Before Finishing

Before completing any code modification task, verify:
1. `gitnexus_impact` was run for all modified symbols
2. No HIGH/CRITICAL risk warnings were ignored
3. `gitnexus_detect_changes()` confirms changes match expected scope
4. All d=1 (WILL BREAK) dependents were updated

## CLI

- Re-index: `npx gitnexus analyze`
- Check freshness: `npx gitnexus status`
- Generate docs: `npx gitnexus wiki`

<!-- gitnexus:end -->

# New Horizons App

Interactive galactic map companion for tabletop RPG campaigns.
Next.js 16.2.1 + React 19 + TypeScript 5 + Tailwind CSS 4.
Neon Postgres database. Cookie-based auth with bcrypt. Vercel Blob for image storage.

## Key Paths

- `app/` - Next.js App Router pages and API routes
- `components/` - React components (GalacticMap, SectorMap, Ship, Admin, Inbox, etc.)
- `lib/` - Utilities (sectors.ts, starsystems.ts, bodyColors.ts, allegiances.ts, etc.)
- `lib/db/` - Database layer (users.ts, messages.ts, kankaEntities.ts, schema.sql, seed.ts)
- `types/` - TypeScript types (sector.ts, starsystem.ts, ship.ts)
- `content/sectors/` - JSON sector and star system data
- `content/ship/` - Ship layout data (graviton.json)

## Architecture

- Server Components by default; `"use client"` only for interactive maps/modals
- Async params: always `await params` in pages (Next.js 16 requirement)
- Static generation for sector pages via `generateStaticParams()`
- Neon Postgres (serverless) for users, messages, and Kanka entities
- Cookie-based auth: `nh_user` cookie stores username, validated against DB
- Access levels: 0 (user), 66 (admin), 127 (superadmin)
- SVG-based interactive maps with gradient patterns
- Images served from Vercel Blob storage (faction logos, ship bay images)

## Routes

- `/` - Auth check -> WelcomeScreen -> redirect to /sectors
- `/login` - LoginPage
- `/sectors` - GalacticMap
- `/sectors/[slug]` - SectorMap
- `/ship` - Ship viewer with interactive deck layers and bay modals
- `/admin/users` - User management (accessLevel >= 66)
- `/admin/messages` - Message admin panel (accessLevel >= 127)
- `/admin/kanka` - Kanka campaign sync (dev only)
- `/admin/mcp` - Issue and revoke MCP tokens for users (accessLevel >= 66)

## API Routes

- POST `/api/auth/login`, POST `/api/auth/logout` - Authentication
- GET `/api/messages` - User messages (enriched with Kanka entity data)
- GET `/api/messages/unread-count` - Unread message count
- PATCH `/api/messages/read` - Mark message as read
- POST/PUT/DELETE `/api/admin/messages` - Admin message CRUD
- POST `/api/admin/users` - User management
- POST `/api/admin/kanka/sync`, GET/POST `/api/admin/kanka/entities` - Kanka sync
- ALL `/api/mcp/server` - MCP endpoint for AI clients (bearer token, not cookie)
- GET/POST/DELETE `/api/admin/mcp/tokens` - Token issuance and revocation (accessLevel >= 66)

## MCP Server

External AI clients can act as a real app user over the Model Context Protocol.

- **Endpoint**: `/api/mcp/server`, auth via `Authorization: Bearer nhmcp_…`, or
  `/api/mcp/server/t/<token>` for clients that only accept a URL (logs the secret — fallback only)
- **Tokens**: `mcp_tokens`, issued by an admin at `/admin/mcp` (accessLevel >= 66) and sent to the
  user. Stored twice — SHA-256 `token_hash` for the auth hot path, AES-256-GCM `token_encrypted`
  (key from `MCP_TOKEN_SECRET`) so the panel can show the token again to re-send it
- An admin may only issue tokens for users **at or below their own access level** — otherwise
  holding the token would hand them the higher access
- **Permissions mirror the web app.** A token grants no more than its owner has in the browser.
  Per-token `scopes` narrow further; effective access is `accessLevel ∩ scopes`
- Tools the caller can't use are **omitted from `tools/list`**, not rejected on call
- **Chapter deletion is deliberately not exposed over MCP.** It cascades to every clue in the
  chapter, and the web UI's type-the-exact-title guard has no AI equivalent — a tool description
  asking for confirmation is advice a model can reason past. Keep destructive-and-unbounded
  operations in the admin panel; apply the same test to any future module

**The important rule:** all investigation permission and validation logic lives in
`lib/investigation/service.ts`. The web routes under `app/api/investigation/**` and
`app/api/admin/investigation/**` are thin adapters over it, as are the MCP tools. Add a rule there
and it applies to the browser and every AI client at once — never add one to a route handler alone,
or the two surfaces silently diverge.

**Adding a domain** (messages, sectors, …):

1. Write `lib/<domain>/service.ts` holding the policy, and make the existing routes call it
2. Write `lib/mcp/modules/<domain>.ts` exporting a `ToolModule` whose handlers only call that service
3. Add it to `MODULES` in `lib/mcp/registry.ts`

Endpoint, auth, and the token UI pick it up automatically — the new scope appears as a checkbox.
Name tools `<domain>_<verb>_<noun>` to avoid collisions and help model selection.

> Before building a sectors module, settle which store is authoritative: `lib/sectors.ts` and
> `lib/starsystems.ts` read `content/sectors/*.json` from disk, while `lib/db/sectors.ts` has
> Postgres CRUD. The JSON is intentionally static — confirm the target before writing tools.

## Review Later

- **Game polling bandwidth**: `/api/games/active` returns the full game session (~1-2KB) every 2s to every user on `/game`. Fine for 5-10 players but if player count grows, consider: ETag/304 responses, sending only a version hash and fetching full state on change, or reducing poll frequency when it's not the player's turn.

## Database

- Neon Postgres via `@neondatabase/serverless`
- Tables: `users`, `messages`, `message_recipients`, `kanka_entities`, `game_sessions`, `mcp_tokens`
- Auth: bcryptjs password hashing
- No migrations directory — schema changes are manual

## Development

- `npm run dev` - Dev server (port 3000)
- `npm run build` - Production build (required after adding new content for static pages)
- `npm run lint` - ESLint

## Conventions

- Cinzel serif font for sci-fi headings, Geist for body text
- Glassmorphism UI (backdrop-blur, opacity, translucent panels)
- Tailwind for all styling, no CSS modules
- Map/sector content = JSON files in `content/sectors/`
- New sectors/systems require `npm run build` to regenerate static pages

## Constraints

- GalacticMap supports 5 sector positions (hardcoded layout)
- No tests or CI configured
- Sector coordinates: canvas-space x(0-1200) y(0-800)
- Body orbit: orbitDistance(0-1 normalized), orbitPosition(0-360 degrees)

## Content Authoring

See `.claude/skills/content-authoring/SKILL.md` for full JSON schemas and examples.
