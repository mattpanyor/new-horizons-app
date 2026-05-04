export interface Chapter {
  number: number;
  title: string;
}

export interface Clue {
  id: number;
  chapter: number;
  text: string;
  factionSlugs: string[];
  createdBy: string;
  createdAt: string;
  creatorImageUrl: string | null;
  creatorColor: string | null;
}
