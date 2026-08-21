export interface Chapter {
  number: number;
  title: string;
}

export interface Clue {
  id: number;
  chapter: number;
  text: string;
  factionSlugs: string[];
  /** Game session the clue was discovered in. Null for clues recorded before the field existed. */
  sessionNumber: number | null;
  createdBy: string;
  createdAt: string;
  creatorImageUrl: string | null;
  creatorColor: string | null;
}
