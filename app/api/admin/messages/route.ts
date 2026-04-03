import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getUserByUsername, getAllUsers } from "@/lib/db/users";
import { getAllMessages, getArchivedMessages, getMessageRecipients, getMessageReadByUserIds, createMessage, updateMessage, deleteMessage, archiveMessage } from "@/lib/db/messages";

async function requireAdmin() {
  const cookieStore = await cookies();
  const username = cookieStore.get("nh_user")?.value;
  if (!username) return null;
  const user = await getUserByUsername(username);
  if (!user || user.accessLevel < 127) return null;
  return user;
}

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [messages, archived] = await Promise.all([getAllMessages(), getArchivedMessages()]);

  async function enrichMessages(msgs: Awaited<ReturnType<typeof getAllMessages>>) {
    return Promise.all(
      msgs.map(async (msg) => ({
        ...msg,
        recipientUserIds: await getMessageRecipients(msg.id),
        readByUserIds: await getMessageReadByUserIds(msg.id),
      }))
    );
  }

  return NextResponse.json({
    messages: await enrichMessages(messages),
    archived: await enrichMessages(archived),
  });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { kankaEntityId, subject, body, sendToAll, recipientUserIds } = await req.json();

  if (!subject || !body) {
    return NextResponse.json({ error: "Missing subject or body" }, { status: 400 });
  }

  let finalRecipientIds: number[] = recipientUserIds ?? [];

  if (sendToAll) {
    const allUsers = await getAllUsers();
    finalRecipientIds = allUsers.map((u) => u.id);
  }

  if (finalRecipientIds.length === 0) {
    return NextResponse.json({ error: "No recipients selected" }, { status: 400 });
  }

  const message = await createMessage({
    kankaEntityId: kankaEntityId ?? null,
    senderUserId: null,
    subject,
    body,
    sendToAll: sendToAll ?? false,
    recipientUserIds: finalRecipientIds,
  });

  return NextResponse.json(message);
}

export async function PUT(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id, kankaEntityId, subject, body, sendToAll, recipientUserIds } = await req.json();

  if (!id || !subject || !body) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  let finalRecipientIds: number[] = recipientUserIds ?? [];

  if (sendToAll) {
    const allUsers = await getAllUsers();
    finalRecipientIds = allUsers.map((u) => u.id);
  }

  if (finalRecipientIds.length === 0) {
    return NextResponse.json({ error: "No recipients selected" }, { status: 400 });
  }

  const updated = await updateMessage(id, {
    kankaEntityId: kankaEntityId ?? null,
    senderUserId: null,
    subject,
    body,
    sendToAll: sendToAll ?? false,
    recipientUserIds: finalRecipientIds,
  });

  if (!updated) {
    return NextResponse.json({ error: "Message not found" }, { status: 404 });
  }

  return NextResponse.json(updated);
}

export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id, archived } = await req.json();
  if (!id || typeof archived !== "boolean") {
    return NextResponse.json({ error: "Missing id or archived flag" }, { status: 400 });
  }

  const ok = await archiveMessage(id, archived);
  if (!ok) {
    return NextResponse.json({ error: "Message not found" }, { status: 404 });
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
    return NextResponse.json({ error: "Missing message id" }, { status: 400 });
  }

  const deleted = await deleteMessage(id);
  if (!deleted) {
    return NextResponse.json({ error: "Message not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
