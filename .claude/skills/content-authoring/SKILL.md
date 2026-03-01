---
name: content-authoring
description: Guide for adding sectors, star systems, and celestial bodies to the galactic map
---

# Content Authoring

## Adding a Sector

Create `content/sectors/[slug].json`:

```json
{
  "name": "Sector Name",
  "description": "Brief lore description of the sector.",
  "color": "#6366F1",
  "nebulaColor": "#1E1B4B",
  "published": true,
  "systems": [
    { "slug": "system-name", "x": 500, "y": 300 }
  ],
  "vortexes": [
    {
      "slug": "vortex-name",
      "name": "Vortex Display Name",
      "x": 400, "y": 500,
      "color": "#A78BFA",
      "radius": 120,
      "ratio": [5, 3]
    }
  ]
}
```

**Coordinates**: Canvas-space. x: 0-1200, y: 0-800. Center of sector map is ~(600, 400).

**Constraint**: GalacticMap layout supports 5 sectors with hardcoded positions. Adding a 6th requires modifying `components/GalacticMap.tsx`.

**Existing sectors**: bottom-left, bottom-right, core, top-left, top-right.

## Adding a Star System

1. Add a system pin to the parent sector JSON (in the `systems` array)
2. Create `content/sectors/[sector-slug]/[system-slug].json`:

```json
{
  "name": "System Name",
  "published": true,
  "kankaUrl": "https://app.kanka.io/...",
  "star": {
    "name": "Star Name",
    "type": "Red Supergiant",
    "color": "#EF4444",
    "secondaryColor": "#7F1D1D"
  },
  "bodies": [
    {
      "id": "planet-1",
      "name": "Planet Name",
      "type": "planet",
      "biome": "desert",
      "orbitPosition": 45,
      "orbitDistance": 0.6,
      "labelPosition": "bottom",
      "lore": "Optional lore text",
      "kankaUrl": "https://app.kanka.io/..."
    },
    {
      "id": "station-1",
      "name": "Station Name",
      "type": "station",
      "orbitPosition": 180,
      "orbitDistance": 0.4,
      "labelPosition": "bottom"
    }
  ]
}
```

## Body Types

| Type | Description | Requires biome? |
|------|-------------|-----------------|
| `planet` | Planetary body | Yes |
| `station` | Orbital station | No |
| `moon` | Natural satellite | No |
| `ship` | Individual vessel | No |
| `fleet` | Fleet of ships | No |
| `asteroid-field` | Asteroid belt | No |

## Planet Biomes

| Biome | Primary Color | Secondary Color |
|-------|---------------|-----------------|
| `desert` | #D97706 | #92400E |
| `jungle` | #22C55E | #14532D |
| `molten` | #DC2626 | #450A0A |
| `barren` | #78716C | #292524 |
| `irradiated` | #A3E635 | #365314 |
| `arctic` | #BAE6FD | #0369A1 |
| `ocean` | #0EA5E9 | #0C4A6E |
| `gas-giant` | #FB923C | #C2410C |
| `tropical` | #2DD4BF | #0F766E |
| `savanna` | #FCD34D | #78350F |
| `continental` | #60A5FA | #1D4ED8 |
| `alpine` | #A8D8B0 | #4A8C5C |
| `mining` | #57534E | #292524 |
| `toxic` | #84CC16 | #3F6212 |
| `arid` | #CA8A04 | #713F12 |
| `ash` | #9CA3AF | #374151 |

Colors defined in `lib/bodyColors.ts`. To add a new biome, add it to both `PlanetBiome` type in `types/starsystem.ts` and `BIOME_COLORS` in `lib/bodyColors.ts`.

## Orbit Parameters

- `orbitPosition`: 0-360 degrees. Position on the orbital ring (0 = right, 90 = bottom, 180 = left, 270 = top).
- `orbitDistance`: 0-1 normalized. Distance from star center (0 = at star, 1 = edge of system view). Typical range: 0.3-0.9.

## Optional Body Fields

- `lore`: Flavor text description
- `kankaUrl`: Link to Kanka worldbuilding entry
- `image`: Custom image path
- `labelPosition`: `"top"` or `"bottom"` (default: `"bottom"`)
- `lathanium`: Boolean flag for special resource
- `nobility`: Boolean flag for noble presence
- `published`: Boolean (omit or true to show, false to hide)

## After Content Changes

Run `npm run build` to regenerate static pages via `generateStaticParams()`. New content won't appear in production without a rebuild.

## Types Reference

- `types/sector.ts`: SectorMetadata, SystemPin, VortexPin
- `types/starsystem.ts`: StarSystemMetadata, CelestialBody, Star, PlanetBiome, CelestialBodyType
