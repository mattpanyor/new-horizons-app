---
globs: app/api/**
---

# API Route Conventions

- All route handlers are async functions exporting HTTP method names (GET, POST)
- Use `NextRequest` and `NextResponse` from `next/server`
- Auth check: read `nh_user` cookie via `await cookies()` (async in Next.js 16)
- Cookie settings: `httpOnly: true`, `sameSite: "lax"`, `maxAge: 60 * 60 * 5` (5 hours)
- Return JSON via `NextResponse.json()`
- User validation: look up via `getUserByUsername` from `lib/db/users.ts`
