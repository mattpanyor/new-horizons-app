import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getUserByUsername } from "@/lib/db/users";
import { put, del } from "@vercel/blob";

const MIN_ACCESS: Record<string, number> = {
  cargo: 0,
  isolation: 1,
};

async function getUser() {
  const cookieStore = await cookies();
  const username = cookieStore.get("nh_user")?.value;
  if (!username) return null;
  return getUserByUsername(username);
}

const ALLOWED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
]);

const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const category = formData.get("category") as string | null;
  const itemId = formData.get("itemId") as string | null;
  const itemName = formData.get("itemName") as string | null;
  const oldUrl = formData.get("oldUrl") as string | null;

  if (!file || !category || !itemId || !itemName) {
    return NextResponse.json({ error: "file, category, itemId, and itemName are required" }, { status: 400 });
  }

  if (category !== "cargo" && category !== "isolation") {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }

  if (user.accessLevel < (MIN_ACCESS[category] ?? 999)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: "Only image files are allowed" }, { status: 400 });
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "File must be under 5 MB" }, { status: 400 });
  }

  const slug = itemName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "png";
  const pathname = `ship/${category}/${itemId}-${slug}.${ext}`;

  try {
    // Delete old image if replacing
    if (oldUrl) {
      try {
        await del(oldUrl);
      } catch {
        // Best-effort cleanup
      }
    }

    const blob = await put(pathname, file, { access: "public" });
    return NextResponse.json({ url: blob.url });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 500 }
    );
  }
}
