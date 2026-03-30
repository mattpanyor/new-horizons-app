export interface KankaLocation {
  id: number;
  entity_id: number;
  name: string;
  type: string | null;
  parent_location_id: number | null;
  is_private: boolean;
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
