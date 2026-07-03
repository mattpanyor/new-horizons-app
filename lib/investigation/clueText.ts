// Inline markup for mentions: @[Display Name](kanka:ENTITY_ID)
//
// Stored in clue text. Parsed at render time into clickable links to the
// project's Kanka campaign.

import { kankaEntityUrl } from "@/lib/kanka";

const MENTION_RE = /@\[([^\]]+)\]\(kanka:(\d+)\)/g;

export interface MentionToken {
  kind: "mention";
  name: string;
  entityId: number;
  url: string;
}

export interface TextToken {
  kind: "text";
  value: string;
}

export type ClueToken = TextToken | MentionToken;

export function parseClueText(text: string): ClueToken[] {
  const out: ClueToken[] = [];
  let lastIndex = 0;
  // Reset regex state in case it's a /g
  MENTION_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = MENTION_RE.exec(text)) !== null) {
    if (match.index > lastIndex) {
      out.push({ kind: "text", value: text.slice(lastIndex, match.index) });
    }
    const name = match[1];
    const entityId = Number(match[2]);
    out.push({
      kind: "mention",
      name,
      entityId,
      url: kankaEntityUrl(entityId),
    });
    lastIndex = MENTION_RE.lastIndex;
  }
  if (lastIndex < text.length) {
    out.push({ kind: "text", value: text.slice(lastIndex) });
  }
  return out;
}

export interface MentionState {
  query: string;
  atIndex: number; // Position of '@' in the text
  endIndex: number; // Cursor position (end of query)
}

// Detect an in-progress `@mention` immediately before the cursor. The `@` must
// start the text or follow whitespace, and the query so far must be
// whitespace-free. Shared by the clue and storybook editors.
export function detectMention(text: string, cursor: number): MentionState | null {
  const pre = text.slice(0, cursor);
  const match = /(?:^|\s)@([^\s\n]*)$/.exec(pre);
  if (!match) return null;
  const matchStart = match.index;
  const leadingWs = match[0].length - match[1].length - 1; // 0 or 1
  const atIndex = matchStart + leadingWs;
  return { query: match[1], atIndex, endIndex: cursor };
}

export function buildMentionMarkup(name: string, entityId: number): string {
  // Strip characters that would interfere with the markup syntax or render
  // confusingly. `]` would terminate the name capture early; `[` `(` `)` look
  // like part of the markup brackets and confuse readers when present in raw
  // text. Newlines collapse to spaces so a mention always stays on one line.
  const safeName = name.replace(/[[\]()]/g, "").replace(/\s+/g, " ").trim();
  return `@[${safeName}](kanka:${entityId})`;
}
