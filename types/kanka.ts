export interface KankaEntity {
  id: number;
  entity_id: number;
  name: string;
  type?: string | null;
  image_full?: string | null;
  image_thumb?: string | null;
  has_custom_image?: boolean;
  title?: string | null;
}

export interface KankaPaginatedResponse<T> {
  data: T[];
  links: {
    first: string;
    last: string;
    prev: string | null;
    next: string | null;
  };
}
