import type { CSSProperties } from "react";

export type SlideBackground =
  | { kind: "solid"; color: string }
  | { kind: "gradient"; from: string; to: string; angleDeg: number }
  | { kind: "image"; src: string };

export type Slide = {
  id: string;
  elements: SlideElement[];
  /** When set, replaces the presentation default for this slide only. */
  backgroundOverride?: SlideBackground;
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
  fontFamily: string;
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
  /** Applied to new slides and slides without backgroundOverride. */
  defaultSlideBackground: SlideBackground;
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

export const DEFAULT_SLIDE_BACKGROUND: SlideBackground = {
  kind: "solid",
  color: "#ffffff",
};

export const FONT_CHOICES = [
  { label: "System UI", value: "system-ui, 'Segoe UI', sans-serif" },
  { label: "Georgia serif", value: "Georgia, 'Times New Roman', serif" },
  { label: "Consolas monospace", value: "'Consolas', 'Courier New', monospace" },
] as const;

export function defaultFontFamily(): string {
  return FONT_CHOICES[0].value;
}

export function resolveSlideBackground(
  presentation: Presentation,
  slide: Slide,
): SlideBackground {
  return slide.backgroundOverride ?? presentation.defaultSlideBackground;
}

export function slideBackgroundToStyle(bg: SlideBackground): CSSProperties {
  if (bg.kind === "solid") {
    return { backgroundColor: bg.color };
  }
  if (bg.kind === "gradient") {
    return {
      backgroundImage: `linear-gradient(${String(bg.angleDeg)}deg, ${bg.from}, ${bg.to})`,
    };
  }
  return {
    backgroundImage: `url(${JSON.stringify(bg.src)})`,
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
    backgroundSize: "cover",
  };
}

function migrateSlideElement(el: SlideElement): SlideElement {
  if (el.type !== "text") {
    return el;
  }
  const legacy = el as unknown as { fontFamily?: string };
  return {
    ...(el as TextElement),
    fontFamily: legacy.fontFamily ?? defaultFontFamily(),
  };
}

function migrateSlide(slide: Slide): Slide {
  return {
    ...slide,
    elements: slide.elements.map(migrateSlideElement),
  };
}

function migratePresentation(p: Presentation): Presentation {
  return {
    ...p,
    defaultSlideBackground: p.defaultSlideBackground ?? DEFAULT_SLIDE_BACKGROUND,
    slides: (p.slides ?? []).map(migrateSlide),
  };
}

export function migratePrestoStore(store: PrestoStore): PrestoStore {
  return {
    presentations: store.presentations.map(migratePresentation),
  };
}
