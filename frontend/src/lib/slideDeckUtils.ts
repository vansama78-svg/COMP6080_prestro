import type { SlideElement } from "../types/presentation";

export function getElementStyle(element: SlideElement) {
  return {
    height: `${String(element.height)}%`,
    left: `${String(element.x)}%`,
    top: `${String(element.y)}%`,
    width: `${String(element.width)}%`,
    zIndex: element.layer,
  };
}

export function withAutoplay(url: string, autoplay: boolean): string {
  if (!autoplay) {
    return url;
  }
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}autoplay=1`;
}
