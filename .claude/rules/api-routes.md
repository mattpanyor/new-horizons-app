---
globs: app/api/**
---

# API Route Conventions

- All route handlers are async functions exporting HTTP method names (GET, POST)
- Use `NextRequest` and `NextResponse` from `next/server`
- Auth check: read `nh_user` cookie via `await cookies()` (async in Next.js 16)
- Cookie settings: `httpOnly: false` (client needs to read for presence), `sameSite: "lax"`, `maxAge: 3600` (1hr)
- Presence tracking: in-memory `presenceMap` Map, 30s stale threshold
- Return JSON via `NextResponse.json()`
- User validation: check against `data/users.json` (loaded via fs at startup)
