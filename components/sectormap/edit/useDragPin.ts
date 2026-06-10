"use client";

// Pin drag hook. Returns:
//   - drag state (live position of the dragged entity)
//   - startDrag(): attach to a pin's onMouseDown to begin tracking
// Drag is mouse-tracked via document-level listeners installed for the
// duration of the gesture (auto-cleaned on mouseup), so it survives the
// cursor leaving the SVG bounds. Stops propagation to prevent pan-init.

import { useCallback, useRef, useState } from "react";
import type { EntityKind } from "./types";

interface DragState {
  kind: EntityKind;
  id?: number;
  tempId?: string;
  x: number;
  y: number;
}

interface StartDragArgs {
  event: React.MouseEvent;
  svg: SVGSVGElement | null;
  kind: EntityKind;
  id?: number;
  tempId?: string;
  currentX: number;
  currentY: number;
  onCommit: (kind: EntityKind, ref: { id?: number; tempId?: string }, x: number, y: number) => void;
}

export function useDragPin() {
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);

  const startDrag = useCallback((args: StartDragArgs) => {
    const { event, svg, kind, id, tempId, currentX, currentY, onCommit } = args;
    if (!svg) return;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    event.stopPropagation();

    const inverse = ctm.inverse();
    const pt = svg.createSVGPoint();
    pt.x = event.clientX;
    pt.y = event.clientY;
    const startSvg = pt.matrixTransform(inverse);
    const offsetX = currentX - startSvg.x;
    const offsetY = currentY - startSvg.y;

    const initial: DragState = { kind, id, tempId, x: currentX, y: currentY };
    setDrag(initial);
    dragRef.current = initial;
    let didMove = false;

    const onMove = (ev: MouseEvent) => {
      const pt2 = svg.createSVGPoint();
      pt2.x = ev.clientX;
      pt2.y = ev.clientY;
      const svgPt = pt2.matrixTransform(inverse);
      const next: DragState = { kind, id, tempId, x: svgPt.x + offsetX, y: svgPt.y + offsetY };
      if (!didMove && (Math.abs(next.x - currentX) > 0.5 || Math.abs(next.y - currentY) > 0.5)) {
        didMove = true;
      }
      dragRef.current = next;
      setDrag(next);
    };
    const onUp = () => {
      const d = dragRef.current;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      if (didMove && d) {
        onCommit(kind, { id: d.id, tempId: d.tempId }, d.x, d.y);
      }
      dragRef.current = null;
      setDrag(null);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, []);

  return { drag, startDrag };
}
