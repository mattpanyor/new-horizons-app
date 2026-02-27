# New Horizons

An interactive galactic map and session companion for tabletop RPG campaigns. Players log in to their faction account and explore charted star systems together in real time.

## Features

- **Login** — per-player accounts with faction, role, and character data
- **Welcome screen** — personalized faction greeting on each login
- **Galactic Map** — interactive SVG overview of all sectors
- **Sector Maps** — zoomable, pannable maps with star systems and celestial bodies
- **Live Presence** — see where other crew members are navigating in real time
- **Navbar** — faction identity bar visible across all session pages

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You'll be directed to the login screen.

## Users

Users are defined in `data/users.json`. Each entry supports:

| Field | Required | Description |
|---|---|---|
| `username` | ✓ | Login username |
| `password` | ✓ | Login password |
| `group` | ✓ | Faction name |
| `character` | | Full character name |
| `role` | | Title or rank |

Sessions expire after **1 hour**. Visit `/logout` to log out manually.

## Content

Sector and star system data lives in `content/sectors/`. Each sector has a JSON file at the root level and a subdirectory for its star systems.

```
content/
  sectors/
    top-right.json
    top-right/
      callisto.json
      pelao.json
      ...
```
