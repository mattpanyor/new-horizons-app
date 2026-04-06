import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getUserByUsername } from "@/lib/db/users";
import { list, put, del, copy } from "@vercel/blob";

async function requireAdmin() {
  const cookieStore = await cookies();
  const username = cookieStore.get("nh_user")?.value;
  if (!username) return null;
  const user = await getUserByUsername(username);
  if (!user || user.accessLevel < 66) return null;
  return user;
}

function isPathSafe(p: string): boolean {
  if (!p) return true;
  if (p.startsWith("/")) return false;
  if (p.includes("..")) return false;
  if (p.includes("\0")) return false;
  if (/[\x00-\x1f]/g.test(p)) return false;
  return true;
}

export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const prefix = req.nextUrl.searchParams.get("prefix") ?? undefined;
  const cursor = req.nextUrl.searchParams.get("cursor") ?? undefined;

  try {
    const result = await list({
      prefix: prefix || undefined,
      cursor: cursor || undefined,
      limit: 200,
      mode: "folded",
    });

    return NextResponse.json({
      blobs: result.blobs,
      cursor: result.cursor,
      hasMore: result.hasMore,
      folders: result.folders,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to list blobs" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const folder = (formData.get("folder") as string) ?? "";

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (!isPathSafe(folder) || !isPathSafe(file.name)) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  if (file.name.includes("/")) {
    return NextResponse.json({ error: "Filename cannot contain slashes" }, { status: 400 });
  }

  const pathname = folder ? `${folder}/${file.name}` : file.name;

  try {
    const blob = await put(pathname, file, {
      access: "public",
      addRandomSuffix: false,
    });
    return NextResponse.json({ blob }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { url } = body;
  if (!url || typeof url !== "string") {
    return NextResponse.json({ error: "URL is required" }, { status: 400 });
  }

  try {
    await del(url);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Delete failed" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { fromUrl, toPathname } = body;
  if (!fromUrl || !toPathname) {
    return NextResponse.json({ error: "fromUrl and toPathname are required" }, { status: 400 });
  }

  if (!isPathSafe(toPathname)) {
    return NextResponse.json({ error: "Invalid target path" }, { status: 400 });
  }

  try {
    const newBlob = await copy(fromUrl, toPathname, { access: "public" });
    try {
      await del(fromUrl);
    } catch {
      // Copy succeeded but delete failed — file is duplicated, not lost
    }
    return NextResponse.json({ blob: newBlob });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Rename failed" },
      { status: 500 }
    );
  }
}
