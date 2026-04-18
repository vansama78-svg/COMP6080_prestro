export type Slide = {
  id: string;
  elements: SlideElement[];
};

export type TextElement = {
  id: string;
  type: "text";
  x: number;
  y: number;
  width: number;
  height: number;
  content: string;
  fontSizeEm: number;
  color: string;
  layer: number;
};

export type ImageElement = {
  id: string;
  type: "image";
  x: number;
  y: number;
  width: number;
  height: number;
  src: string;
  alt: string;
  layer: number;
};

export type VideoElement = {
  id: string;
  type: "video";
  x: number;
  y: number;
  width: number;
  height: number;
  url: string;
  autoplay: boolean;
  layer: number;
};

export type CodeElement = {
  id: string;
  type: "code";
  x: number;
  y: number;
  width: number;
  height: number;
  code: string;
  fontSizeEm: number;
  layer: number;
};

export type SlideElement = TextElement | ImageElement | VideoElement | CodeElement;

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
