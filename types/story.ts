export interface StoryEntry {
  id: number;
  uid: string;
  chapter: number;
  chapterTitle: string | null;
  sessionNumber: number | null;
  title: string;
  body: string;
  isPublic: boolean;
  assignedUsernames: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// A page's content is an ordered list of blocks so headings and images can sit
// anywhere between paragraphs. A `# Heading` line becomes a heading block
// wherever it appears (e.g. "What do you do?"); text blocks carry their own
// paragraph split.
export type StoryBlock =
  | { type: "text"; paragraphs: string[] }
  | { type: "image"; url: string; alt: string }
  | { type: "heading"; text: string };

// A section of the book, produced by splitting the body on `---PAGE---`
// markers. Its blocks are then flowed across as many physical pages as needed.
export interface StoryPage {
  blocks: StoryBlock[];
}
