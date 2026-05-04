import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAllUsers, getUserByUsername, updateUser, deleteUser, resetPassword, createUser } from "@/lib/db/users";

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

/**
 * Returns:
 *   - { value: string | null } when input is valid (string = canonical lowercase hex; null = explicit clear)
 *   - { invalid: true } when a non-empty string was provided that doesn't match #RRGGBB
 */
function parseColor(input: unknown): { value: string | null } | { invalid: true } {
  if (input === null || input === undefined || input === "") return { value: null };
  if (typeof input !== "string") return { invalid: true };
  if (!HEX_RE.test(input)) return { invalid: true };
  return { value: input.toLowerCase() };
}

async function requireAdmin() {
  const cookieStore = await cookies();
  const username = cookieStore.get("nh_user")?.value;
  if (!username) return null;
  const user = await getUserByUsername(username);
  if (!user || user.accessLevel < 66) return null;
  return user;
}

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const users = await getAllUsers(admin.accessLevel);
  return NextResponse.json(users);
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { username, password, group, role, character, accessLevel, imageUrl, color } = await req.json();

  if (!username || !password || !group) {
    return NextResponse.json({ error: "Missing required fields (username, password, group)" }, { status: 400 });
  }

  const colorParse = parseColor(color);
  if ("invalid" in colorParse) {
    return NextResponse.json({ error: "Color must be a hex string like #aabbcc" }, { status: 400 });
  }

  const finalAccessLevel = admin.accessLevel >= 127 ? (accessLevel ?? 0) : 0;

  try {
    const user = await createUser({
      username,
      password,
      group,
      role: role || null,
      character: character || null,
      accessLevel: finalAccessLevel,
      imageUrl: imageUrl || null,
      color: colorParse.value,
    });
    return NextResponse.json(user);
  } catch {
    return NextResponse.json({ error: "Username already exists" }, { status: 409 });
  }
}

export async function PUT(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { id, username, group, role, character, accessLevel, imageUrl, color } = body;

  if (!id || !username || !group) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const colorParse = parseColor(color);
  if ("invalid" in colorParse) {
    return NextResponse.json({ error: "Color must be a hex string like #aabbcc" }, { status: 400 });
  }

  // Only users with access level >= 127 can change access levels
  // Others must keep the existing value
  let finalAccessLevel = accessLevel ?? 0;
  if (admin.accessLevel < 127) {
    // Fetch current user to preserve their access level
    const allUsers = await getAllUsers(admin.accessLevel);
    const target = allUsers.find((u) => u.id === id);
    if (!target) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    finalAccessLevel = target.accessLevel;
  } else if (finalAccessLevel > admin.accessLevel) {
    return NextResponse.json({ error: "Cannot set access level higher than your own" }, { status: 403 });
  }

  const updated = await updateUser(id, {
    username,
    group,
    role: role || null,
    character: character || null,
    accessLevel: finalAccessLevel,
    imageUrl: imageUrl || null,
    color: colorParse.value,
  });

  if (!updated) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json(updated);
}

export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id, password } = await req.json();

  if (!id || !password) {
    return NextResponse.json({ error: "Missing user id or password" }, { status: 400 });
  }

  const ok = await resetPassword(id, password);
  if (!ok) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await req.json();

  if (!id) {
    return NextResponse.json({ error: "Missing user id" }, { status: 400 });
  }

  if (id === admin.id) {
    return NextResponse.json({ error: "Cannot delete yourself" }, { status: 400 });
  }

  const deleted = await deleteUser(id);
  if (!deleted) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
