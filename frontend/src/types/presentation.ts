export type Slide = {
  id: string;
  elements: unknown[];
};

export type Presentation = {
  id: string;
  name: string;
  description: string;
  thumbnail: string;
  slides: Slide[];
  createdAt: string;
  updatedAt: string;
};

export type PrestoStore = {
  presentations: Presentation[];
};

export const EMPTY_STORE: PrestoStore = {
  presentations: [],
};
