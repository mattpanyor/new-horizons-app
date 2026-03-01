---
globs: components/**
---

# Component Conventions

- Mark interactive components with `"use client"` at top of file
- Server components cannot use hooks or event handlers
- Client components receive data as props from server component parents
- Maps use SVG with gradient patterns and canvas-space coordinates
- Styling: Tailwind classes only, glassmorphism pattern (backdrop-blur, bg-opacity)
- Fonts: Cinzel (serif, var(--font-cinzel)) for headings, Geist for body
- File naming: PascalCase (e.g., GalacticMap.tsx, PresenceCard.tsx)
- Presence polling: useEffect with 5s setInterval to GET /api/presence
