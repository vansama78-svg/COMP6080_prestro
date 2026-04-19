import { useRef, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode, type RefObject } from "react";
import type { SlideElement } from "../types/presentation";
import { getElementStyle } from "../lib/slideDeckUtils";
import {
  type Corner,
  type RectPct,
  clientToSlidePercent,
  moveRect,
  resizeRectFromCorner,
} from "../lib/slideElementGeometry";

type DragState =
  | {
      kind: "move";
      pointerId: number;
      startRect: RectPct;
      startSlide: { x: number; y: number };
    }
  | {
      kind: "resize";
      corner: Corner;
      pointerId: number;
      startRect: RectPct;
    };

const HANDLE_CLASS = "slide-element-handle";

type Props = {
  element: SlideElement;
  canvasRef: RefObject<HTMLElement | null>;
  selected: boolean;
  onSelect: () => void;
  onDragProgress: (_rect: RectPct) => void;
  onDragEnd: (_rect: RectPct) => void | Promise<void>;
  onEdit: () => void;
  onContextDelete: (_e: ReactMouseEvent) => void;
  children: ReactNode;
};

export function EditorElementShell({
  element,
  canvasRef,
  selected,
  onSelect,
  onDragProgress,
  onDragEnd,
  onEdit,
  onContextDelete,
  children,
}: Props) {
  const dragRef = useRef<DragState | null>(null);

  const attachDragListeners = (initial: DragState) => {
    dragRef.current = initial;
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const onMove = (ev: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || ev.pointerId !== drag.pointerId || !canvasRef.current) {
        return;
      }
      const rectEl = canvasRef.current.getBoundingClientRect();
      const ptr = clientToSlidePercent(ev.clientX, ev.clientY, rectEl);

      if (drag.kind === "move") {
        const dx = ptr.x - drag.startSlide.x;
        const dy = ptr.y - drag.startSlide.y;
        onDragProgress(moveRect(drag.startRect, dx, dy));
        return;
      }

      onDragProgress(resizeRectFromCorner(drag.corner, drag.startRect, ptr.x, ptr.y));
    };

    const onUp = (ev: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || ev.pointerId !== drag.pointerId) {
        return;
      }
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);

      const c = canvasRef.current;
      if (c) {
        const rectEl = c.getBoundingClientRect();
        const ptr = clientToSlidePercent(ev.clientX, ev.clientY, rectEl);
        let finalRect: RectPct;
        if (drag.kind === "move") {
          const dx = ptr.x - drag.startSlide.x;
          const dy = ptr.y - drag.startSlide.y;
          finalRect = moveRect(drag.startRect, dx, dy);
        } else {
          finalRect = resizeRectFromCorner(drag.corner, drag.startRect, ptr.x, ptr.y);
        }
        void onDragEnd(finalRect);
      }

      dragRef.current = null;
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };

  const startMove = (e: ReactPointerEvent) => {
    if (!canvasRef.current || e.button !== 0) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    onSelect();
    const rectEl = canvasRef.current.getBoundingClientRect();
    const startSlide = clientToSlidePercent(e.clientX, e.clientY, rectEl);
    const startRect: RectPct = {
      x: element.x,
      y: element.y,
      width: element.width,
      height: element.height,
    };
    attachDragListeners({
      kind: "move",
      pointerId: e.pointerId,
      startRect,
      startSlide,
    });
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const startResize = (corner: Corner, e: ReactPointerEvent) => {
    if (!canvasRef.current || e.button !== 0) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    onSelect();
    const startRect: RectPct = {
      x: element.x,
      y: element.y,
      width: element.width,
      height: element.height,
    };
    attachDragListeners({
      kind: "resize",
      corner,
      pointerId: e.pointerId,
      startRect,
    });
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  return (
    <div
      className={`slide-element-shell${selected ? " slide-element-shell--selected" : ""}`}
      onPointerDown={(e) => {
        const t = e.target as HTMLElement | null;
        if (t?.closest(`.${HANDLE_CLASS}`)) {
          return;
        }
        startMove(e);
      }}
      role="presentation"
      style={getElementStyle(element)}
    >
      <div
        className="slide-element-shell__body"
        onContextMenu={onContextDelete}
        onDoubleClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onEdit();
        }}
        title="Drag to move; drag corners to resize; double-click to edit properties"
      >
        {children}
      </div>
      {selected ? (
        <>
          <button
            aria-label="Resize from top-left"
            className={`${HANDLE_CLASS} slide-element-handle--nw`}
            onPointerDown={(e) => startResize("nw", e)}
            type="button"
          />
          <button
            aria-label="Resize from top-right"
            className={`${HANDLE_CLASS} slide-element-handle--ne`}
            onPointerDown={(e) => startResize("ne", e)}
            type="button"
          />
          <button
            aria-label="Resize from bottom-left"
            className={`${HANDLE_CLASS} slide-element-handle--sw`}
            onPointerDown={(e) => startResize("sw", e)}
            type="button"
          />
          <button
            aria-label="Resize from bottom-right"
            className={`${HANDLE_CLASS} slide-element-handle--se`}
            onPointerDown={(e) => startResize("se", e)}
            type="button"
          />
        </>
      ) : null}
    </div>
  );
}
