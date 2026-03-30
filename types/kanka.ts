export interface KankaLocation {
  id: number;
  entity_id: number;
  name: string;
  type: string | null;
  parent_location_id: number | null;
  is_private: boolean;
}

export interface KankaMember {
  id: number;
  name: string;
  avatar: string;
}

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
