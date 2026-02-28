<!-- gitnexus:start -->
# GitNexus MCP

This project is indexed by GitNexus as **new-horizons-app** (129 symbols, 203 relationships, 5 execution flows).

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