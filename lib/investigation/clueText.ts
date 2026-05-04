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

export function buildMentionMarkup(name: string, entityId: number): string {
  // Strip characters that would interfere with the markup syntax or render
  // confusingly. `]` would terminate the name capture early; `[` `(` `)` look
  // like part of the markup brackets and confuse readers when present in raw
  // text. Newlines collapse to spaces so a mention always stays on one line.
  const safeName = name.replace(/[[\]()]/g, "").replace(/\s+/g, " ").trim();
  return `@[${safeName}](kanka:${entityId})`;
}
