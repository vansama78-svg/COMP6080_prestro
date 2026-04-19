import type { SlideElement } from "../types/presentation";

/** Corner handle id for resize (opposite corner fixed). */
export type Corner = "nw" | "ne" | "sw" | "se";

export type RectPct = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const MIN_SIZE_PCT = 1;

export function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, value));
}

export function applyRectToElement(el: SlideElement, r: RectPct): SlideElement {
  return { ...el, x: r.x, y: r.y, width: r.width, height: r.height };
}

/** Clamp rect so it stays inside the slide (0–100%) with min width/height 1%. */
export function clampRectToSlide(r: RectPct): RectPct {
  let { x, y, width, height } = r;
  width = Math.max(MIN_SIZE_PCT, Math.min(width, 100));
  height = Math.max(MIN_SIZE_PCT, Math.min(height, 100));
  x = clampPercent(x);
  y = clampPercent(y);
  if (x + width > 100) {
    x = 100 - width;
  }
  if (y + height > 100) {
    y = 100 - height;
  }
  return { x, y, width, height };
}

export function clientToSlidePercent(
  clientX: number,
  clientY: number,
  canvas: DOMRect,
): { x: number; y: number } {
  const x = ((clientX - canvas.left) / canvas.width) * 100;
  const y = ((clientY - canvas.top) / canvas.height) * 100;
  return { x, y };
}

export function clientDeltaToSlidePercent(dx: number, dy: number, canvas: DOMRect): { dxPct: number; dyPct: number } {
  return {
    dxPct: (dx / canvas.width) * 100,
    dyPct: (dy / canvas.height) * 100,
  };
}

/** Translate rect by delta (percent); keeps size, clamps to slide. */
export function moveRect(r: RectPct, dxPct: number, dyPct: number): RectPct {
  return clampRectToSlide({
    ...r,
    x: r.x + dxPct,
    y: r.y + dyPct,
  });
}

/**
 * Resize by dragging `corner`; pointer position (px, py) is in slide percent.
 * Opposite corner stays fixed (standard resize behavior).
 */
export function resizeRectFromCorner(corner: Corner, r: RectPct, px: number, py: number): RectPct {
  const right = r.x + r.width;
  const bottom = r.y + r.height;

  switch (corner) {
  case "se": {
    let width = px - r.x;
    let height = py - r.y;
    width = Math.max(MIN_SIZE_PCT, width);
    height = Math.max(MIN_SIZE_PCT, height);
    return clampRectToSlide({ ...r, width, height });
  }
  case "nw": {
    let nx = Math.min(px, right - MIN_SIZE_PCT);
    let ny = Math.min(py, bottom - MIN_SIZE_PCT);
    nx = Math.max(0, nx);
    ny = Math.max(0, ny);
    const width = right - nx;
    const height = bottom - ny;
    return clampRectToSlide({ x: nx, y: ny, width, height });
  }
  case "ne": {
    let ny = Math.min(py, bottom - MIN_SIZE_PCT);
    ny = Math.max(0, ny);
    let width = px - r.x;
    width = Math.max(MIN_SIZE_PCT, Math.min(width, 100 - r.x));
    const height = bottom - ny;
    return clampRectToSlide({ x: r.x, y: ny, width, height });
  }
  case "sw": {
    let nx = Math.min(px, right - MIN_SIZE_PCT);
    nx = Math.max(0, nx);
    let height = py - r.y;
    height = Math.max(MIN_SIZE_PCT, Math.min(height, 100 - r.y));
    const width = right - nx;
    return clampRectToSlide({ x: nx, y: r.y, width, height });
  }
  default: {
    return clampRectToSlide(r);
  }
  }
}
