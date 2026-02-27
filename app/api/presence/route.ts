import { NextRequest, NextResponse } from "next/server";

interface UserPresence {
  username: string;
  position: string;
  lastSeen: number;
}

// In-memory store — resets on server restart, fine for this use case
const presenceMap = new Map<string, UserPresence>();

const STALE_MS = 30_000; // drop users not seen in 30 seconds

export async function GET() {
  const now = Date.now();
  const active = Array.from(presenceMap.values())
    .filter((u) => now - u.lastSeen < STALE_MS)
    .map(({ username, position }) => ({ username, position }));
  return NextResponse.json(active);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { username, position } = body as { username?: string; position?: string };

  if (!username || !position) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  presenceMap.set(username, { username, position, lastSeen: Date.now() });
  return NextResponse.json({ ok: true });
}
