<!-- gitnexus:start -->
# GitNexus MCP

This project is indexed by GitNexus as **new-horizons-app** (145 symbols, 217 relationships, 6 execution flows).

## Always Start Here

1. **Read `gitnexus://repo/{name}/context`** — codebase overview + check index freshness
2. **Match your task to a skill below** and **read that skill file**
3. **Follow the skill's workflow and checklist**

> If step 1 warns the index is stale, run `npx gitnexus analyze` in the terminal first.

## Skills

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->

# Agent Instructions

## Context

Tabletop RPG galactic map app. JSON-driven content, no database.
Read CLAUDE.md first for project overview, then return here for agent-specific guidance.

## Adding Content

### New Sector

1. Create `content/sectors/[slug].json`
2. Required fields: `name`, `description`, `color` (hex), `systems` (array)
3. Optional: `nebulaColor` (hex), `vortexes` (array), `published` (boolean, default shows)
4. System pins: `{ slug, x, y }` where x(0-1200), y(0-800) canvas coords
5. Run `npm run build` after adding

### New Star System

1. Create `content/sectors/[sector-slug]/[system-slug].json`
2. Required: `name`, `star` (object with name, type, color), `bodies` (array)
3. Star: `{ name, type, color, secondaryColor? }`
4. Body: `{ id, name, type, orbitPosition(0-360), orbitDistance(0-1) }`
5. Body types: `planet | station | moon | ship | fleet | asteroid-field`
6. Planet biomes: `desert | jungle | molten | barren | irradiated | arctic | ocean | gas-giant | tropical | savanna | continental | alpine | mining | toxic | arid | ash`
7. Optional body fields: `biome`, `lore`, `kankaUrl`, `image`, `labelPosition`, `lathanium`, `nobility`, `published`

### New User

Edit `data/users.json`. Fields: `username`, `password`, `group` (faction name), `role?`, `character?`

## Key Types

- `types/sector.ts` - SectorMetadata, SystemPin, VortexPin
- `types/starsystem.ts` - StarSystemMetadata, CelestialBody, Star, PlanetBiome, CelestialBodyType
- `lib/bodyColors.ts` - Biome-to-color mapping, getBodyColors()

## Server vs Client Components

- **Server** (default): pages, layouts. Can use async/await, cookies(), fs.
- **Client** (`"use client"`): GalacticMap, SectorMap, SectorMapWithPresence, WelcomeScreen, LoginPage, PresenceCard, StarSystemBackground. Use hooks, event handlers.
- **Pattern**: Server fetches data -> passes as props -> Client renders interactively.

## Auth Flow

1. POST `/api/auth/login` with `{ username, password }` -> sets `nh_user` cookie (1hr, httpOnly:false)
2. Server Components check cookie via `await cookies()`
3. Client Components read cookie from `document.cookie`
4. Presence: Client POSTs to `/api/presence` every 5s with current location

## File Naming

- Sector slugs: kebab-case, match JSON filename (e.g., `top-right`)
- System slugs: kebab-case, match JSON filename (e.g., `belliar`)
- Components: PascalCase (e.g., `GalacticMap.tsx`)
- Utilities: camelCase (e.g., `bodyColors.ts`)
