import { NextRequest, NextResponse } from "next/server";
import users from "@/data/users.json";

export async function POST(req: NextRequest) {
  const { username, password } = await req.json();

  const user = users.find(
    (u) => u.username === username && u.password === password
  );

  if (!user) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set("nh_user", username, {
    httpOnly: false, // readable client-side for presence tracking
    path: "/",
    maxAge: 60 * 60, // 1 hour
    sameSite: "lax",
  });
  return res;
}
