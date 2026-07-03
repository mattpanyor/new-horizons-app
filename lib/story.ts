import type { StoryPage, StoryBlock } from "@/types/story";

// Marker the admin inserts to force a new book page. A line consisting solely
// of this token (whitespace-tolerant) splits the body into pages.
export const PAGE_BREAK = "---PAGE---";
const PAGE_BREAK_RE = /^\s*---PAGE---\s*$/;

// Markdown-style image on its own line: ![alt](url)
const IMAGE_RE = /^\s*!\[([^\]]*)\]\((\S+?)\)\s*$/;

// Build an image token to insert into a body from a CDN url.
export function imageToken(url: string, alt = ""): string {
  return `![${alt}](${url})`;
}

// Turn a buffer of raw text lines into a text block (paragraphs split on blank
// lines). Returns null when the buffer holds no prose.
function flushText(buffer: string[]): StoryBlock | null {
  const text = buffer.join("\n").trim();
  if (!text) return null;
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim().replace(/\s*\n\s*/g, " "))
    .filter(Boolean);
  return paragraphs.length > 0 ? { type: "text", paragraphs } : null;
}

function chunkToPage(lines: string[]): StoryPage {
  let heading: string | null = null;
  let rest = lines;

  const firstIdx = lines.findIndex((l) => l.trim() !== "");
  if (firstIdx >= 0 && /^#\s+/.test(lines[firstIdx].trim())) {
    heading = lines[firstIdx].trim().replace(/^#\s+/, "").trim();
    rest = lines.slice(firstIdx + 1);
  }

  const blocks: StoryBlock[] = [];
  let buffer: string[] = [];
  for (const line of rest) {
    const m = line.match(IMAGE_RE);
    if (m) {
      const text = flushText(buffer);
      if (text) blocks.push(text);
      buffer = [];
      blocks.push({ type: "image", url: m[2], alt: m[1] ?? "" });
    } else {
      buffer.push(line);
    }
  }
  const trailing = flushText(buffer);
  if (trailing) blocks.push(trailing);

  return { heading, blocks };
}

// Split a story body into rendered pages. Empty pages (e.g. a stray double
// break) are dropped so navigation never lands on a blank leaf.
export function parseStoryBody(body: string): StoryPage[] {
  const lines = body.replace(/\r\n/g, "\n").split("\n");
  const chunks: string[][] = [[]];
  for (const line of lines) {
    if (PAGE_BREAK_RE.test(line)) chunks.push([]);
    else chunks[chunks.length - 1].push(line);
  }
  const pages = chunks.map(chunkToPage).filter((p) => p.heading || p.blocks.length > 0);
  return pages.length > 0 ? pages : [{ heading: null, blocks: [] }];
}

const ROMAN: [number, string][] = [
  [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"],
  [100, "C"], [90, "XC"], [50, "L"], [40, "XL"],
  [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
];

export function toRoman(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return String(n);
  let out = "";
  let rem = Math.floor(n);
  for (const [value, sym] of ROMAN) {
    while (rem >= value) {
      out += sym;
      rem -= value;
    }
  }
  return out;
}
