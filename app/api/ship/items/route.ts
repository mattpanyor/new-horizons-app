import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getUserByUsername } from "@/lib/db/users";
import {
  getShipItemsByCategory,
  getShipItemById,
  createShipItem,
  updateShipItem,
  deleteShipItem,
} from "@/lib/db/shipItems";

async function getUser() {
  const cookieStore = await cookies();
  const username = cookieStore.get("nh_user")?.value;
  if (!username) return null;
  return getUserByUsername(username);
}

const MIN_ACCESS: Record<string, number> = {
  cargo: 0,
  isolation: 1,
};

function canAccess(accessLevel: number, category: string): boolean {
  return accessLevel >= (MIN_ACCESS[category] ?? 999);
}

async function parseBody(req: NextRequest) {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const category = req.nextUrl.searchParams.get("category");
  if (category !== "cargo" && category !== "isolation") {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }

  if (!canAccess(user.accessLevel, category)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const items = await getShipItemsByCategory(category);
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await parseBody(req);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { category, name, quantity, description, imageUrl } = body;

  if (category !== "cargo" && category !== "isolation") {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }
  if (!canAccess(user.accessLevel, category)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  if (name.trim().length > 255) {
    return NextResponse.json({ error: "Name must be 255 characters or fewer" }, { status: 400 });
  }
  if (typeof description === "string" && description.trim().length > 2000) {
    return NextResponse.json({ error: "Description must be 2000 characters or fewer" }, { status: 400 });
  }

  const item = await createShipItem({
    category,
    name: name.trim(),
    quantity: typeof quantity === "number" && quantity >= 1 ? quantity : 1,
    imageUrl: typeof imageUrl === "string" && imageUrl.trim() ? imageUrl.trim() : undefined,
    description: typeof description === "string" && description.trim() ? description.trim() : undefined,
  });

  return NextResponse.json({ item }, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await parseBody(req);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { id, name, quantity, description, imageUrl } = body;

  if (!id || typeof id !== "number") {
    return NextResponse.json({ error: "Item id is required" }, { status: 400 });
  }

  const existing = await getShipItemById(id);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!canAccess(user.accessLevel, existing.category)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  if (name.trim().length > 255) {
    return NextResponse.json({ error: "Name must be 255 characters or fewer" }, { status: 400 });
  }
  if (typeof description === "string" && description.trim().length > 2000) {
    return NextResponse.json({ error: "Description must be 2000 characters or fewer" }, { status: 400 });
  }

  const item = await updateShipItem(id, {
    name: name.trim(),
    quantity: typeof quantity === "number" && quantity >= 1 ? quantity : 1,
    imageUrl: typeof imageUrl === "string" && imageUrl.trim() ? imageUrl.trim() : null,
    description: typeof description === "string" && description.trim() ? description.trim() : null,
  });

  if (!item) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ item });
}

export async function DELETE(req: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await parseBody(req);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { id } = body;

  if (!id || typeof id !== "number") {
    return NextResponse.json({ error: "Item id is required" }, { status: 400 });
  }

  const existing = await getShipItemById(id);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!canAccess(user.accessLevel, existing.category)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await deleteShipItem(id);
  return NextResponse.json({ success: true });
}
