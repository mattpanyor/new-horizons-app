import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

export interface Message {
  id: number;
  kankaEntityId: number | null;
  senderUserId: number | null;
  subject: string;
  body: string;
  sendToAll: boolean;
  archived: boolean;
  createdAt: string;
}

export interface MessageWithReadStatus extends Message {
  isRead: boolean;
  readAt: string | null;
}

function rowToMessage(row: Record<string, unknown>): Message {
  return {
    id: row.id as number,
    kankaEntityId: (row.kanka_entity_id as number) ?? null,
    senderUserId: (row.sender_user_id as number) ?? null,
    subject: row.subject as string,
    body: row.body as string,
    sendToAll: row.send_to_all as boolean,
    archived: (row.archived as boolean) ?? false,
    createdAt: row.created_at as string,
  };
}

/** Get all messages for a user (with read status), newest first */
export async function getMessagesForUser(userId: number): Promise<MessageWithReadStatus[]> {
  const rows = await sql`
    SELECT m.*, mr.is_read, mr.read_at
    FROM messages m
    JOIN message_recipients mr ON mr.message_id = m.id
    WHERE mr.user_id = ${userId} AND (m.archived = false OR m.archived IS NULL)
    ORDER BY m.created_at ASC
  `;

  return rows.map((row) => ({
    ...rowToMessage(row),
    isRead: row.is_read as boolean,
    readAt: (row.read_at as string) ?? null,
  }));
}

/** Get unread count for a user */
export async function getUnreadCount(userId: number): Promise<number> {
  const rows = await sql`
    SELECT COUNT(*) as count
    FROM message_recipients mr
    JOIN messages m ON m.id = mr.message_id
    WHERE mr.user_id = ${userId} AND mr.is_read = false AND (m.archived = false OR m.archived IS NULL)
  `;
  return Number(rows[0].count);
}

/** Mark a message as read for a user */
export async function markAsRead(messageId: number, userId: number): Promise<boolean> {
  const rows = await sql`
    UPDATE message_recipients
    SET is_read = true, read_at = NOW()
    WHERE message_id = ${messageId} AND user_id = ${userId}
    RETURNING id
  `;
  return rows.length > 0;
}

/** Get all active messages (admin view), newest first */
export async function getAllMessages(): Promise<Message[]> {
  const rows = await sql`
    SELECT * FROM messages WHERE archived = false OR archived IS NULL ORDER BY created_at DESC
  `;
  return rows.map(rowToMessage);
}

/** Get all archived messages (admin view), newest first */
export async function getArchivedMessages(): Promise<Message[]> {
  const rows = await sql`
    SELECT * FROM messages WHERE archived = true ORDER BY created_at DESC
  `;
  return rows.map(rowToMessage);
}

/** Archive or unarchive a message */
export async function archiveMessage(id: number, archived: boolean): Promise<boolean> {
  const rows = await sql`
    UPDATE messages SET archived = ${archived} WHERE id = ${id} RETURNING id
  `;
  return rows.length > 0;
}

/** Get recipients for a message */
export async function getMessageRecipients(messageId: number): Promise<number[]> {
  const rows = await sql`
    SELECT user_id FROM message_recipients WHERE message_id = ${messageId}
  `;
  return rows.map((r) => r.user_id as number);
}

/** Get user IDs who have read a message */
export async function getMessageReadByUserIds(messageId: number): Promise<number[]> {
  const rows = await sql`
    SELECT user_id FROM message_recipients WHERE message_id = ${messageId} AND is_read = true
  `;
  return rows.map((r) => r.user_id as number);
}

/** Create a message and insert recipient rows */
export async function createMessage(fields: {
  kankaEntityId: number | null;
  senderUserId: number | null;
  subject: string;
  body: string;
  sendToAll: boolean;
  recipientUserIds: number[];
}): Promise<Message> {
  const rows = await sql`
    INSERT INTO messages (kanka_entity_id, sender_user_id, subject, body, send_to_all)
    VALUES (${fields.kankaEntityId}, ${fields.senderUserId}, ${fields.subject}, ${fields.body}, ${fields.sendToAll})
    RETURNING *
  `;

  const message = rowToMessage(rows[0]);

  for (const userId of fields.recipientUserIds) {
    await sql`
      INSERT INTO message_recipients (message_id, user_id)
      VALUES (${message.id}, ${userId})
    `;
  }

  return message;
}

/** Update a message and replace recipients */
export async function updateMessage(
  id: number,
  fields: {
    kankaEntityId: number | null;
    senderUserId: number | null;
    subject: string;
    body: string;
    sendToAll: boolean;
    recipientUserIds: number[];
  }
): Promise<Message | null> {
  const rows = await sql`
    UPDATE messages SET
      kanka_entity_id = ${fields.kankaEntityId},
      sender_user_id  = ${fields.senderUserId},
      subject         = ${fields.subject},
      body            = ${fields.body},
      send_to_all     = ${fields.sendToAll}
    WHERE id = ${id}
    RETURNING *
  `;

  if (rows.length === 0) return null;

  // Replace recipients
  await sql`DELETE FROM message_recipients WHERE message_id = ${id}`;
  for (const userId of fields.recipientUserIds) {
    await sql`
      INSERT INTO message_recipients (message_id, user_id)
      VALUES (${id}, ${userId})
    `;
  }

  return rowToMessage(rows[0]);
}

/** Delete a message (recipients cascade) */
export async function deleteMessage(id: number): Promise<boolean> {
  const rows = await sql`DELETE FROM messages WHERE id = ${id} RETURNING id`;
  return rows.length > 0;
}
