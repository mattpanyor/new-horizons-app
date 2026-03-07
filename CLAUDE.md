<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **new-horizons-app** (224 symbols, 391 relationships, 11 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

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
Next.js 16.1.6 + React 19 + TypeScript 5 + Tailwind CSS 4.
JSON-driven content (no database). Cookie-based auth with in-memory presence.

## Key Paths

- `app/` - Next.js App Router pages and API routes
- `components/` - React components (GalacticMap, SectorMap, Navbar, etc.)
- `lib/` - Utilities (sectors.ts, starsystems.ts, bodyColors.ts)
- `types/` - TypeScript types (sector.ts, starsystem.ts)
- `content/sectors/` - JSON sector and star system data
- `data/users.json` - User accounts (demo credentials)

## Architecture

- Server Components by default; `"use client"` only for interactive maps
- Async params: always `await params` in pages (Next.js 16 requirement)
- Static generation for sector pages via `generateStaticParams()`
- API routes: POST `/api/auth/login`, POST `/api/auth/logout`, GET/POST `/api/presence`
- In-memory presenceMap (volatile), 30s stale timeout, 5s client polling
- SVG-based interactive maps with gradient patterns

## Routes

- `/` - Auth check -> WelcomeScreen -> redirect to /sectors
- `/login` - LoginPage
- `/sectors` - GalacticMap + PresenceCard
- `/sectors/[slug]` - SectorMapWithPresence

## Development

- `npm run dev` - Dev server (port 3000)
- `npm run build` - Production build (required after adding new content for static pages)
- `npm run lint` - ESLint

## Conventions

- Cinzel serif font for sci-fi headings, Geist for body text
- Glassmorphism UI (backdrop-blur, opacity, translucent panels)
- Tailwind for all styling, no CSS modules
- Content = JSON files in `content/sectors/`
- New sectors/systems require `npm run build` to regenerate static pages

## Constraints

- GalacticMap supports 5 sector positions (hardcoded layout)
- Presence tracking is in-memory only (lost on server restart)
- No tests or CI configured
- Sector coordinates: canvas-space x(0-1200) y(0-800)
- Body orbit: orbitDistance(0-1 normalized), orbitPosition(0-360 degrees)

## Content Authoring

See `.claude/skills/content-authoring/SKILL.md` for full JSON schemas and examples.
