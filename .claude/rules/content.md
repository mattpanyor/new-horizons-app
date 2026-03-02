---
globs: content/**
---

# Content JSON Conventions

- Sector files: `content/sectors/[slug].json` - see types/sector.ts for schema
- Star system files: `content/sectors/[sector-slug]/[system-slug].json` - see types/starsystem.ts
- Slugs: kebab-case, must match filename
- Coordinates: sector map canvas is 1200x800, system positions use (x, y) in this space
- Body orbits: orbitDistance (0-1 from star), orbitPosition (0-360 degrees)
- Published flag: omit or set true to show, false to hide
- Colors: hex format (e.g., "#6366F1")
- After changes: run `npm run build` to regenerate static pages
- Biome colors: defined in lib/bodyColors.ts, must match PlanetBiome type in types/starsystem.ts
