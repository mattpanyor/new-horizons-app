"use client";

// Body-drag hook. Constrains a celestial body to its existing orbit ring
// (distance fixed), only updating orbit_position based on the angle from
// the system center to the cursor. Mirrors useDragPin's mousedown +
// document-listener pattern.
//
// Coordinate model (matches lib/sectorMapHelpers.getBodyPos):
//   localX = orbit_distance * SYS_MAX_R * cos((θ - 90)°)
//   localY = orbit_distance * SYS_MAX_R * sin((θ - 90)°)
// Inverse: θ = atan2(localY, localX) * 180/π + 90, normalized to [0, 360).

import { useCallback, useRef, useState } from "react";

interface BodyDragState {
  bodyDbId?: number;
  bodyTempId?: string;
  orbitPosition: number; // live, updated during drag
}

interface StartArgs {
  event: React.MouseEvent;
  svg: SVGSVGElement | null;
  bodyDbId?: number;
  bodyTempId?: string;
  systemCenterX: number; // SVG-space x of the system's star
  systemCenterY: number;
  onCommit: (ref: { dbId?: number; tempId?: string }, orbitPosition: number) => void;
}

function angleOf(localX: number, localY: number): number {
  const deg = (Math.atan2(localY, localX) * 180) / Math.PI + 90;
  return ((deg % 360) + 360) % 360;
}

export function useDragBody() {
  const [drag, setDrag] = useState<BodyDragState | null>(null);
  const dragRef = useRef<BodyDragState | null>(null);

  const start = useCallback((args: StartArgs) => {
    const { event, svg, bodyDbId, bodyTempId, systemCenterX, systemCenterY, onCommit } = args;
    if (!svg) return;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    event.stopPropagation();

    const inverse = ctm.inverse();
    let didMove = false;

    const computeAngle = (clientX: number, clientY: number) => {
      const pt = svg.createSVGPoint();
      pt.x = clientX;
      pt.y = clientY;
      const svgPt = pt.matrixTransform(inverse);
      return angleOf(svgPt.x - systemCenterX, svgPt.y - systemCenterY);
    };

    const initialAngle = computeAngle(event.clientX, event.clientY);
    const initial: BodyDragState = { bodyDbId, bodyTempId, orbitPosition: initialAngle };
    dragRef.current = initial;
    setDrag(initial);

    const onMove = (ev: MouseEvent) => {
      const angle = computeAngle(ev.clientX, ev.clientY);
      const next: BodyDragState = { bodyDbId, bodyTempId, orbitPosition: angle };
      if (!didMove && Math.abs(angle - initialAngle) > 0.5) didMove = true;
      dragRef.current = next;
      setDrag(next);
    };
    const onUp = () => {
      const d = dragRef.current;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      if (didMove && d) {
        onCommit({ dbId: d.bodyDbId, tempId: d.bodyTempId }, Math.round(d.orbitPosition));
      }
      dragRef.current = null;
      setDrag(null);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, []);

  return { drag, start };
}
