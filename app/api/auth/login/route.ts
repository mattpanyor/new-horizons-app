import { NextRequest, NextResponse } from "next/server";
import { authenticateUser } from "@/lib/db/users";

export async function POST(req: NextRequest) {
  const { username, password } = await req.json();

  const user = await authenticateUser(username, password);

  if (!user) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set("nh_user", username, {
    httpOnly: true,
    path: "/",
    maxAge: 60 * 60 * 5, // 5 hours
    sameSite: "lax",
  });
  return res;
}
