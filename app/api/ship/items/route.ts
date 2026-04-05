import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getUserByUsername } from "@/lib/db/users";
import {
  getShipItemsByCategory,
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

  const body = await req.json();
  const { category, name, quantity, description } = body;

  if (category !== "cargo" && category !== "isolation") {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }
  if (!canAccess(user.accessLevel, category)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const item = await createShipItem({
    category,
    name: name.trim(),
    quantity: typeof quantity === "number" && quantity >= 1 ? quantity : 1,
    description: description?.trim() || undefined,
  });

  return NextResponse.json({ item }, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { id, category, name, quantity, description } = body;

  if (!id || typeof id !== "number") {
    return NextResponse.json({ error: "Item id is required" }, { status: 400 });
  }
  if (category && !canAccess(user.accessLevel, category)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const item = await updateShipItem(id, {
    name: name.trim(),
    quantity: typeof quantity === "number" && quantity >= 1 ? quantity : 1,
    imageUrl: body.imageUrl?.trim() || null,
    description: description?.trim() || null,
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

  const body = await req.json();
  const { id, category } = body;

  if (!id || typeof id !== "number") {
    return NextResponse.json({ error: "Item id is required" }, { status: 400 });
  }
  if (category && !canAccess(user.accessLevel, category)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const deleted = await deleteShipItem(id);
  if (!deleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
