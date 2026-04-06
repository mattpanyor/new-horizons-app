import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getUserByUsername } from "@/lib/db/users";
import { createFolder, list, copy, del } from "@vercel/blob";

async function requireAdmin() {
  const cookieStore = await cookies();
  const username = cookieStore.get("nh_user")?.value;
  if (!username) return null;
  const user = await getUserByUsername(username);
  if (!user || user.accessLevel < 66) return null;
  return user;
}

function isPathSafe(p: string): boolean {
  if (!p) return false;
  if (p.startsWith("/")) return false;
  if (p.includes("..")) return false;
  if (p.includes("\0")) return false;
  if (/[\x00-\x1f]/g.test(p)) return false;
  return true;
}

function sanitizeFolderName(name: string): boolean {
  return /^[a-zA-Z0-9_\-. /]+$/.test(name);
}

export async function POST(req: NextRequest) {
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

  const { path } = body;
  if (!path || typeof path !== "string" || path.trim().length === 0) {
    return NextResponse.json({ error: "Folder path is required" }, { status: 400 });
  }

  const trimmed = path.trim().replace(/\/+$/, "");
  if (!isPathSafe(trimmed) || !sanitizeFolderName(trimmed)) {
    return NextResponse.json({ error: "Invalid folder path" }, { status: 400 });
  }

  const folderPath = trimmed + "/";

  try {
    await createFolder(folderPath);
    return NextResponse.json({ success: true, path: folderPath }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create folder" },
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

  const { oldPath, newPath } = body;
  if (!oldPath || !newPath) {
    return NextResponse.json({ error: "oldPath and newPath are required" }, { status: 400 });
  }

  const oldTrimmed = oldPath.replace(/\/+$/, "");
  const newTrimmed = newPath.replace(/\/+$/, "");

  if (!isPathSafe(oldTrimmed) || !isPathSafe(newTrimmed)) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }
  if (!sanitizeFolderName(newTrimmed)) {
    return NextResponse.json({ error: "Invalid folder name" }, { status: 400 });
  }

  const oldPrefix = oldTrimmed + "/";
  const newPrefix = newTrimmed + "/";

  try {
    // Phase 1: Collect all blobs to move
    const blobsToMove: { url: string; newPathname: string }[] = [];
    let cursor: string | undefined;
    do {
      const result = await list({ prefix: oldPrefix, cursor, limit: 100 });
      for (const blob of result.blobs) {
        const relativePath = blob.pathname.slice(oldPrefix.length);
        blobsToMove.push({ url: blob.url, newPathname: newPrefix + relativePath });
      }
      cursor = result.cursor;
    } while (cursor);

    // Phase 2: Copy all blobs to new location
    const copied: { oldUrl: string; newUrl: string }[] = [];
    for (const item of blobsToMove) {
      const result = await copy(item.url, item.newPathname, { access: "public" });
      copied.push({ oldUrl: item.url, newUrl: result.url });
    }

    // Phase 3: Delete all old blobs (only after all copies succeed)
    for (const item of copied) {
      try {
        await del(item.oldUrl);
      } catch {
        // Individual delete failure — blob is duplicated, not lost
      }
    }

    // Create new folder marker and clean up old one
    await createFolder(newPrefix);
    try {
      await del(oldPrefix);
    } catch {
      // Old folder marker may not exist as a blob
    }

    return NextResponse.json({ success: true, moved: copied.length });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Folder rename failed" },
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

  const { path } = body;
  if (!path || typeof path !== "string") {
    return NextResponse.json({ error: "Folder path is required" }, { status: 400 });
  }

  const prefix = path.replace(/\/+$/, "") + "/";

  try {
    let cursor: string | undefined;
    let deleted = 0;
    do {
      const result = await list({ prefix, cursor, limit: 100 });
      for (const blob of result.blobs) {
        await del(blob.url);
        deleted++;
      }
      cursor = result.cursor;
    } while (cursor);

    return NextResponse.json({ success: true, deleted });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Folder delete failed" },
      { status: 500 }
    );
  }
}
