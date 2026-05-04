// Inline markup for mentions: @[Display Name](kanka:ENTITY_ID)
//
// Stored in clue text. Parsed at render time into clickable links to the
// project's Kanka campaign.

export const KANKA_CAMPAIGN_ID = "96303";

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
      url: `https://app.kanka.io/w/${KANKA_CAMPAIGN_ID}/entities/${entityId}`,
    });
    lastIndex = MENTION_RE.lastIndex;
  }
  if (lastIndex < text.length) {
    out.push({ kind: "text", value: text.slice(lastIndex) });
  }
  return out;
}

export function buildMentionMarkup(name: string, entityId: number): string {
  // Strip ] from name to keep the markup parseable
  const safeName = name.replace(/\]/g, "");
  return `@[${safeName}](kanka:${entityId})`;
}
