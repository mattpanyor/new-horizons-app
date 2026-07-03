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

// A page's content is an ordered list of blocks so images can sit between
// paragraphs. Text blocks carry their own paragraph split.
export type StoryBlock =
  | { type: "text"; paragraphs: string[] }
  | { type: "image"; url: string; alt: string };

// A single rendered leaf of the book, produced from the entry body by
// splitting on `---PAGE---` markers. An optional leading `# Heading` line
// becomes the page's centred header (e.g. "What do you do?").
export interface StoryPage {
  heading: string | null;
  blocks: StoryBlock[];
}
