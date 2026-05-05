import { NextResponse } from "next/server";
import { getAllUsers } from "@/lib/db/users";

// Public listing of usernames + avatars for the avatar-mode login page. Gated
// on NEXT_PUBLIC_AVATAR_LOGIN so the user list isn't queryable when the
// feature is off. Never returns password hashes or access levels.
export async function GET() {
  if (process.env.NEXT_PUBLIC_AVATAR_LOGIN !== "true") {
    return NextResponse.json({ error: "Not enabled" }, { status: 404 });
  }

  const users = await getAllUsers();
  return NextResponse.json({
    users: users.map((u) => ({
      username: u.username,
      imageUrl: u.imageUrl,
    })),
  });
}
